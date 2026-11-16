import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AdRewardButton } from "@/components/AdRewardButton";
import { Icon } from "@/components/Icon";
import { Screen, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { radius, raised, shadow, useColors } from "@/theme";

/** 콘텐츠 버튼: 그림 + 이름 + 설명 두 줄. 배틀 · 스피드 퀴즈 모두 같은 크기 */
function ContentButton({ icon, title, desc, note, onPress, label }: {
  icon: ReactNode; title: string; desc: string; note: string; onPress: () => void; label: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 14, minHeight: 104, paddingVertical: 18, paddingHorizontal: 16,
        borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper,
        ...raised(c.paperEdge, pressed, 5), ...(!pressed ? shadow(c, 2) : null),
      })}
    >
      <View style={{ width: 60, height: 60, borderRadius: radius.md, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={18} weight="bold">{title}</T>
        <T size={13} color="ink2">{desc}</T>
        <T size={12} color="muted">{note}</T>
      </View>
      <T size={22} color="muted">›</T>
    </Pressable>
  );
}

/** 콘텐츠 탭: 랭킹 · 랜덤 매칭 배틀(대기 화면으로) · 스피드 퀴즈 */
export default function Arena() {
  const { mode, premium, freeTickets, boughtTickets } = useApp();
  const tickets = freeTickets + boughtTickets;
  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">콘텐츠</T>

      <ContentButton
        icon={<Icon name="trophy" size={40} />}
        title="랭킹"
        desc="주간 XP · 레벨 · 분야 랭크 전체 순위"
        note={mode !== "user" ? "로그인하면 볼 수 있어요" : "매주 월요일 0시에 주간 순위가 새로 시작돼요"}
        label="랭킹 보러 가기"
        onPress={() => router.push("/ranking")}
      />
      <ContentButton
        icon={<Icon name="swords" size={40} />}
        title="랜덤 매칭 배틀"
        desc="같은 분야 사람과 같은 주제로 1:1 대결"
        note={mode !== "user" ? "로그인하면 할 수 있어요" : premium ? "프리미엄 · 배틀권 무제한" : `남은 배틀권 ${tickets}개`}
        label="랜덤 매칭 배틀 대기실로 가기"
        onPress={() => router.push("/match")}
      />
      <ContentButton
        icon={<Icon name="bolt" size={40} />}
        title="스피드 퀴즈"
        desc="1분 동안 공부한 주제의 4지선다 풀기"
        note="맞힌 만큼 경험치 · 배틀권 필요 없음"
        label="스피드 퀴즈 하러 가기"
        onPress={() => router.push("/speed")}
      />

      {/* 광고 보고 톱니바퀴 (배틀권은 톱니바퀴로 살 수 있음) */}
      <AdRewardButton />
    </Screen>
  );
}
