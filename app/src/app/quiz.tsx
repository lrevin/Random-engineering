import * as Haptics from "expo-haptics";
import { Redirect, router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, Btn, levelTone, Row, T, tap } from "@/components/ui";
import { levelText, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { confirmQuit } from "@/lib/confirm";
import { loadQuiz, type QuizQuestion } from "@/lib/quiz";
import { calcRp, topicMastery, totalRp, userRank } from "@/lib/rank";
import { calcStreak } from "@/lib/stats";
import type { WrongAnswer } from "@/lib/types";
import { radius, raised, shadow, useColors } from "@/theme";

const isCorrect = (q: QuizQuestion, a: number | boolean | undefined) => a !== undefined && a === q.answer;
const answerText = (q: QuizQuestion) => (q.type === "mc" ? q.choices[q.answer] : q.answer ? "O (맞다)" : "X (틀리다)");

export default function Quiz() {
  const { active } = useApp();
  if (!active || active.stage !== "quiz") return <Redirect href="/" />;
  return <QuizInner />;
}

function QuizInner() {
  const { active, setActive, records, addRecord } = useApp();
  const c = useColors();
  const a = active!;
  const topic = topicById(a.topicId);
  const quiz = a.quiz;
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  // 문제 불러오기 (처음 한 번)
  useEffect(() => {
    if (quiz || !topic) return;
    let alive = true;
    loadQuiz(topic)
      .then((set) => {
        if (!alive) return;
        setActive((x) => (x ? { ...x, quiz: { source: set.source, questions: set.questions, answers: [] } } : x));
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [quiz, topic, setActive]);

  if (!topic) return null;

  if (!quiz) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
        {failed ? (
          <>
            <T size={18} weight="semibold" center>문제를 불러오지 못했어요.</T>
            <Btn title="다시 시도" variant="primary" onPress={() => { setFailed(false); setActive((x) => (x ? { ...x, quiz: null } : x)); }} />
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={c.accent} />
            <T size={17} weight="semibold" center>“{topic.ko}” 퀴즈를 준비하고 있어요</T>
            <T size={14} color="muted" center>AI가 이 주제의 새 문제를 만들고{"\n"}정답이 맞는지 2번 검수하고 있어요.</T>
          </>
        )}
      </SafeAreaView>
    );
  }

  const idx = quiz.answers.length < quiz.questions.length ? quiz.answers.length : quiz.questions.length - 1;
  const q = quiz.questions[idx];

  const finish = async (answers: (number | boolean)[]) => {
    if (saving) return;
    setSaving(true);
    const total = quiz.questions.length;
    const score = quiz.questions.filter((qq, i) => isCorrect(qq, answers[i])).length;
    const wrong: WrongAnswer[] = quiz.questions
      .filter((qq, i) => !isCorrect(qq, answers[i]))
      .map((qq) => ({ q: qq.q, answer: answerText(qq), explain: qq.explain }));
    const before = calcStreak(records);
    const streak = before.today ? before.streak : before.streak + 1;
    const priorAttempts = records.filter((r) => r.topicId === topic.id).length;
    const rp = calcRp({ topic, correct: score, total, priorAttempts, streak });
    const rpBefore = totalRp(records);
    const topicBefore = topicMastery(topic.id, records);
    const rec = await addRecord({
      topicId: topic.id, topicKo: topic.ko, domain: topic.domain, category: topic.category, level: topic.level,
      memo: a.memo, score, total, rp: rp.total, wrong, studySec: a.quizOnly ? 0 : a.studyUsed, quizSource: quiz.source,
    });
    const topicAfter = topicMastery(topic.id, [...records, rec]);
    setActive((x) => x ? {
      ...x, stage: "result", quiz: { ...quiz, answers },
      result: {
        recordId: rec.id, score, total, rp: rp.total, parts: rp.parts, streak,
        userTierBefore: userRank(rpBefore).index, userTierAfter: userRank(rpBefore + rp.total).index,
        topicTierBefore: topicBefore.index, topicTierAfter: topicAfter.index,
      },
    } : x);
    router.replace("/result");
  };

  return <QuestionView
    key={idx}
    q={q}
    index={idx}
    count={quiz.questions.length}
    topicName={topic.ko}
    badges={<Row gap={6}><Badge label={topic.categoryName} /><Badge label={levelText(topic.lv)} tone={levelTone(topic.level)} /></Row>}
    saving={saving}
    onQuit={() => confirmQuit(() => { setActive(null); router.replace("/home"); })}
    onNext={(answer) => {
      const answers = [...quiz.answers, answer];
      if (answers.length >= quiz.questions.length) finish(answers);
      else setActive((x) => (x && x.quiz ? { ...x, quiz: { ...x.quiz, answers } } : x));
    }}
  />;
}

function QuestionView({ q, index, count, topicName, badges, saving, onQuit, onNext }: {
  q: QuizQuestion; index: number; count: number; topicName: string;
  badges: ReactNode; saving: boolean;
  onQuit: () => void; onNext: (answer: number | boolean) => void;
}) {
  const c = useColors();
  const [picked, setPicked] = useState<number | boolean | null>(null);
  const answered = picked !== null;
  const correct = answered && picked === q.answer;

  const choose = (v: number | boolean) => {
    if (answered) return;
    setPicked(v);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(v === q.answer ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const optionStyle = (isThis: boolean, isAnswer: boolean) => {
    let border = c.line2, bg = c.paper, edge = c.paperEdge;
    if (answered && isAnswer) { border = c.success; bg = c.successSoft; edge = c.successDeep; }
    else if (answered && isThis) { border = c.accent; bg = c.accentSoft; edge = c.accentDeep; }
    return { borderColor: border, backgroundColor: bg, edge };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      {/* 상단: 닫기 + 진행 막대 */}
      <Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 8, flexWrap: "nowrap" }}>
        <Pressable onPress={onQuit} hitSlop={10} accessibilityRole="button" accessibilityLabel="그만두기">
          <T size={22} color="muted">✕</T>
        </Pressable>
        <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: c.chip, overflow: "hidden" }}>
          <View style={{ width: `${((index + (answered ? 1 : 0)) / count) * 100}%`, height: "100%", backgroundColor: c.success, borderRadius: 6 }} />
        </View>
        <T size={14} weight="semibold" color="ink2">{index + 1}/{count}</T>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <View style={{ gap: 6 }}>
          {badges}
          <T size={13} color="muted">
            {topicName} · {q.type === "mc" ? "4지선다" : "O / X"}
            {q.src === "ai" ? " · 🤖 AI 출제" : q.src === "bank" ? " · 📚 기본 문제" : ""}
          </T>
          {q.src === "offline" && <T size={12} color="accent">연습 문제예요 (퀴즈 AI에 연결되면 새 문제로 바뀌어요)</T>}
        </View>
        <T size={21} weight="bold" style={{ lineHeight: 31 }}>{q.q}</T>

        {q.type === "mc" ? (
          <View style={{ gap: 10 }}>
            {q.choices.map((ch, i) => (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ selected: picked === i, disabled: answered }}
                onPress={() => { tap(); choose(i); }}
                style={({ pressed }) => {
                  const { edge, ...o } = optionStyle(picked === i, i === q.answer);
                  const down = pressed && !answered;
                  return {
                    flexDirection: "row", gap: 12, alignItems: "center", padding: 16, borderRadius: radius.lg,
                    borderWidth: 2, ...o, ...raised(edge, down, 5), ...(!down ? shadow(c, 1) : null),
                  };
                }}
              >
                <View style={{ width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, borderBottomWidth: 3, borderColor: c.line2, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
                  <T size={14} weight="bold" color="ink2">{i + 1}</T>
                </View>
                <T size={16} style={{ flex: 1 }}>{ch}</T>
              </Pressable>
            ))}
          </View>
        ) : (
          <Row gap={12} style={{ flexWrap: "nowrap" }}>
            {[true, false].map((v) => (
              <Pressable
                key={String(v)}
                accessibilityRole="radio"
                accessibilityLabel={v ? "O 맞다" : "X 틀리다"}
                accessibilityState={{ selected: picked === v, disabled: answered }}
                onPress={() => { tap(); choose(v); }}
                style={({ pressed }) => {
                  const { edge, ...o } = optionStyle(picked === v, v === q.answer);
                  const down = pressed && !answered;
                  return {
                    flex: 1, aspectRatio: 1.2, borderRadius: radius.lg, borderWidth: 2, alignItems: "center", justifyContent: "center",
                    ...o, ...raised(edge, down, 6), ...(!down ? shadow(c, 1) : null),
                  };
                }}
              >
                <T size={56} weight="bold" style={{ lineHeight: 66, color: v ? c.success : c.accent }}>{v ? "O" : "X"}</T>
              </Pressable>
            ))}
          </Row>
        )}
      </ScrollView>

      {/* 하단 피드백 (듀오링고식) */}
      {answered && (
        <View style={{ padding: 20, gap: 10, backgroundColor: correct ? c.successSoft : c.accentSoft, borderTopWidth: 2, borderTopColor: correct ? c.success : c.accent, boxShadow: `0px -4px 12px ${c.shadow}` }}>
          <T size={18} weight="bold" color={correct ? "success" : "accent"}>{correct ? "정답이에요! 🎉" : `아쉬워요. 정답: ${answerText(q)}`}</T>
          <T size={15} color="ink2">{q.explain}</T>
          <Btn
            title={index + 1 >= count ? "결과 보기" : "다음 문제"}
            variant={correct ? "primary" : "accent"}
            size="lg"
            loading={saving}
            onPress={() => onNext(picked!)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
