import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, Platform, View } from "react-native";
import { Badge, Btn, Card, levelTone, Row, Screen, T } from "@/components/ui";
import { studyLinks, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { fmtDate, fmtDuration } from "@/lib/stats";
import { useColors } from "@/theme";

function Section({ label, text }: { label: string; text: string }) {
  return (
    <View style={{ gap: 4 }}>
      <T size={13} weight="semibold" color="muted">{label}</T>
      <T size={16} color={text ? "ink" : "muted"}>{text || "-"}</T>
    </View>
  );
}

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, removeRecord } = useApp();
  const c = useColors();
  const r = records.find((x) => x.id === id);
  if (!r) {
    return (
      <Screen>
        <T color="muted">기록을 찾을 수 없어요.</T>
        <Btn title="닫기" onPress={() => router.back()} />
      </Screen>
    );
  }
  const topic = topicById(r.topicId);

  const del = () => {
    const run = async () => {
      try {
        await removeRecord(r.id);
        router.back();
      } catch {
        Alert.alert("삭제하지 못했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      }
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`"${r.topicKo}" 기록을 삭제할까요?`)) run();
      return;
    }
    Alert.alert("기록 삭제", `"${r.topicKo}" 기록을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: run },
    ]);
  };

  return (
    <Screen scroll>
      <View style={{ gap: 6 }}>
        <Row gap={6}>
          <Badge label={topic?.categoryName ?? r.category} />
          <Badge label={r.level} tone={levelTone(r.level)} />
        </Row>
        <T size={26} weight="bold">{r.topicKo}</T>
        <T size={14} color="muted">{fmtDate(r.studiedAt)} · 공부 {fmtDuration(r.studySec)} · 설명 {fmtDuration(r.explainSec)}</T>
        <T size={24} style={{ letterSpacing: 2 }}>
          <T size={24} style={{ color: c.accent }}>{"★".repeat(r.rating)}</T>
          <T size={24} style={{ color: c.line2 }}>{"★".repeat(5 - r.rating)}</T>
        </T>
      </View>

      <Card style={{ gap: 14 }}>
        <Section label="공부 메모" text={r.memo} />
        <Section label="잘 설명한 것" text={r.good} />
        <Section label="막혔던 것" text={r.stuck} />
      </Card>

      {topic && (
        <View style={{ gap: 8 }}>
          <T size={14} weight="semibold" color="ink2">다시 찾아보기</T>
          <Row>
            {studyLinks(topic).map((l) => (
              <Btn key={l.label} title={`${l.label} ↗`} size="sm" onPress={() => WebBrowser.openBrowserAsync(l.url).catch(() => {})} />
            ))}
          </Row>
        </View>
      )}

      <View style={{ gap: 8, marginTop: 8 }}>
        <Btn title="닫기" variant="primary" onPress={() => router.back()} />
        <Btn title="이 기록 삭제" variant="ghost" onPress={del} />
      </View>
    </Screen>
  );
}
