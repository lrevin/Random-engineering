import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { StudyReader, type ReaderPage } from "@/components/StudyReader";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, Card, levelTone, Row, Screen, T } from "@/components/ui";
import { domainById, levelText, topicById, TOPICS } from "@/data";
import { useApp } from "@/lib/app-state";
import { battleXpTransfer } from "@/lib/economy";
import { calcRp } from "@/lib/rank";
import { cancelBattle, getBattle, serverNow, socialMessage, submitBattle, type Battle } from "@/lib/social";
import { calcStreak, fmtClock, fmtStudyTime } from "@/lib/stats";
import type { WrongAnswer } from "@/lib/types";
import { useKeepScreenOn } from "@/lib/useKeepScreenOn";
import { radius, useColors } from "@/theme";
import { answerText, isCorrect, QuestionView } from "./quiz";

type Phase = "loading" | "waiting" | "closed" | "countdown" | "study" | "quiz" | "submitted" | "result";
const REVEAL_MS = 1600; // 시작하면 슬롯처럼 주제를 돌린 뒤 공개

export default function BattleScreen() {
  useKeepScreenOn("battle");
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, xp, records, keptDays, addRecord, applyBattleXp, claimOnce, refundBattleTicket } = useApp();
  const c = useColors();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(serverNow());
  const [answers, setAnswers] = useState<(number | boolean)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [reader, setReader] = useState<ReaderPage | null>(null);
  const [spinName, setSpinName] = useState("");
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);

  // 서버에서 배틀 상태 받기
  const refresh = useCallback(() => {
    if (!id) return;
    getBattle(id).then((b) => { setBattle(b); setErr(""); }).catch((e) => setErr(socialMessage(e)));
  }, [id]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  // 시계 (서버 시각 기준)
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(t);
  }, []);

  const me = battle?.from.uid === uid ? "from" : "to";
  const opp = battle ? (me === "from" ? battle.to : battle.from) : null;
  const oppName = opp?.nickname ?? "친구";
  const topic = battle?.topicId ? topicById(battle.topicId) : undefined;
  const start = battle?.startAt ? Date.parse(battle.startAt) : 0;
  const studyEnd = start + (battle?.studySec ?? 0) * 1000;
  const quizEnd = studyEnd + (battle?.quizSec ?? 0) * 1000;
  const mySubmitted = submitted || !!(battle && battle.results[uid]);

  const phase: Phase = !battle ? "loading"
    : battle.status === "pending" ? "waiting"
      : battle.status === "finished" ? "result"
        : battle.status !== "accepted" ? "closed"
          : now < start ? "countdown"
            : now < studyEnd ? "study"
              : mySubmitted ? "submitted"
                : "quiz";

  // 주제 공개 연출: 시작 직후 잠깐 같은 분야 주제 이름을 돌림
  const revealing = phase === "study" && now - start < REVEAL_MS;
  // '아무 분야'(any) 매칭이면 전체 주제에서 돌림
  const pool = useMemo(() => (!battle ? [] : battle.domain === "any" ? TOPICS : TOPICS.filter((t) => t.domain === battle.domain)), [battle?.domain]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!revealing || !pool.length) return;
    const t = setInterval(() => setSpinName(pool[Math.floor(Math.random() * pool.length)].ko), 70);
    return () => clearInterval(t);
  }, [revealing, pool]);

  // 퀴즈 제출 (다 풀었거나, 시간이 끝났거나, 포기했을 때)
  const submit = useCallback(async (final: (number | boolean)[]) => {
    if (!battle || !battle.questions || submitting.current) return;
    submitting.current = true;
    setSending(true);
    const qs = battle.questions;
    const score = qs.filter((q, i) => isCorrect(q, final[i])).length;
    try {
      const b = await submitBattle(battle.id, { score, total: qs.length, xp });
      setBattle(b);
      setSubmitted(true);
      // 배틀도 공부한 기록으로 남김 (연속 일수 · 주제 랭크 · 기본 경험치)
      if (topic && claimOnce("rec:" + battle.id)) {
        const wrong: WrongAnswer[] = qs.filter((q, i) => !isCorrect(q, final[i])).map((q) => ({ q: q.q, answer: answerText(q), explain: q.explain }));
        const st = calcStreak(records, new Date(), keptDays);
        const rp = calcRp({ topic, correct: score, total: qs.length, priorAttempts: records.filter((r) => r.topicId === topic.id).length, streak: st.today ? st.streak : st.streak + 1 });
        addRecord({
          topicId: topic.id, topicKo: topic.ko, domain: topic.domain, category: topic.category, level: topic.level,
          memo: `⚔️ ${oppName}님과 배틀`, score, total: qs.length, rp: rp.total, wrong, studySec: battle.studySec,
          quizSource: qs.some((q) => q.src === "ai") ? "ai" : qs.some((q) => q.src === "bank") ? "bank" : "offline",
        }).catch(() => {});
      }
    } catch (e) {
      setErr(socialMessage(e));
      submitting.current = false;
    } finally {
      setSending(false);
    }
  }, [battle, xp, topic, claimOnce, records, keptDays, addRecord, oppName]);

  // 퀴즈 시간이 끝나면 푼 데까지 자동 제출
  const inQuiz = phase === "quiz";
  useEffect(() => {
    if (!inQuiz) return;
    const t = setTimeout(() => submit(answers), Math.max(0, quizEnd - serverNow()));
    return () => clearTimeout(t);
  }, [inQuiz, quizEnd, answers, submit]);

  // 결과: 경험치 반영 (한 번만)
  useEffect(() => {
    if (battle?.status !== "finished" || !battle.outcome) return;
    const { winner, xp: amount } = battle.outcome;
    if (winner) applyBattleXp(battle.id, winner === uid ? amount : -amount);
  }, [battle, uid, applyBattleXp]);

  // 신청이 거절·만료·취소되면 배틀권 돌려받기 (신청한 사람만, 한 번만)
  useEffect(() => {
    if (battle && me === "from" && ["declined", "expired", "canceled"].includes(battle.status) && claimOnce("refund:" + battle.id)) refundBattleTicket();
  }, [battle, me, claimOnce, refundBattleTicket]);

  const leave = () => router.replace("/arena");

  // ───────── 화면 ─────────
  if (phase === "loading") {
    return (
      <Screen contentStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        {err ? <><T size={16} center>{err}</T><Btn title="돌아가기" onPress={leave} /></> : <ActivityIndicator size="large" color={c.accent} />}
      </Screen>
    );
  }
  const b = battle!;
  const d = domainById(b.domain);
  const header = (
    <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
      <Badge label={`⚔️ ${d ? `${d.emoji} ${d.name}` : "🎲 랜덤 분야"} 배틀`} tone="accent" />
      <T size={14} color="ink2">vs {opp?.nickname}</T>
    </Row>
  );

  if (phase === "waiting") {
    const left = Math.max(0, 120 - Math.floor((now - Date.parse(b.createdAt)) / 1000));
    return (
      <Screen contentStyle={{ flex: 1, justifyContent: "center" }}>
        {header}
        <Card style={{ alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={c.accent} />
          <T size={19} weight="bold" center>{opp?.nickname}님의 응답을 기다리고 있어요</T>
          <T size={14} color="muted" center>{fmtClock(left)} 안에 수락하지 않으면 신청이 취소되고 배틀권을 돌려받아요.</T>
        </Card>
        <Btn title="신청 취소" onPress={() => cancelBattle(b.id).then(setBattle).catch((e) => setErr(socialMessage(e)))} />
        {err ? <T size={13} color="accent" center>{err}</T> : null}
      </Screen>
    );
  }

  if (phase === "closed") {
    const why = { declined: "상대가 배틀을 거절했어요.", expired: "상대가 응답하지 않아 신청이 취소됐어요.", canceled: "배틀 신청을 취소했어요." }[b.status as "declined"] ?? "배틀이 열리지 않았어요.";
    return (
      <Screen contentStyle={{ flex: 1, justifyContent: "center" }}>
        {header}
        <Card style={{ alignItems: "center", gap: 8 }}>
          <T size={36}>🙅</T>
          <T size={18} weight="bold" center>{why}</T>
          {me === "from" && <T size={14} color="muted" center>배틀권은 돌려받았어요.</T>}
        </Card>
        <Btn title="배틀 메뉴로" variant="primary" size="lg" onPress={leave} />
      </Screen>
    );
  }

  if (phase === "countdown") {
    return (
      <Screen contentStyle={{ flex: 1, justifyContent: "center", alignItems: "stretch" }}>
        {header}
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 30 }}>
          <T size={16} color="ink2">두 사람에게 같은 주제가 곧 뽑혀요</T>
          <T size={96} weight="bold" color="accent" style={{ lineHeight: 110 }}>{Math.max(1, Math.ceil((start - now) / 1000))}</T>
          <T size={14} color="muted">공부 {fmtStudyTime(b.studySec)} · 퀴즈 7문제 · 시간 추가 없음</T>
        </View>
      </Screen>
    );
  }

  if (phase === "study") {
    const left = (studyEnd - now) / 1000;
    return (
      <Screen scroll>
        {header}
        <Card style={{ alignItems: "center", gap: 8, borderTopWidth: 4, borderTopColor: c.accent }}>
          {revealing || !topic ? (
            <T size={30} weight="bold" color="ink2" center>{spinName || "…"}</T>
          ) : (
            <>
              <Row gap={6} style={{ justifyContent: "center" }}>
                <Badge label={topic.categoryName} />
                <Badge label={levelText(topic.lv)} tone={levelTone(topic.level)} />
              </Row>
              <T size={30} weight="bold" center>{topic.ko}</T>
              <T size={14} color="muted" center>{topic.en}</T>
              <T size={15} color="ink2" center>{topic.hint}</T>
            </>
          )}
        </Card>
        <View style={{ alignItems: "center", gap: 2 }}>
          <T size={56} weight="bold" style={{ lineHeight: 66 }}>{fmtClock(left)}</T>
          <T size={13} color="muted">두 사람 모두 같은 시각에 퀴즈로 넘어가요 · 시간 추가 없음</T>
        </View>
        {topic && !revealing && <TopicLinks topic={topic} onOpen={(url, title) => setReader({ url, title })} />}
        <StudyReader page={phase === "study" ? reader : null} left={left} total={b.studySec} running onClose={() => setReader(null)} />
      </Screen>
    );
  }

  if (phase === "quiz" && b.questions) {
    const qs = b.questions;
    const idx = Math.min(answers.length, qs.length - 1);
    return (
      <QuestionView
        key={idx}
        q={qs[idx]}
        index={idx}
        count={qs.length}
        topicName={topic?.ko ?? ""}
        badges={<Row gap={6}><Badge label="⚔️ 배틀" tone="accent" /><Badge label={`⏱ ${fmtClock((quizEnd - now) / 1000)}`} /></Row>}
        saving={sending}
        onQuit={() => {
          showDialog({
            icon: "⚔️",
            title: "배틀을 끝낼까요?",
            message: "지금까지 푼 문제로 채점돼요. 안 푼 문제는 틀린 것으로 처리돼요.",
            buttons: [
              { text: "계속 풀기", style: "cancel" },
              { text: "제출하기", style: "destructive", onPress: () => submit(answers) },
            ],
          });
        }}
        onNext={(a) => {
          const next = [...answers, a];
          setAnswers(next);
          if (next.length >= qs.length) submit(next);
        }}
      />
    );
  }

  if (phase === "submitted") {
    return (
      <Screen contentStyle={{ flex: 1, justifyContent: "center" }}>
        {header}
        <Card style={{ alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={c.accent} />
          <T size={18} weight="bold" center>{opp?.nickname}님이 다 풀 때까지 기다리고 있어요</T>
          <T size={14} color="muted" center>내 점수 {b.results[uid]?.score ?? "-"} / {b.results[uid]?.total ?? b.questions?.length ?? 7}</T>
          <T size={13} color="muted" center>퀴즈 시간이 끝나면 그때까지 푼 문제로 채점돼요. ({fmtClock(Math.max(0, (quizEnd - now) / 1000))})</T>
        </Card>
        {err ? <T size={13} color="accent" center>{err}</T> : null}
      </Screen>
    );
  }

  // 결과
  const mine = b.results[uid];
  const theirs = opp ? b.results[opp.uid] : undefined;
  const winner = b.outcome?.winner ?? null;
  const amount = b.outcome?.xp ?? 0;
  const won = winner === uid;
  const draw = !winner;
  return (
    <Screen scroll>
      {header}
      <View style={{ alignItems: "center", gap: 6, paddingTop: 10 }}>
        <T size={56}>{draw ? "🤝" : won ? "🏆" : "😵"}</T>
        <T size={28} weight="bold" center color={draw ? "ink" : won ? "success" : "accent"}>{draw ? "무승부" : won ? "승리!" : "패배"}</T>
        <T size={15} color="ink2" center>{topic?.ko}</T>
      </View>
      <Row gap={12} style={{ flexWrap: "nowrap" }}>
        {[["나", mine], [opp?.nickname ?? "상대", theirs]].map(([name, r], i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4, padding: 16, borderRadius: radius.lg, backgroundColor: c.paper, borderWidth: 1.5, borderColor: (i === 0) === won && !draw ? c.success : c.line }}>
            <T size={14} color="muted" numberOfLines={1}>{name as string}</T>
            <T size={40} weight="bold">{(r as typeof mine)?.score ?? 0}<T size={18} color="muted"> / {(r as typeof mine)?.total ?? b.questions?.length ?? 7}</T></T>
            {!r && <T size={12} color="accent">제출 안 함</T>}
          </View>
        ))}
      </Row>
      <Card style={{ alignItems: "center", gap: 4 }}>
        <T size={16} weight="bold" center>
          {draw ? "점수가 같아 경험치는 그대로예요." : won ? `${opp?.nickname}님의 경험치 ${amount} XP를 가져왔어요!` : `경험치 ${amount} XP를 ${opp?.nickname}님에게 뺏겼어요.`}
        </T>
        <T size={13} color="muted" center>진 사람 누적 경험치의 5% (최대 {battleXpTransfer(1e9)} XP)</T>
      </Card>
      <Btn title="배틀 메뉴로" variant="primary" size="lg" onPress={leave} />
    </Screen>
  );
}
