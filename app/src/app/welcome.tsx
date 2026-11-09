import { router } from "expo-router";
import { Image, useColorScheme, useWindowDimensions, View } from "react-native";
import { Btn, Card, Screen, T } from "@/components/ui";
import { APP_NAME, APP_SUBTITLE, APP_TAGLINE } from "@/config";
import { useApp } from "@/lib/app-state";
import { useColors } from "@/theme";

const STEPS = [
  { n: "1", title: "뽑기", body: "관심 분야에서 랜덤 주제 하나" },
  { n: "2", title: "15분 공부", body: "AI 없이 위키·백과사전으로" },
  { n: "3", title: "퀴즈 7문제", body: "AI가 새로 낸 문제 + 기본 문제, 맞힐수록 레벨 UP" },
];

export default function Welcome() {
  const { width } = useWindowDimensions();
  const markH = Math.min(width * 0.28, 120);
  const { startGuest } = useApp();
  const c = useColors();
  const dark = useColorScheme() === "dark";
  return (
    <Screen contentStyle={{ justifyContent: "space-between" }}>
      <View style={{ gap: 10, marginTop: 40 }}>
        {/* 슬롯머신 아이콘만 두고, 그 왼쪽 끝에 이름 줄을 맞춤 */}
        <Image
          source={dark ? require("../../assets/logo-mark-dark.png") : require("../../assets/logo-mark.png")}
          accessibilityLabel={`${APP_NAME} 로고`}
          style={{ width: markH * (404 / 360), height: markH }}
          resizeMode="contain"
        />
        <T size={30} weight="bold" style={{ marginTop: 14, letterSpacing: -0.6 }}>
          <T size={30} weight="bold" color="accent">{APP_NAME}</T>
          <T size={30} weight="bold" color="muted">{"  -  "}</T>
          {APP_SUBTITLE}
        </T>
        <T size={16} color="ink2">{APP_TAGLINE}</T>
      </View>

      <Card accent style={{ gap: 14 }}>
        {STEPS.map((s) => (
          <View key={s.n} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.navy, alignItems: "center", justifyContent: "center" }}>
              <T weight="bold" color="navyInk">{s.n}</T>
            </View>
            <View>
              <T size={17} weight="semibold">{s.title}</T>
              <T size={14} color="muted">{s.body}</T>
            </View>
          </View>
        ))}
      </Card>

      <View style={{ gap: 10 }}>
        <Btn title="이메일로 시작하기" variant="accent" size="lg" onPress={() => router.push("/signup")} />
        <Btn title="이미 계정이 있어요" size="lg" onPress={() => router.push("/login")} />
        <Btn title="로그인 없이 둘러보기" variant="ghost" onPress={startGuest} />
      </View>
    </Screen>
  );
}
