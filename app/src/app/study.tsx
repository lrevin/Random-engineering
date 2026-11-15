import {readStudyEvent,saveStudyEvent,clearStudyEvent} from "@/lib/activity-cache";
import * as Crypto from "expo-crypto";
import {mysqlAuth,authErrorMessage} from "@/lib/auth";
import { useKeepScreenOn } from "@/lib/useKeepScreenOn";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, useWindowDimensions, View } from "react-native";
import { Ring } from "@/components/Ring";
import { StudyReader, type ReaderPage } from "@/components/StudyReader";
import { EXTEND_COST, EXTEND_SECONDS, TimeUpSheet } from "@/components/TimeUpSheet";
import { TopicLinks } from "@/components/TopicLinks";
import { Badge, Btn, levelTone, Row, Screen, T } from "@/components/ui";
import { levelText, topicById } from "@/data";
import { useApp } from "@/lib/app-state";
import { confirmQuit } from "@/lib/confirm";
import { prefetchQuiz } from "@/lib/quiz";
import { useStageTimer } from "@/lib/useStageTimer";
import { radius, useColors } from "@/theme";

export default function Study() {
  const { active } = useApp();
  if (!active || active.stage !== "study") return <Redirect href="/" />;
  return <StudyInner />;
}

function StudyInner() {
  useKeepScreenOn("study");
  const { mode, active, setActive, gears, spendGears, refreshWallet } = useApp();
  const c = useColors();
  const { width } = useWindowDimensions();
  const topic = topicById(active!.topicId);
  // 앱 안 문서 창 (웹에서는 react-native-webview가 없어서 새 탭으로 엶)
  const [reader, setReader] = useState<ReaderPage | null>(null);

  const [serverReady,setServerReady]=useState(mode!=='user');
  const [notice,setNotice]=useState('');
  const [working,setWorking]=useState(false);
  const requestId=useRef(active!.serverAttemptId??Crypto.randomUUID());
  const pending=useRef(active!.serverPendingEvent);
  const event=async(name:'pause'|'resume'|'quiz'|'extend')=>{
    if(!active?.serverTracking)throw new Error('verification_required');
    if(pending.current&&pending.current.event!==name)throw new Error('operation_pending');
    const p=pending.current??{event:name,id:Crypto.randomUUID()};pending.current=p;
    setActive(a=>a?{...a,serverPendingEvent:p}:a);
    await saveStudyEvent({attemptId:requestId.current,...p});
    const value=await mysqlAuth.activityEvent(requestId.current,name,p.id);
    await clearStudyEvent();
    pending.current=undefined;setActive(a=>a?{...a,serverPendingEvent:undefined}:a);return value;
  };
  const goQuiz = async () => {
    if(working||!serverReady)return;
    setWorking(true);setNotice('');
    try{
      const value=mode==='user'&&active?.serverTracking?await event('quiz'):null;
      const stopped=timer.stop();
      setActive(a=>a?{...a,stage:'quiz',endAt:null,studyLeft:stopped.left,studyUsed:stopped.used,...(value?{studyUsed:value.studySec,quiz:{source:value.items.some(i=>i.question.src==='offline')?'offline':'bank',questions:value.items.map(i=>i.question),answers:[]}}:{})}:a);
      router.replace('/quiz');
    }catch(e){setNotice(authErrorMessage(e));}finally{setWorking(false);}
  };

  // 공부 시간이 끝나면 보고 있던 문서 창을 강제로 닫고 '시간 추가 / 퀴즈' 창을 띄움
  const timer = useStageTimer("study", useCallback(() => {
    setReader(null);
    setActive((a) => (a ? { ...a, studyLeft: 0, studyUsed: a.studyTotal } : a));
  }, [setActive]));
  // 앱을 껐다 켜도 시간이 끝난 상태면 같은 창이 다시 뜸
  const timeUp = !timer.running && timer.left <= 0;
  const extend = async () => {
    if(working||!serverReady)return;setWorking(true);setNotice('');
    try{if(mode==='user'&&active?.serverTracking){await event('extend');await refreshWallet();timer.extend(EXTEND_SECONDS);}else if(await spendGears(EXTEND_COST,'study_extend'))timer.extend(EXTEND_SECONDS);}
    catch(e){setNotice(authErrorMessage(e));}finally{setWorking(false);}
  };
  const initialize=async()=>{
    if(mode!=='user'){if(timer.fresh)timer.start();return;}
    setWorking(true);setNotice('');
    try{
      const saved=await readStudyEvent();if(saved?.attemptId===requestId.current)pending.current=saved;
      setActive(a=>a?{...a,serverAttemptId:requestId.current}:a);
      const value=saved?.attemptId===requestId.current?await mysqlAuth.activityEvent(saved.attemptId,saved.event,saved.id):active!.serverTracking?await mysqlAuth.getActivity(requestId.current):await mysqlAuth.issueActivity({requestId:requestId.current,purpose:'study',topicId:active!.topicId,studySec:active!.studyTotal});
      if(value.status!=='issued')throw new Error('activity_closed');
      if(saved?.attemptId===requestId.current){await clearStudyEvent();pending.current=undefined;}
      setActive(a=>a?{...a,serverAttemptId:value.id,serverTracking:true,serverPendingEvent:undefined}:a);setServerReady(true);
      if(value.studyEndedAt){
        timer.stop();setActive(a=>a?{...a,stage:'quiz',endAt:null,studyUsed:value.studySec,quiz:{source:value.items.some(i=>i.question.src==='offline')?'offline':'bank',questions:value.items.map(i=>i.question),answers:[]}}:a);router.replace('/quiz');return;
      }
      timer.restore(value.allowedSec,Math.max(0,value.allowedSec-value.studySec),!value.paused);
    }catch(e){setNotice(authErrorMessage(e));}finally{setWorking(false);}
  };
  useEffect(()=>{void Promise.resolve().then(initialize);if(topic)prefetchQuiz(topic);
    // 같은 학습을 복원하므로 시작 요청 UUID를 유지한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const toggle=async()=>{
    if(working||!serverReady)return;setWorking(true);setNotice('');
    try{if(mode==='user'&&active?.serverTracking)await event(timer.running?'pause':'resume');timer.toggle();}
    catch(e){setNotice(authErrorMessage(e));}finally{setWorking(false);}
  };
  const skip=()=>{void goQuiz();};

  if (!topic) return null;
  const ringSize = Math.min(220, width * 0.5);

  return (
    <>
      <Screen scroll>
        {!!notice&&<><T color="accent">{notice}</T><Btn title="서버 연결 다시 확인" disabled={working} onPress={()=>{void initialize();}}/>{!serverReady&&<Btn title="기기에 저장하며 학습 계속" onPress={()=>{setActive(a=>a?{...a,serverTracking:false}:a);setServerReady(true);setNotice("서버 학습 시간 확인 없이 진행해요. 답안은 기기에 보관하고 연결 후 전송해요.");if(timer.fresh)timer.start();}}/>}</>}
        {working&&<T color="muted">서버에 진행을 확인하고 있어요.</T>}
        <View style={{ alignSelf: "center", borderWidth: 1, borderColor: c.accent, backgroundColor: c.accentSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 2 }}>
          <T size={13} color="accent" weight="medium">AI 사용 금지 · 위키·백과사전만</T>
        </View>

        <View style={{ alignItems: "center", gap: 6 }}>
          <Row gap={6} style={{ justifyContent: "center" }}>
            <Badge label={topic.categoryName} />
            <Badge label={levelText(topic.lv)} tone={levelTone(topic.level)} />
          </Row>
          <T size={28} weight="bold" center style={{ letterSpacing: -0.6, lineHeight: 36 }}>{topic.ko}</T>
          <T size={14} color="muted" center>{topic.en}</T>
        </View>

        <View style={{ alignItems: "center", gap: 14 }}>
          <Ring size={ringSize} left={timer.left} total={timer.total} running={timer.running} />
          <Row style={{ justifyContent: "center" }}>
            <Btn title={timer.running ? "일시정지" : "공부 시작"} variant={timer.running ? "accent" : "primary"} disabled={working||!serverReady} onPress={()=>{void toggle();}} />
            <Btn title="공부 끝 → 퀴즈" disabled={working||!serverReady} onPress={skip} />
          </Row>
        </View>

        <TopicLinks topic={topic} onOpen={Platform.OS === "web" ? undefined : (url, title) => setReader({ url, title })} />


        <Pressable onPress={() => confirmQuit(() => { if(active?.serverTracking)void mysqlAuth.abandonActivity(requestId.current).catch(()=>{});setActive(null); router.replace("/home"); })} style={{ alignSelf: "center" }} hitSlop={8}>
          <T size={14} color="muted" style={{ textDecorationLine: "underline" }}>그만두기</T>
        </Pressable>
      </Screen>
      <TimeUpSheet visible={timeUp&&serverReady&&!working} gears={gears} onExtend={extend} onQuiz={goQuiz} />
      <StudyReader page={reader} left={timer.left} total={timer.total} running={timer.running} onClose={() => setReader(null)} />
    </>
  );
}
