import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { StudyReader, type ReaderPage } from "@/components/StudyReader";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, Card, levelTone, Row, Screen, T } from "@/components/ui";
import { categoryById, domainById, levelText, topicById, TOPICS } from "@/data";
import { useApp } from "@/lib/app-state";
import { battleXpTransfer } from "@/lib/economy";
import { calcRp } from "@/lib/rank";
import { cancelBattle, getBattle, serverNow, socialMessage, submitBattle, submitOvertime, uploadQuestions, type Battle } from "@/lib/social";
import { BATTLE_QUIZ_LENGTH, battleQuestions, OVERTIME_BATCH } from "@/lib/quiz";
import { calcStreak, fmtClock, fmtStudyTime } from "@/lib/stats";
import type { WrongAnswer } from "@/lib/types";
import { useKeepScreenOn } from "@/lib/useKeepScreenOn";
import { radius, useColors } from "@/theme";
import { answerText, isCorrect, QuestionView } from "./quiz";
import { DomainIcon, Icon } from "@/components/Icon";

type Phase = "loading" | "waiting" | "closed" | "countdown" | "study" | "preparing" | "quiz" | "submitted" | "otPreparing" | "overtime" | "otWaiting" | "result";
const REVEAL_MS = 1600; // 시작하면 슬롯처럼 주제를 돌린 뒤 공개

