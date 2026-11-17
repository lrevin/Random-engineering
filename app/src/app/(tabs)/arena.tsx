import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ContentArt } from "@/components/ContentArt";
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
        flexDirection: "row", alignItems: "center", gap: 14, minHeight: 108, paddingVertical: 16, paddingHorizontal: 14,
        borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper,
        ...raised(c.paperEdge, pressed, 5), ...(!pressed ? shadow(c, 2) : null),
      })}
    >
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <T size={18} weight="bold">{title}</T>
        <T size={13} color="ink2">{desc}</T>
        <T size={12} color="muted">{note}</T>
      </View>
      <T size={22} color="muted">›</T>
    </Pressable>
  );
}

/** 콘텐츠 탭: 랭킹 · 랜덤 매칭 배틀(대기 화면으로) · 스터디 팀 · 오답 보스전 · 스피드 퀴즈 */
export default function Arena() {
  const { mode, premium, freeTickets, boughtTickets } = useApp();
  const tickets = freeTickets + boughtTickets;
  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">콘텐츠</T>

      <ContentButton
        icon={<ContentArt name="ranking" />}
        title="랭킹"
        desc="주간 XP · 레벨 · 분야 랭크 전체 순위"
        note={mode !== "user" ? "로그인하면 볼 수 있어요" : "매주 월요일 0시에 주간 순위가 새로 시작돼요"}
        label="랭킹 보러 가기"
        onPress={() => router.push("/ranking")}
      />
      <ContentButton
        icon={<ContentArt name="battle" />}
        title="랜덤 매칭 배틀"
        desc="같은 분야 사람과 같은 주제로 1:1 대결"
        note={mode !== "user" ? "로그인하면 할 수 있어요" : premium ? "프리미엄 · 배틀권 무제한" : `남은 배틀권 ${tickets}개`}
        label="랜덤 매칭 배틀 대기실로 가기"
        onPress={() => router.push("/match")}
      />
      <ContentButton
        icon={<ContentArt name="team" />}
        title="스터디 팀"
        desc="친구와 2~4명이 한 팀, 주간 목표 채우고 보상 받기"
        note={mode !== "user" ? "둘러보기에서는 미리 보기만 할 수 있어요" : "친구끼리만 · 빈자리는 랜덤으로 채우기 중에 골라요"}
        label="스터디 팀으로 가기"
        onPress={() => router.push("/team")}
      />
      <ContentButton
        icon={<ContentArt name="boss" />}
        title="오답 보스전"
        desc="같은 분야 사람들이 많이 틀린 50문제로 보스 잡기"
        note="한 주에 한 번 · 클리어하면 톱니바퀴 · XP · 낮은 확률로 전용 테마"
        label="오답 보스전 하러 가기"
        onPress={() => router.push("/boss")}
      />
      <ContentButton
        icon={<ContentArt name="speed" />}
        title="스피드 퀴즈"
        desc="1분 동안 공부한 주제의 4지선다 풀기"
        note="맞힌 만큼 경험치 · 배틀권 필요 없음"
        label="스피드 퀴즈 하러 가기"
        onPress={() => router.push("/speed")}
      />
    </Screen>
  );
}
