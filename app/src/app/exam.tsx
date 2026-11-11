import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { showDialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Row, Screen, T } from "@/components/ui";
import { certById, CERTS, isCertId, type CertDef } from "@/data";
import { useApp } from "@/lib/app-state";
import { EXAM_TICKET_COST, FREE_EXAMS_PER_DAY, MAX_EXAM_TICKETS } from "@/lib/economy";
import {
  addExamTicket, buildExam, countExamStart, EXAM_PER_SUBJECT, EXAM_SUBJECT_MIN, EXAM_TOTAL_MIN, freeExamsLeft, gradeExam,
  readExamStore, saveExamResult, subjectFailed, type ExamPaper, type ExamResult,
} from "@/lib/exam";
import { fmtDate } from "@/lib/stats";
import { radius, shadow, useColors } from "@/theme";
import { answerText, isCorrect, QuestionView } from "./quiz";

type Store = Awaited<ReturnType<typeof readExamStore>>;
const pct = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);

/** 자격증 모의고사: 자격증 고르기 → 과목별 문제 풀기 → 과목별 점수와 합격 판정 */
export default function Exam() {
  const { prefs, premium, gears, spendGears } = useApp();
  const c = useColors();
  const [store, setStore] = useState<Store | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<(number | boolean)[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { readExamStore().then(setStore); }, []);

  const left = store ? freeExamsLeft(store) : 0;
  const tickets = store?.tickets ?? 0;
  /** 무료 횟수를 다 쓴 무료 회원은 1회권으로 봄 */
  const useTicket = !premium && left <= 0;
  const canStart = premium || left > 0 || tickets > 0;

  const buyTicket = async () => {
    if (tickets >= MAX_EXAM_TICKETS || !spendGears(EXAM_TICKET_COST)) return;
    setStore(await addExamTicket());
    setNotice("");
  };

  const start = async (cert: CertDef) => {
    if (loading || !canStart) return;
    setNotice("");
    setLoading(cert.name);
    try {
      const p = await buildExam(cert);
      if (!p.items.length) throw new Error("empty");
      setStore(await countExamStart(useTicket));
      setAnswers([]);
      setResult(null);
      setPaper(p);
    } catch {
      setNotice("문제를 불러오지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setLoading(null);
    }
  };

  const quit = () =>
    showDialog({
      icon: "door",
      title: "모의고사를 그만둘까요?",
      message: premium ? "지금까지 푼 문제는 채점되지 않아요." : "지금까지 푼 문제는 채점되지 않고, 쓴 무료 횟수나 1회권은 돌아오지 않아요.",
      buttons: [
        { text: "계속 풀기", style: "cancel" },
        { text: "그만두기", style: "destructive", onPress: () => setPaper(null) },
      ],
    });

  // ───────── 준비 중 ─────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
        <ActivityIndicator size="large" color={c.accent} />
        <T size={17} weight="semibold" center>{loading} 모의고사를 준비하고 있어요</T>
        <T size={14} color="muted" center>과목마다 {EXAM_PER_SUBJECT}문제씩 골고루 뽑고 있어요.</T>
      </SafeAreaView>
    );
  }

  // ───────── 문제 풀기 ─────────
  if (paper && !result) {
    const idx = Math.min(answers.length, paper.items.length - 1);
    const item = paper.items[idx];
    return (
      <QuestionView
        key={idx}
        q={item.q}
        index={idx}
        count={paper.items.length}
        topicName={item.topic.ko}
        badges={<Row gap={6}><Badge label={`${item.subject + 1}과목`} tone="navy" /><Badge label={paper.subjects[item.subject]} /></Row>}
        saving={false}
        onQuit={quit}
        onNext={(a) => {
          const next = [...answers, a];
          setAnswers(next);
          if (next.length >= paper.items.length) {
            const r = gradeExam(paper, next);
            setResult(r);
            const at = new Date().toISOString();
            const wrongs = paper.items.filter((x, i) => !isCorrect(x.q, next[i]))
              .map((x) => ({ topicId: x.topic.id, q: x.q.q, answer: answerText(x.q), explain: x.q.explain, at }));
            saveExamResult(r, wrongs).then(setStore);
          }
        }}
      />
    );
  }

  // ───────── 결과 ─────────
  if (paper && result) {
    const cert = certById(paper.certId);
    const wrong = paper.items.map((x, i) => ({ x, i })).filter(({ x, i }) => !isCorrect(x.q, answers[i]));
    return (
      <Screen scroll>
        <View style={{ alignItems: "center", gap: 6, paddingTop: 8 }}>
          <Icon name={result.pass ? "trophy" : "target"} size={72} />
          <T size={15} color="ink2">{cert?.name} 모의고사</T>
          <T size={32} weight="bold" color={result.pass ? "success" : "accent"}>{result.pass ? "합격권이에요!" : "아직 불합격권이에요"}</T>
          <T size={17} weight="semibold">평균 {pct(result.score, result.total)}점 · {result.score} / {result.total}문제</T>
          <T size={13} color="muted" center>
            합격 기준: 과목마다 {EXAM_SUBJECT_MIN * 100}점 이상, 평균 {EXAM_TOTAL_MIN * 100}점 이상
          </T>
        </View>

        <SectionTitle title="과목별 점수" />
        <Card style={{ gap: 14 }}>
          {result.subjects.map((s, i) => {
            const fail = subjectFailed(s);
            return (
              <View key={s.name} style={{ gap: 6 }}>
                <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <T size={15} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{i + 1}과목 · {s.name}</T>
                  <Row gap={6} style={{ flexWrap: "nowrap" }}>
                    {fail && <Badge label="과락" tone="accent" />}
                    <T size={15} weight="bold" color={fail ? "accent" : "ink"}>{pct(s.score, s.total)}점</T>
                  </Row>
                </Row>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
                  <View style={{ width: `${pct(s.score, s.total)}%`, height: "100%", borderRadius: 5, backgroundColor: fail ? c.accent : c.success }} />
                </View>
                <T size={12} color="muted">{s.score} / {s.total}문제</T>
              </View>
            );
          })}
        </Card>

        {wrong.length > 0 && (
          <>
            <SectionTitle title={`틀린 문제 ${wrong.length}개`} />
            {wrong.map(({ x, i }) => (
              <Card key={i} style={{ gap: 6 }}>
                <T size={12} color="muted">{x.subject + 1}과목 · {paper.subjects[x.subject]} · {x.topic.ko}</T>
                <T size={15} weight="semibold">{x.q.q}</T>
                <T size={14} color="success" weight="semibold">정답: {answerText(x.q)}</T>
                <T size={14} color="ink2">{x.q.explain}</T>
              </Card>
            ))}
          </>
        )}

        {wrong.length > 0 && <Btn title={premium ? "틀린 문제 변형해서 다시 풀기" : "틀린 문제 다시 풀기 (프리미엄)"} variant="premium" icon={<Icon name="crown" size={24} />} onPress={() => router.push("/review")} />}
        <Btn title="모의고사 목록으로" variant="primary" size="lg" onPress={() => { setPaper(null); setResult(null); }} />
        <Btn title="닫기" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  // ───────── 자격증 고르기 ─────────
  const mine = CERTS.filter((x) => prefs.interests.includes(x.id));
  const others = CERTS.filter((x) => !prefs.interests.includes(x.id));
  const lastOf = (id: string) => store?.results.find((r) => r.certId === id);

  const card = (cert: CertDef) => {
    const last = lastOf(cert.id);
    return (
      <View key={cert.id} style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, borderBottomWidth: 5, borderBottomColor: c.paperEdge, backgroundColor: c.paper, padding: 16, gap: 10, ...shadow(c, 1) }}>
        <Row gap={12} style={{ flexWrap: "nowrap" }}>
          <Icon name="medal" size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={18} weight="bold">{cert.name}</T>
            <T size={13} color="ink2">{cert.subjects.length}과목 · {cert.subjects.length * EXAM_PER_SUBJECT}문제</T>
            <T size={12} color="muted">{cert.subjects.map((s) => s.name).join(" · ")}</T>
          </View>
        </Row>
        {last && (
          <Row gap={8} style={{ flexWrap: "nowrap" }}>
            <Badge label={last.pass ? "합격권" : "불합격권"} tone={last.pass ? "navy" : "accent"} />
            <T size={13} color="muted" style={{ flex: 1 }} numberOfLines={1}>지난 결과 평균 {pct(last.score, last.total)}점 · {fmtDate(last.at)}</T>
          </Row>
        )}
        <Btn title="모의고사 시작" variant="accent" onPress={() => start(cert)} disabled={!store || !canStart} />
      </View>
    );
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">자격증 모의고사</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">
        실제 시험처럼 과목별로 풀고, 과목마다 {EXAM_SUBJECT_MIN * 100}점 이상 · 평균 {EXAM_TOTAL_MIN * 100}점 이상이면 합격권이에요.
      </T>

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, borderColor: premium ? c.gold : c.line }}>
        <Icon name={premium ? "crown" : "ticket"} size={32} />
        <View style={{ flex: 1 }}>
          <T size={15} weight="bold">{premium ? "프리미엄 · 무제한" : `오늘 무료 ${left} / ${FREE_EXAMS_PER_DAY}회 남음${tickets ? ` · 1회권 ${tickets}개` : ""}`}</T>
          <T size={13} color="muted">{premium ? "횟수 제한 없이 볼 수 있어요." : useTicket && tickets ? "무료 횟수를 다 써서 1회권으로 봐요." : "무료는 하루 1회, 더 보려면 1회권이나 프리미엄이 필요해요."}</T>
        </View>
      </Card>
      {!premium && store && left <= 0 && tickets < MAX_EXAM_TICKETS && (
        <Btn
          title={`모의고사 1회권 사기 · 톱니바퀴 ${EXAM_TICKET_COST}개`}
          variant="accent"
          icon={<Icon name="gear" size={22} />}
          onPress={buyTicket}
          disabled={gears < EXAM_TICKET_COST}
        />
      )}
      {!premium && store && left <= 0 && gears < EXAM_TICKET_COST && tickets === 0 && (
        <T size={13} color="accent" center>톱니바퀴가 {EXAM_TICKET_COST - gears}개 부족해요</T>
      )}
      {!premium && store && left <= 0 && (
        <Btn title="프리미엄으로 무제한 모의고사" variant="premium" icon={<Icon name="crown" size={24} />} onPress={() => router.push("/shop")} />
      )}
      {notice ? <T color="accent">{notice}</T> : null}

      {mine.length > 0 && <SectionTitle title="내가 준비 중인 자격증" />}
      {mine.map(card)}
      <SectionTitle title={mine.length ? "다른 자격증" : "자격증"} right={prefs.interests.some(isCertId) ? undefined : (
        <Pressable onPress={() => router.push("/interests")} hitSlop={8}><T size={13} color="accent" weight="semibold">준비 중인 자격증 고르기 ›</T></Pressable>
      )} />
      {others.map(card)}
    </Screen>
  );
}
