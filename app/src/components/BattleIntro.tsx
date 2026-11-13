import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCAL_KEYS } from "@/lib/local-data";
import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { BATTLE_TICKET_COST, BATTLE_XP_MAX, FREE_BATTLE_TICKETS } from "@/lib/economy";
import { BATTLE_QUIZ_LENGTH } from "@/lib/quiz";
import { radius, shadow, useColors } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Btn, T, tap } from "./ui";

const SEEN_KEY = LOCAL_KEYS.battleIntroSeen.key;

const PAGES: { icon: IconName; title: string; body: string }[] = [
  { icon: "swords", title: "랜덤 매칭 배틀", body: "다른 학습자와 1:1로 붙어요. 매칭되면 두 사람에게 같은 주제가 같은 순간에 뽑혀요." },
  { icon: "book", title: "내 관심 분야에서만 출제", body: "주제는 내 관심 분야 안에서, 상대와 겹치는 분야에서 골라요. 관심 분야는 설정에서 바꿀 수 있어요." },
  { icon: "robot", title: `10분 공부 · AI 문제 ${BATTLE_QUIZ_LENGTH}개`, body: `두 사람 모두 10분 동안 공부한 뒤, AI가 새로 만들고 두 번 검수한 ${BATTLE_QUIZ_LENGTH}문제를 풀어요. 배틀 중에는 시간을 추가할 수 없어요.` },
  { icon: "trophy", title: "이기면 경험치를 가져와요", body: `점수가 높은 사람이 진 사람 경험치의 5%(최대 ${BATTLE_XP_MAX} XP)를 가져가요. 점수가 같으면 연장전! 한 문제씩 풀어 한 사람만 맞힐 때까지 이어져요.` },
  { icon: "ticket", title: "배틀권", body: `매칭할 때 두 사람 모두 배틀권을 1개씩 써요. 무료 배틀권은 매월 ${FREE_BATTLE_TICKETS}개, 톱니바퀴 ${BATTLE_TICKET_COST}개로 더 살 수 있어요. 취소하거나 상대를 못 찾으면 돌려받아요.` },
];

/** 배틀 탭 첫 방문 때 한 번 보여 주는 설명. open을 주면 그때마다 다시 보여 줌 (도움말 버튼) */
export function BattleIntro({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const p = PAGES[page];
  const close = () => {
    AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
    setPage(0);
    onClose();
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.6)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: c.paper, borderRadius: radius.lg, padding: 24, gap: 16, maxWidth: 420, width: "100%", alignSelf: "center", borderTopWidth: 5, borderTopColor: c.accent, ...shadow(c, 3) }}>
          <View style={{ alignItems: "center", gap: 10, minHeight: 230 }}>
            <Icon name={p.icon} size={84} />
            <T size={22} weight="bold" center>{p.title}</T>
            <T size={15} color="ink2" center>{p.body}</T>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {PAGES.map((_, i) => (
              <Pressable key={i} onPress={() => { tap(); setPage(i); }} hitSlop={6} accessibilityLabel={`${i + 1}번째 설명`}>
                <View style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? c.accent : c.line2 }} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {page > 0 ? <Btn title="이전" onPress={() => setPage(page - 1)} style={{ flex: 1 }} /> : <Btn title="건너뛰기" variant="ghost" onPress={close} style={{ flex: 1 }} />}
            <Btn title={last ? "시작하기" : "다음"} variant={last ? "accent" : "primary"} onPress={() => (last ? close() : setPage(page + 1))} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** 처음 들어왔으면 true (한 번 본 뒤로는 false) */
export function useBattleIntroFirstTime() {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((v) => setFirst(v !== "1")).catch(() => {});
  }, []);
  return first;
}
