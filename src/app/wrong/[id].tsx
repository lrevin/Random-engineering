import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Badge, Btn, Card, Screen, T } from "@/components/ui";
import { topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { radius, useColors } from "@/theme";

/** 오답 노트: 한 번의 퀴즈에서 틀린 문제와 정답·해설 */
export default function WrongAnswers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records } = useApp();
  const c = useColors();
  const r = records.find((x) => x.id === id);
  const topic = r ? topicById(r.topicId) : undefined;

  if (!r) {
    return (
      <Screen>
        <T color="muted">기록을 찾을 수 없어요.</T>
        <Btn title="닫기" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: 6 }}>
        <Badge label={topic?.categoryName ?? r.category} />
        <T size={24} weight="bold">오답 노트</T>
        <T size={15} color="muted">{r.topicKo} · {r.score}/{r.total} · 틀린 문제 {r.wrong.length}개</T>
      </View>

      {r.wrong.length === 0 ? (
        <Card><T color="muted" center>틀린 문제가 없어요. 만점이에요! 🎉</T></Card>
      ) : (
        r.wrong.map((w, i) => (
          <Card key={i} style={{ gap: 8 }}>
            <T size={13} weight="semibold" color="accent">오답 {i + 1}</T>
            <T size={16} weight="semibold" style={{ lineHeight: 24 }}>{w.q}</T>
            <View style={{ backgroundColor: c.successSoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 }}>
              <T size={14} weight="semibold" color="success">정답: {w.answer}</T>
            </View>
            <T size={14} color="ink2">{w.explain}</T>
          </Card>
        ))
      )}

      <Btn title="닫기" variant="primary" size="lg" onPress={() => router.back()} />
    </Screen>
  );
}
