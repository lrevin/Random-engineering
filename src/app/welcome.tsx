import { router } from "expo-router";
import { View } from "react-native";
import { Btn, Card, Screen, T } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/config";
import { useApp } from "@/lib/app-state";
import { useColors } from "@/theme";

const STEPS = [
  { n: "1", title: "뽑기", body: "관심 분야에서 랜덤 주제 하나" },
  { n: "2", title: "15분 공부", body: "AI 없이 위키·백과사전으로" },
  { n: "3", title: "2분 설명", body: "메모를 가리고 소리 내어" },
];

export default function Welcome() {
  const { startGuest, serverEnabled } = useApp();
  const c = useColors();
  return (
    <Screen contentStyle={{ justifyContent: "space-between" }}>
      <View style={{ gap: 10, marginTop: 40 }}>
        <T size={48} weight="bold" style={{ letterSpacing: -1 }}>
          {APP_NAME}<T size={48} weight="bold" color="accent">.</T>
        </T>
        <T size={18} color="ink2">{APP_TAGLINE}</T>
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
        <Btn title="이메일로 시작하기" variant="accent" size="lg" onPress={() => router.push("/signup")} disabled={!serverEnabled} />
        <Btn title="이미 계정이 있어요" size="lg" onPress={() => router.push("/login")} disabled={!serverEnabled} />
        <Btn title="로그인 없이 둘러보기" variant="ghost" onPress={startGuest} />
        {!serverEnabled && (
          <T size={12} color="muted" center>개발용 안내: 서버(Supabase)가 아직 연결되지 않아 둘러보기만 가능해요.</T>
        )}
      </View>
    </Screen>
  );
}
