import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { showDialog } from "@/components/Dialog";
import { DomainIcon, Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import type { ExamItem } from "@/lib/quiz";
import {
  buildRecall, dueTopics, markRecalled, readRecallLog, RECALL_DAYS, RECALL_PER_TOPIC, RECALL_TOPICS, todayKey, type RecallLog,
} from "@/lib/recall";
import { useColors } from "@/theme";
import { answerText, isCorrect, QuestionView } from "./quiz";

/** 하루에 한 번 복습을 끝내면 받는 톱니바퀴 */
const RECALL_GEARS = 5;

/** 복습: 마지막으로 본 지 2일이 지난 주제를 주제마다 3문제씩 다시 풀어 봄 */
export default function Recall() {
  const { records, claimQuest } = useApp();
  const c = useColors();
  const [log, setLog] = useState<RecallLog | null>(null);
  const [items, setItems] = useState<ExamItem[] | null>(null);
  const [answers, setAnswers] = useState<(number | boolean)[]>([]);
  const [loading, setLoading] = useState(false);
  const [got, setGot] = useState(0);

  useEffect(() => { readRecallLog().then(setLog); }, []);
  const due = useMemo(() => (log ? dueTopics(records, log) : []), [records, log]);
  const finished = !!items && answers.length >= items.length;

  const start = async () => {
    if (loading || !due.length) return;
    setLoading(true);
    try {
      const qs = await buildRecall(due);
      if (qs.length) { setAnswers([]); setGot(0); setItems(qs); }
    } finally {
      setLoading(false);
    }
  };

  const finish = async (all: (number | boolean)[], qs: ExamItem[]) => {
    setLog(await markRecalled([...new Set(qs.map((x) => x.topic.id))]));
    if (await claimQuest(`recall:${todayKey()}`, RECALL_GEARS)) setGot(RECALL_GEARS);
    void all;
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <ActivityIndicator size="large" color={c.accent} />
        <T size={17} weight="semibold">복습 문제를 고르고 있어요</T>
      </SafeAreaView>
    );
  }

  // ───────── 문제 풀기 ─────────
  if (items && !finished) {
    const idx = answers.length;
    const it = items[idx];
    return (
      <QuestionView
        key={idx}
        q={it.q}
        index={idx}
        count={items.length}
        topicName={it.topic.ko}
        badges={<Row gap={6}><Badge label="복습" tone="navy" /><Badge label={it.topic.categoryName} /></Row>}
        saving={false}
        onQuit={() => showDialog({
          icon: "door", title: "복습을 그만둘까요?", message: "지금까지 푼 문제는 기록되지 않아요.",
          buttons: [{ text: "계속 풀기", style: "cancel" }, { text: "그만두기", style: "destructive", onPress: () => setItems(null) }],
        })}
        onNext={(a) => {
          const next = [...answers, a];
          setAnswers(next);
          if (next.length >= items.length) finish(next, items);
        }}
      />
    );
  }

  // ───────── 결과 ─────────
  if (items && finished) {
    const topics = [...new Map(items.map((x) => [x.topic.id, x.topic])).values()];
    const score = (id: string) => items.reduce((n, x, i) => n + (x.topic.id === id && isCorrect(x.q, answers[i]) ? 1 : 0), 0);
    const total = items.filter((x, i) => isCorrect(x.q, answers[i])).length;
    const missed = items.map((x, i) => ({ x, i })).filter(({ x, i }) => !isCorrect(x.q, answers[i]));
    return (
      <Screen scroll>
        <View style={{ alignItems: "center", gap: 6, paddingTop: 8 }}>
          <Icon name={total === items.length ? "party" : "book"} size={72} />
          <T size={30} weight="bold">복습 완료!</T>
          <T size={16} color="ink2">{items.length}문제 중 {total}문제를 기억하고 있었어요</T>
          {got > 0 && <Row gap={4}><Icon name="gear" size={20} /><T size={15} weight="bold" color="success">오늘 복습 보상 +{got}</T></Row>}
          <T size={13} color="muted">이 주제들은 {RECALL_DAYS}일 뒤에 다시 복습할 차례가 돼요.</T>
        </View>

        <SectionTitle title="주제별 기억" />
        <Card style={{ gap: 12 }}>
          {topics.map((t) => {
            const s = score(t.id);
            const n = items.filter((x) => x.topic.id === t.id).length;
            return (
              <Row key={t.id} gap={10} style={{ flexWrap: "nowrap" }}>
                <DomainIcon id={t.domain} size={28} />
                <T size={15} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{t.ko}</T>
                <T size={15} weight="bold" color={s === n ? "success" : s === 0 ? "accent" : "ink2"}>{s} / {n}</T>
              </Row>
            );
          })}
        </Card>

        {missed.length > 0 && (
          <>
            <SectionTitle title={`헷갈린 문제 ${missed.length}개`} />
            {missed.map(({ x, i }) => (
              <Card key={i} style={{ gap: 6 }}>
                <T size={12} color="muted">{x.topic.categoryName} · {x.topic.ko}</T>
                <T size={15} weight="semibold">{x.q.q}</T>
                <T size={14} color="success" weight="semibold">정답: {answerText(x.q)}</T>
                <T size={14} color="ink2">{x.q.explain}</T>
              </Card>
            ))}
          </>
        )}

        {due.length > 0 && <Btn title={`남은 복습 이어서 하기 (${Math.min(RECALL_TOPICS, due.length)}개 주제)`} variant="accent" size="lg" onPress={start} />}
        <Btn title="닫기" variant={due.length ? "ghost" : "primary"} size={due.length ? "md" : "lg"} onPress={() => router.back()} />
      </Screen>
    );
  }

  // ───────── 시작 화면 ─────────
  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">오늘의 복습</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">
        공부한 지 {RECALL_DAYS}일이 지난 주제를 잊기 전에 다시 꺼내 봐요. 주제마다 {RECALL_PER_TOPIC}문제, 한 번에 {RECALL_TOPICS}개 주제까지 풀어요.
      </T>

      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 22 }}>
        <Icon name={due.length ? "book" : "party"} size={56} />
        <T size={34} weight="bold">{log ? due.length : "-"}<T size={18} weight="bold" color="ink2">개</T></T>
        <T size={14} color="muted">{due.length ? "오늘 복습할 주제" : log ? "오늘은 복습할 주제가 없어요" : "복습할 주제를 찾고 있어요"}</T>
      </Card>

      <Btn
        title={due.length ? `복습 시작 (${Math.min(RECALL_TOPICS, due.length) * RECALL_PER_TOPIC}문제)` : "복습할 주제가 없어요"}
        variant="accent" size="lg" onPress={start} disabled={!due.length}
      />
      <T size={13} color="muted" center>하루 한 번 복습을 끝내면 톱니바퀴 {RECALL_GEARS}개를 받아요.</T>

      {due.length > 0 && (
        <>
          <SectionTitle title="복습할 주제" right={<T size={13} color="muted">오래된 순</T>} />
          <Card style={{ gap: 12 }}>
            {due.slice(0, 8).map((d) => (
              <Row key={d.topic.id} gap={10} style={{ flexWrap: "nowrap" }}>
                <DomainIcon id={d.topic.domain} size={28} />
                <View style={{ flex: 1 }}>
                  <T size={15} weight="semibold" numberOfLines={1}>{d.topic.ko}</T>
                  <T size={12} color="muted">{d.topic.categoryName}</T>
                </View>
                <T size={12} color={d.overdue > 0 ? "accent" : "muted"}>{d.overdue + RECALL_DAYS}일 전</T>
              </Row>
            ))}
            {due.length > 8 && <T size={12} color="muted" center>외 {due.length - 8}개</T>}
          </Card>
        </>
      )}
    </Screen>
  );
}
