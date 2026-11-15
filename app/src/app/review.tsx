import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { showDialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { readExamStore, type ExamWrong } from "@/lib/exam";
import { buildReview, collectWrongs, markDone, readDone, REVIEW_LENGTH, type DoneMap, type ReviewItem } from "@/lib/review";
import { useColors } from "@/theme";
import { answerText, isCorrect, QuestionView } from "./quiz";

/**
 * 오답 다시 풀기 (프리미엄): 퀴즈·모의고사에서 틀린 문제를 모아, 같은 주제·같은 유형의 변형 문제로 다시 풉니다.
 * 변형 문제를 맞히면 그 오답은 목록에서 빠집니다.
 */
export default function Review() {
  const { records, premium } = useApp();
  const c = useColors();
  const [examWrongs, setExamWrongs] = useState<ExamWrong[] | null>(null);
  const [done, setDone] = useState<DoneMap>({});
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [answers, setAnswers] = useState<(number | boolean)[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([readExamStore(), readDone()]).then(([s, d]) => { setExamWrongs(s.wrongs); setDone(d); });
  }, []);

  const wrongs = useMemo(() => collectWrongs(records, examWrongs ?? [], done), [records, examWrongs, done]);
  const finished = !!items && answers.length >= items.length;

  const start = async () => {
    if (loading || !premium || !wrongs.length) return;
    setNotice("");
    setLoading(true);
    try {
      const set = await buildReview(wrongs);
      if (!set.length) throw new Error("empty");
      setAnswers([]);
      setItems(set);
    } catch {
      setNotice("문제를 불러오지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const quit = () =>
    showDialog({
      icon: "door",
      title: "오답 풀기를 그만둘까요?",
      message: "지금까지 맞힌 문제는 오답 목록에서 빠져요.",
      buttons: [
        { text: "계속 풀기", style: "cancel" },
        { text: "그만두기", style: "destructive", onPress: () => setItems(null) },
      ],
    });

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
        <ActivityIndicator size="large" color={c.accent} />
        <T size={17} weight="semibold" center>틀렸던 문제를 변형하고 있어요</T>
        <T size={14} color="muted" center>같은 주제·같은 유형이지만 정답은 달라요.</T>
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
        topicName={it.wrong.topic.ko}
        badges={<Row gap={6}><Badge label={it.changed ? "오답 변형" : "오답 다시"} tone="accent" /><Badge label={it.wrong.topic.categoryName} /></Row>}
        saving={false}
        onQuit={quit}
        onNext={(a) => {
          // 맞히면 바로 오답 목록에서 뺌 (중간에 그만둬도 남도록)
          if (isCorrect(it.q, a)) markDone([it.wrong.key]).then(setDone);
          setAnswers([...answers, a]);
        }}
      />
    );
  }

  // ───────── 결과 ─────────
  if (items && finished) {
    const right = items.filter((it, i) => isCorrect(it.q, answers[i])).length;
    const missed = items.map((it, i) => ({ it, i })).filter(({ it, i }) => !isCorrect(it.q, answers[i]));
    return (
      <Screen scroll>
        <View style={{ alignItems: "center", gap: 6, paddingTop: 8 }}>
          <Icon name={right === items.length ? "party" : "target"} size={72} />
          <T size={30} weight="bold" color={right ? "success" : "accent"}>오답 {right}개 해결!</T>
          <T size={16} color="ink2">{items.length}문제 중 {right}문제를 맞혔어요</T>
          <T size={13} color="muted">남은 오답 {wrongs.length}개</T>
        </View>

        {missed.length > 0 && (
          <>
            <SectionTitle title={`또 틀린 문제 ${missed.length}개`} right={<T size={13} color="muted">오답에 그대로 남아요</T>} />
            {missed.map(({ it, i }) => (
              <Card key={i} style={{ gap: 6 }}>
                <T size={12} color="muted">{it.wrong.topic.categoryName} · {it.wrong.topic.ko}</T>
                <T size={15} weight="semibold">{it.q.q}</T>
                <T size={14} color="success" weight="semibold">정답: {answerText(it.q)}</T>
                <T size={14} color="ink2">{it.q.explain}</T>
              </Card>
            ))}
          </>
        )}

        {wrongs.length > 0 && <Btn title={`남은 오답 이어서 풀기 (${Math.min(REVIEW_LENGTH, wrongs.length)}문제)`} variant="accent" size="lg" onPress={start} />}
        <Btn title="닫기" variant={wrongs.length ? "ghost" : "primary"} size={wrongs.length ? "md" : "lg"} onPress={() => router.back()} />
      </Screen>
    );
  }

  // ───────── 시작 화면 ─────────
  const ready = examWrongs !== null;
  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">오답 다시 풀기</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">
        퀴즈와 모의고사에서 틀린 문제를 모아, 같은 주제·같은 유형의 변형 문제로 다시 풀어요. 정답이 달라져서 답을 외워서는 못 맞혀요.
      </T>

      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 22 }}>
        <Icon name={wrongs.length ? "target" : "party"} size={56} />
        <T size={34} weight="bold">{ready ? wrongs.length : "-"}<T size={18} weight="bold" color="ink2">개</T></T>
        <T size={14} color="muted">{wrongs.length ? "아직 해결하지 못한 오답" : ready ? "남은 오답이 없어요. 잘하고 있어요!" : "오답을 모으고 있어요"}</T>
      </Card>

      {premium ? (
        <>
          <Btn
            title={wrongs.length ? `변형 문제로 풀기 (${Math.min(REVIEW_LENGTH, wrongs.length)}문제)` : "풀 오답이 없어요"}
            variant="accent" size="lg" onPress={start} disabled={!ready || !wrongs.length}
          />
          <T size={13} color="muted" center>변형 문제를 맞히면 그 오답은 목록에서 빠지고, 틀리면 그대로 남아요.</T>
        </>
      ) : (
        <Card style={{ gap: 10, borderColor: c.gold, backgroundColor: c.goldSoft }}>
          <Row gap={8} style={{ flexWrap: "nowrap" }}><Icon name="lock" size={22} color={c.ink} /><T size={16} weight="bold">프리미엄 전용 기능이에요</T></Row>
          <T size={14} color="ink2">무료 버전에서는 기록 화면에서 오답과 해설을 볼 수 있고, 변형 문제로 다시 푸는 건 프리미엄에서 할 수 있어요.</T>
          <Btn title="프리미엄 알아보기" variant="premium" icon={<Icon name="crown" size={24} />} onPress={() => router.push("/shop")} />
        </Card>
      )}
      {notice ? <T color="accent" center>{notice}</T> : null}

      {wrongs.length > 0 && (
        <>
          <SectionTitle title="최근 오답" right={<T size={13} color="muted">{Math.min(5, wrongs.length)} / {wrongs.length}</T>} />
          {wrongs.slice(0, 5).map((w) => (
            <Card key={w.key} style={{ gap: 4 }}>
              <T size={12} color="muted">{w.topic.categoryName} · {w.topic.ko}</T>
              <T size={15} weight="semibold" numberOfLines={2}>{w.q}</T>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