export default function BattleScreen() {
  useKeepScreenOn("battle");
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, xp, prefs, records, keptDays, addRecord, applyBattleXp, claimOnce, refundBattleTicket } = useApp();
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
  // 퀴즈는 공부가 끝나고 문제가 준비된 시각부터 (서버가 정함)
  const quizStart = battle?.quizStartAt ? Date.parse(battle.quizStartAt) : studyEnd;
  const quizEnd = quizStart + (battle?.quizSec ?? 0) * 1000;
  const mySubmitted = submitted || !!(battle && battle.results[uid]);
  const ot = battle?.overtime ?? null;
  const [otSent, setOtSent] = useState<number[]>([]);
  const otAnswered = !!ot && (otSent.includes(ot.round) || ot.answers[uid]?.[ot.round] != null);

  const phase: Phase = !battle ? "loading"
    : battle.status === "pending" ? "waiting"
      : battle.status === "finished" ? "result"
        : battle.status !== "accepted" ? "closed"
          : now < start ? "countdown"
            : now < studyEnd ? "study"
              : ot ? (!ot.question ? "otPreparing" : otAnswered ? "otWaiting" : "overtime")
                : mySubmitted ? "submitted"
                  : !battle.questions || now < quizStart ? "preparing"
                    : "quiz";

  // ───────── 문제 만들기 (AI가 만들고 2번 검수) ─────────
  // 매칭 배틀은 공부하는 동안 먼저 기다린 사람(from)의 앱이 5문제를 만들어 올림.
  // 그쪽이 늦거나 나가 버리면 상대 앱이 대신 만듦 (서버는 먼저 올라온 것만 인정).
  // 연장전은 문제를 2개씩 만들어 두고, 한 문제를 푸는 동안 다음 2개를 미리 만듦 (파이프라인).
  const makingRef = useRef(new Set<number>());
  const missingSince = useRef<Record<number, number>>({});
  const isMaker = me === "from";
  useEffect(() => {
    if (!battle || battle.status !== "accepted" || !topic || battle.kind !== "random") return;
    const make = (batch: number, count: number, avoid: typeof battle.questions) => {
      if (makingRef.current.has(batch)) return;
      makingRef.current.add(batch);
      battleQuestions(topic, count, avoid ?? [])
        .then((qs) => uploadQuestions(battle.id, batch, qs))
        .then(setBattle)
        .catch(() => makingRef.current.delete(batch)); // 실패하면 다음에 다시
    };
    const late = (batch: number, ms: number) => {
      missingSince.current[batch] ??= serverNow();
      return serverNow() - missingSince.current[batch] > ms;
    };
    if (!battle.questionsReady) {
      // 상대 대신 만드는 건 공부가 거의 끝나도 문제가 없을 때
      const backupAt = studyEnd - Math.min(120_000, (battle.studySec * 1000) / 3);
      if (isMaker || now > backupAt) make(0, battle.quizCount ?? BATTLE_QUIZ_LENGTH, []);
      return;
    }
    if (ot && ot.available < ot.round + 2) {
      const batch = ot.batches + 1;
      const avoid = [...(battle.questions ?? []), ...ot.past, ...(ot.question ? [ot.question] : [])];
      if (isMaker || late(batch, 25_000)) make(batch, OVERTIME_BATCH, avoid);
    }
  }, [battle, topic, isMaker, now, studyEnd, ot]);

  // 연장전 한 문제 제출 (시간이 지나면 틀린 것으로)
  const sendOvertime = useCallback((round: number, correct: boolean) => {
    if (!battle) return;
    setOtSent((s) => (s.includes(round) ? s : [...s, round]));
    submitOvertime(battle.id, round, correct).then(setBattle).catch((e) => setErr(socialMessage(e)));
  }, [battle]);
  const otEnd = ot?.roundStartAt ? Date.parse(ot.roundStartAt) + ot.roundSec * 1000 : 0;
  const inOvertime = phase === "overtime";
  const otRound = ot?.round ?? -1;
  useEffect(() => {
    if (!inOvertime) return;
    const t = setTimeout(() => sendOvertime(otRound, false), Math.max(0, otEnd - serverNow()));
    return () => clearTimeout(t);
  }, [inOvertime, otEnd, otRound, sendOvertime]);

  // 주제 공개 연출: 시작 직후 잠깐 같은 분야 주제 이름을 돌림
  const revealing = phase === "study" && now - start < REVEAL_MS;
  // '아무 분야'(any) 매칭이면 전체 주제에서 돌림
  // 매칭 배틀의 domain은 세부 분야 id(예: "os"), 예전 배틀은 분야 id(예: "it") — 둘 다 받음
  const pool = useMemo(() => {
    if (!battle) return [];
    const byCat = TOPICS.filter((t) => t.category === battle.domain);
    if (byCat.length) return byCat;
    const byDomain = TOPICS.filter((t) => t.domain === battle.domain);
    return byDomain.length ? byDomain : TOPICS;
  }, [battle?.domain]); // eslint-disable-line react-hooks/exhaustive-deps
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
          memo: `${oppName}님과 배틀`, score, total: qs.length, rp: rp.total, wrong, studySec: battle.studySec,
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
  // 배지: 주제가 공개되면 그 세부 분야, 아직이면 분야
  const d = domainById(topic?.domain ?? b.domain);
  const cat = categoryById(b.domain);
  const header = (
    <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
      <Badge label={`${cat?.name ?? d?.name ?? "랜덤"} 배틀`} tone="accent" icon={d || cat ? <DomainIcon id={d?.id ?? cat!.domain} size={20} /> : <Icon name="dice" size={20} />} />
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
          <Icon name="nope" size={56} />
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
          <T size={14} color="muted">공부 {fmtStudyTime(b.studySec)} · AI 문제 {b.quizCount ?? b.questions?.length ?? BATTLE_QUIZ_LENGTH}개 · 시간 추가 없음</T>
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
        badges={<Row gap={6}><Badge label="배틀" tone="accent" icon={<Icon name="swords" size={20} />} /><Badge label={fmtClock((quizEnd - now) / 1000)} icon={<Icon name="clock" size={18} />} /></Row>}
        saving={sending}
        onQuit={() => {
          showDialog({
            icon: "swords",
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

  if (phase === "preparing") {
    return (
      <Screen contentStyle={{ flex: 1, justifyContent: "center" }}>
        {header}
        <Card style={{ alignItems: "center", gap: 10 }}>
          <Icon name="robot" size={64} />
          <T size={18} weight="bold" center>AI가 문제를 만들고 두 번 검수하고 있어요</T>
          <T size={14} color="muted" center>문제가 준비되면 두 사람 모두 같은 순간에 퀴즈가 시작돼요. 기다리는 시간은 퀴즈 시간에서 빠지지 않아요.</T>
          <ActivityIndicator color={c.accent} />
        </Card>
        {err ? <T size={13} color="accent" center>{err}</T> : null}
      </Screen>
    );
  }

  if (phase === "otPreparing" || phase === "otWaiting") {
    const n = (ot?.round ?? 0) + 1;
    return (
      <Screen contentStyle={{ flex: 1, justifyContent: "center" }}>
        {header}
        <Card style={{ alignItems: "center", gap: 10, borderTopWidth: 4, borderTopColor: c.gold }}>
          <Icon name="swords" size={64} />
          <T size={22} weight="bold" center>연장전 {n}번째 문제</T>
          <T size={14} color="ink2" center>
            {phase === "otPreparing"
              ? "점수가 같아서 연장전이에요! AI가 새 문제를 만들고 두 번 검수하고 있어요."
              : `${opp?.nickname}님이 답할 때까지 기다리고 있어요.`}
          </T>
          <T size={13} color="muted" center>한 문제씩 같이 풀어서 한 사람만 맞히면 그 사람이 이겨요.</T>
          <ActivityIndicator color={c.accent} />
        </Card>
        {err ? <T size={13} color="accent" center>{err}</T> : null}
      </Screen>
    );
  }

  if (phase === "overtime" && ot?.question) {
    return (
      <QuestionView
        key={"ot" + ot.round}
        q={ot.question}
        index={0}
        count={1}
        topicName={`연장전 ${ot.round + 1}번째 문제`}
        badges={<Row gap={6}><Badge label="연장전" tone="accent" icon={<Icon name="swords" size={20} />} /><Badge label={fmtClock((otEnd - now) / 1000)} icon={<Icon name="clock" size={18} />} /></Row>}
        saving={false}
        onQuit={() => sendOvertime(ot.round, false)}
        onNext={(a) => sendOvertime(ot.round, isCorrect(ot.question!, a))}
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
        <Icon name={draw ? "handshake" : won ? "trophy" : "dizzy"} size={104} />
        <T size={26} weight="bold" center>{draw ? "비겼어요" : won ? "배틀에서 이겼어요!" : "아쉽게 졌어요"}</T>
        <T size={15} color="ink2" center>{topic?.ko}</T>
        {b.overtime && b.overtime.past.length > 0 && (
          <Badge label={`동점 · 연장전 ${b.overtime.past.length}문제`} tone="navy" icon={<Icon name="swords" size={20} />} />
        )}
      </View>
      <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper, overflow: "hidden" }}>
        {[
          { name: prefs.nickname || "나", r: mine, isMe: true },
          { name: opp?.nickname ?? "상대", r: theirs, isMe: false },
        ]
          // 이긴 사람이 위로 (연장전으로 이기면 점수가 같아도 위)
          .sort((x, y) => Number((y.isMe ? uid : opp?.uid) === winner) - Number((x.isMe ? uid : opp?.uid) === winner) || (y.r?.score ?? -1) - (x.r?.score ?? -1) || (x.isMe ? -1 : 1))
          .map((p, i) => (
            <View key={p.name + i} style={{
              flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16,
              backgroundColor: p.isMe ? c.successSoft : c.paper, borderTopWidth: i ? 1 : 0, borderTopColor: c.line,
            }}>
              <T size={18} weight="bold" color={p.isMe ? "success" : "ink2"} style={{ width: 18, textAlign: "center" }}>{draw ? "-" : i + 1}</T>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: p.isMe ? c.navy : c.accent }}>
                <T size={19} weight="bold" style={{ color: "#fffaf0" }}>{p.name.slice(0, 1)}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T size={17} weight="bold" color={p.isMe ? "success" : "ink"} numberOfLines={1}>{p.name}{p.isMe ? " (나)" : ""}</T>
                {!p.r && <T size={12} color="accent">제출 안 함</T>}
              </View>
              {!draw && i === 0 && <Icon name="crown" size={26} />}
              <T size={17} weight="bold" color={p.isMe ? "success" : "ink2"}>{p.r?.score ?? 0} / {p.r?.total ?? b.questions?.length ?? 7}</T>
            </View>
          ))}
      </View>
      <Card style={{ alignItems: "center", gap: 4 }}>
        {!draw && <Icon name="bolt" size={36} />}
        <T size={16} weight="bold" center>
          {draw ? (b.overtime ? "연장전에서도 승부가 나지 않아 경험치는 그대로예요." : "경험치는 그대로예요.") : won ? `${opp?.nickname}님의 경험치 ${amount} XP를 가져왔어요!` : `경험치 ${amount} XP를 ${opp?.nickname}님에게 뺏겼어요.`}
        </T>
        <T size={13} color="muted" center>진 사람 누적 경험치의 5% (최대 {battleXpTransfer(1e9)} XP)</T>
      </Card>
      <Btn title="배틀 메뉴로" variant="primary" size="lg" onPress={leave} />
    </Screen>
  );
}
