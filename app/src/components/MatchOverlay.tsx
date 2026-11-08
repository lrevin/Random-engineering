import { useEffect, useState } from "react";
import { Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT } from "./ui";

// 매칭 창은 앱 테마와 상관없이 늘 어두운 경기장 느낌으로 (남색 + 금색)
const BG = "#0f1630";
const PANEL = "#1b2547";
const EDGE = "#0a1024";
const GOLD = "#f7b500";
const RED = "#e0453a";
const INK = "#f4efe3";
const MUTED = "#9aa3c0";

function Label({ children, size = 16, color = INK, bold, center = true }: { children: React.ReactNode; size?: number; color?: string; bold?: boolean; center?: boolean }) {
  return (
    <Text style={{ fontFamily: bold ? FONT.bold : FONT.medium, fontSize: size, lineHeight: Math.round(size * 1.3), color, textAlign: center ? "center" : "left" }}>
      {children}
    </Text>
  );
}

/** 선수 카드 (나 / 상대) */
function PlayerCard({ name, sub, color, mystery, pulse }: { name: string; sub: string; color: string; mystery?: boolean; pulse?: Animated.Value }) {
  return (
    <View style={{
      width: "100%", backgroundColor: PANEL, borderRadius: 22, borderWidth: 2, borderColor: color, borderBottomWidth: 6, borderBottomColor: EDGE,
      paddingVertical: 18, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 16,
    }}>
      <Animated.View style={{
        width: 64, height: 64, borderRadius: 18, backgroundColor: color, alignItems: "center", justifyContent: "center",
        opacity: mystery && pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) : 1,
      }}>
        <Label size={30} bold color={BG}>{mystery ? "?" : name.slice(0, 1)}</Label>
      </Animated.View>
      <View style={{ flex: 1, gap: 2 }}>
        <Label size={22} bold center={false}>{name}</Label>
        <Label size={14} color={MUTED} center={false}>{sub}</Label>
      </View>
    </View>
  );
}

/**
 * 화면을 가득 채우는 랜덤 매칭 창.
 * 기다리는 동안: 나 VS ? + 퍼지는 원 + 대기 시간 + 취소 / 매칭되면: 상대 공개 → (부모가) 배틀 화면으로 이동
 */
type Props = {
  visible: boolean;
  me: string;
  myLevel: number;
  /** 예: "💻 컴퓨터공학 · 공부 10분" */
  setting: string;
  waitedSec: number;
  maxSec: number;
  /** 매칭되면 상대 닉네임 */
  opponent: string | null;
  onCancel: () => void;
  cancelling: boolean;
};

export function MatchOverlay(props: Props) {
  if (!props.visible) return null;
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <OverlayBody {...props} />
    </Modal>
  );
}

function OverlayBody({ me, myLevel, setting, waitedSec, maxSec, opponent, onCancel, cancelling }: Props) {
  const [ring] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const [dots, setDots] = useState(1);

  // 퍼지는 원 + 물음표 깜빡임
  useEffect(() => {
    const a = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: false }));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]));
    a.start();
    b.start();
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => { a.stop(); b.stop(); clearInterval(t); };
  }, [ring, pulse]);

  // 상대가 나타나면 VS가 튀어나옴
  useEffect(() => {
    if (!opponent) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false }).start();
  }, [opponent, pop]);

  const mm = Math.floor(waitedSec / 60);
  const ss = String(Math.floor(waitedSec % 60)).padStart(2, "0");
  const found = !!opponent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={["top", "bottom"]}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 20, justifyContent: "space-between", maxWidth: 520, width: "100%", alignSelf: "center" }}>
          {/* 위: 제목 */}
          <View style={{ gap: 6, alignItems: "center" }}>
            <Label size={15} color={GOLD} bold>⚔️ 랜덤 매칭 배틀</Label>
            <Label size={30} bold>{found ? "매칭 완료!" : `상대를 찾는 중${".".repeat(dots)}`}</Label>
            <Label size={14} color={MUTED}>{setting}</Label>
          </View>

          {/* 가운데: 나 VS 상대 */}
          <View style={{ alignItems: "center", gap: 18 }}>
            <PlayerCard name={me} sub={`⭐ ${myLevel}레벨 · 나`} color={GOLD} />
            <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
              {[0, 1].map((i) => (
                <Animated.View
                  key={i}
                  style={{
                    position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: GOLD,
                    opacity: found ? 0 : ring.interpolate({ inputRange: [0, 1], outputRange: i ? [0.5, 0] : [0.9, 0] }),
                    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: i ? [0.6, 1.15] : [0.35, 0.95] }) }],
                  }}
                />
              ))}
              <Animated.View style={{
                width: 96, height: 96, borderRadius: 48, backgroundColor: found ? RED : PANEL, borderWidth: 3, borderColor: GOLD,
                alignItems: "center", justifyContent: "center",
                transform: [{ scale: found ? pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) : 1 }],
              }}>
                <Label size={38} bold color={found ? INK : GOLD}>VS</Label>
              </Animated.View>
            </View>
            <PlayerCard
              name={found ? opponent! : "???"}
              sub={found ? "상대 학습자" : "같은 조건의 상대를 찾고 있어요"}
              color={found ? RED : "#3a4672"}
              mystery={!found}
              pulse={pulse}
            />
          </View>

          {/* 아래: 대기 시간 + 취소 */}
          <View style={{ gap: 14, alignItems: "center" }}>
            {found ? (
              <Label size={16} color={GOLD} bold>곧 배틀이 시작돼요!</Label>
            ) : (
              <>
                <Label size={46} bold>{mm}:{ss}</Label>
                <Label size={13} color={MUTED}>최대 {Math.round(maxSec / 60)}분 기다려요 · 못 찾으면 배틀권을 돌려받아요</Label>
                <Pressable
                  onPress={onCancel}
                  disabled={cancelling}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    alignSelf: "stretch", paddingVertical: 16, borderRadius: 18, borderWidth: 2, borderColor: MUTED,
                    borderBottomWidth: pressed ? 2 : 6, borderBottomColor: EDGE, marginTop: pressed ? 4 : 0,
                    backgroundColor: PANEL, opacity: cancelling ? 0.5 : 1,
                  })}
                >
                  <Label size={18} bold>{cancelling ? "취소하는 중…" : "매칭 취소"}</Label>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
  );
}
