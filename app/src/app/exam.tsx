import * as Crypto from "expo-crypto";
import { mysqlAuth, authErrorMessage } from "@/lib/auth";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { showDialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Row, Screen, T } from "@/components/ui";
import { certById, topicById, CERTS, isCertId, type CertDef } from "@/data";
import { useApp } from "@/lib/app-state";
import { EXAM_TICKET_COST, FREE_EXAMS_PER_DAY, MAX_EXAM_TICKETS } from "@/lib/economy";
import {
  addExamTicket, buildExam, clearActiveExam, countExamStart, readActiveExam, saveActiveExam, EXAM_PER_SUBJECT, EXAM_SUBJECT_MIN, EXAM_TOTAL_MIN, freeExamsLeft, gradeExam,
  readExamStore, saveExamResult, subjectFailed, type ActiveExam, type ExamPaper, type ExamResult,
} from "@/lib/exam";
import { dateKey, fmtDate } from "@/lib/stats";
import { radius, screenBg, shadow, useColors } from "@/theme";
import { answerText, isCorrect, QuestionView } from "./quiz";

type Store = Awaited<ReturnType<typeof readExamStore>>;
const pct = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0);

/** 자격증 모의고사: 자격증 고르기 → 과목별 문제 풀기 → 과목별 점수와 합격 판정 */
export default function Exam() {
  const { mode, memberAssets, purchaseItem, refreshWallet, walletNotice, prefs, premium, gears, spendGears } = useApp();
  const c = useColors();
  const [store, setStore] = useState<Store | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<(number | boolean)[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const [resumed, setResumed] = useState(false);
  const [approval,setApproval]=useState<ActiveExam|null>(null);
  const [pendingExam,setPendingExam]=useState<ActiveExam|null>(null);
  useEffect(() => {
    readExamStore().then(setStore);
    // 풀다가 나간 모의고사가 있으면 이어서 (횟수·1회권은 처음 시작할 때 이미 씀)
    readActiveExam().then((a) => {
      if (!a || (a.owner??null)!==(mode==='user'?mysqlAuth.getUserId():null)) return;
      if(mode==='user' && !a.approved){setPendingExam(a);return;}
      setApproval(a);setPaper(a.paper);setAnswers(a.answers);setResumed(true);
    });
    if(mode==='user')void refreshWallet().catch(()=>{});
  }, [mode,refreshWallet]);

  const left = mode==='user'?(memberAssets?(memberAssets.examUsageDate===dateKey(new Date())?Math.max(0,1-memberAssets.examFreeUsed):1):0):(store ? freeExamsLeft(store) : 0);
  const tickets = mode==='user'?(memberAssets?.examTickets??0):(store?.tickets ?? 0);
  /** 무료 횟수를 다 쓴 무료 회원은 1회권으로 봄 */
  const useTicket = !premium && left <= 0;
  const canStart = premium || left > 0 || tickets > 0;

  const buyTicket = async () => {
    if(tickets>=MAX_EXAM_TICKETS)return;
    if(mode==='user'){if(!await purchaseItem('exam_ticket'))return;}else {if(!await spendGears(EXAM_TICKET_COST))return;setStore(await addExamTicket());}
    setNotice("");
  };

  const authorize=async(a:ActiveExam)=>{
    if(!a.startId)return null;
    const activity=await mysqlAuth.issueActivity({requestId:a.startId,purpose:'exam',certId:a.paper.certId});
    const subjects=[...new Map(activity.items.map(i=>[i.subject!,i.subjectName!])).entries()].sort((a,b)=>a[0]-b[0]).map(([,name])=>name);
    const p:ExamPaper={certId:a.paper.certId,subjects,items:activity.items.map(i=>{const topic=topicById(i.topicId);if(!topic)throw new Error('unknown_topic');return {topic,q:i.question,subject:i.subject!};})};
    const approved={...a,paper:p,approved:true,serverIssued:true};
    await saveActiveExam(approved);setApproval(approved);setPendingExam(null);await refreshWallet();return approved;
  };
  const recover=async()=>{if(!pendingExam||loading)return;setLoading('이어 풀기');try{const a=await authorize(pendingExam);if(a){setPaper(a.paper);setAnswers(a.answers);setResumed(true);}}catch{setNotice('서버 연결을 확인하고 같은 요청으로 다시 시도해 주세요.');}finally{setLoading(null);}};
  const start = async (cert: CertDef) => {
    if (loading || !canStart || pendingExam) return;
    setNotice("");
    setLoading(cert.name);
    try {
      const p:ExamPaper = mode==='user'?{certId:cert.id,subjects:cert.subjects.map(s=>s.name),items:[]}:await buildExam(cert);
      if (mode!=='user'&&!p.items.length) throw new Error("empty");
      if(mode==='user'){
        const prepared:ActiveExam={paper:p,answers:[],owner:mysqlAuth.getUserId(),startId:Crypto.randomUUID(),approved:false};
        await saveActiveExam(prepared);setPendingExam(prepared);
        const approved=await authorize(prepared);if(!approved)return;setPaper(approved.paper);
      }else {setStore(await countExamStart(useTicket));await saveActiveExam({paper:p,answers:[],owner:null});}
      setAnswers([]);
      setResult(null);
      setResumed(false);
      if(mode!=='user')setPaper(p);
      // 시작 전에 승인 복원 정보를 저장했다.
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
      message: "그만두면 채점되지 않고 사용한 횟수·이용권도 반환되지 않아요. 앱을 닫기만 하면 같은 기기에서 이어서 풀 수 있어요.",
      buttons: [
        { text: "계속 풀기", style: "cancel" },
        { text: "그만두기", style: "destructive", onPress: async () => { try{if(approval?.serverIssued&&approval.startId)await mysqlAuth.abandonActivity(approval.startId);await clearActiveExam();setPaper(null);}catch{setNotice("진행 상태를 지우지 못했어요. 다시 시도해 주세요.");} } },
      ],
    });

  if(pendingExam && !loading)return <Screen scroll><T>시험 시작 승인 결과를 확인해야 해요. 동일 요청으로 확인하므로 추가 차감되지 않아요.</T>{(walletNotice||notice)?<T color="accent">{walletNotice||notice}</T>:null}<Btn title="상점 열기" onPress={()=>router.push("/(tabs)/shop")} /><Btn title="시작 결과 다시 확인" onPress={()=>{void recover();}} /></Screen>;

  // ───────── 준비 중 ─────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, ...screenBg(c), alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
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
        badges={<Row gap={6}><Badge label={`${item.subject + 1}과목`} tone="navy" /><Badge label={paper.subjects[item.subject]} />{resumed && idx === answers.length && <Badge label="이어서 푸는 중" tone="accent" />}</Row>}
        saving={false}
        onQuit={quit}
        onNext={async(a) => {
          const next = answers.length===paper.items.length?answers:[...answers,a];
          try{
            await saveActiveExam({...approval,paper,answers:next});
            if(next.length>=paper.items.length){
              let r:ExamResult;
              if(mode==='user'&&approval?.serverIssued&&approval.startId){
                const activity=await mysqlAuth.completeActivity(approval.startId,next);
                r={certId:paper.certId,at:activity.completedAt!,score:activity.result!.score,total:activity.result!.total,pass:!!activity.result!.pass,subjects:activity.result!.subjects!};
                await refreshWallet();
              }else r=gradeExam(paper,next);
              // 서버 성공을 확인하기 전에는 진행 캐시를 지우지 않는다.
              const at=r.at,wrongs=paper.items.filter((x,i)=>!isCorrect(x.q,next[i])).map(x=>({topicId:x.topic.id,q:x.q.q,answer:answerText(x.q),explain:x.q.explain,at}));
              setStore(await saveExamResult(r,wrongs));await clearActiveExam();setResult(r);
            }
            setAnswers(next);
          }catch(error){showDialog({title:'완료를 확인하지 못했어요',message:authErrorMessage(error)+' 답안은 기기에 남아 있어요.'});}
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
      {(walletNotice || notice) ? <T color="accent">{walletNotice || notice}</T> : null}

      {mine.length > 0 && <SectionTitle title="내가 준비 중인 자격증" />}
      {mine.map(card)}
      <SectionTitle title={mine.length ? "다른 자격증" : "자격증"} right={prefs.interests.some(isCertId) ? undefined : (
        <Pressable onPress={() => router.push("/interests")} hitSlop={8}><T size={13} color="accent" weight="semibold">준비 중인 자격증 고르기 ›</T></Pressable>
      )} />
      {others.map(card)}
    </Screen>
  );
}
