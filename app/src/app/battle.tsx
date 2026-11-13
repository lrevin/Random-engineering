import {router, useLocalSearchParams} from "expo-router";
import {useCallback, useEffect, useRef, useState} from "react";
import {AppState, View} from "react-native";
import {showDialog} from "@/components/Dialog";
import {StudyReader, type ReaderPage} from "@/components/StudyReader";
import {TopicLinks} from "@/components/TopicLinks";
import {Btn, Card, Screen, T} from "@/components/ui";
import {topicById} from "@/data";
import {useApp} from "@/lib/app-state";
import {answerBattle, forfeitBattle, getBattle, serverNow, setStudySkip, socialMessage, submitBattle, submitOvertime, type Battle} from "@/lib/social";
import {fmtClock} from "@/lib/stats";
import {useKeepScreenOn} from "@/lib/useKeepScreenOn";

export default function BattleScreen(){
 useKeepScreenOn("battle");
 const {id}=useLocalSearchParams<{id:string}>();
 const {uid,refreshRecords,refreshWallet}=useApp();
 const [battle,setBattle]=useState<Battle|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[now,setNow]=useState(serverNow()),[reader,setReader]=useState<ReaderPage|null>(null);
 const pending=useRef<{key:string;answer:number|boolean}|null>(null),settled=useRef("");
 const skipPending=useRef<{id:string;agree:boolean}|null>(null);
 const acceptState=useCallback((next:Battle)=>{
  const pendingVote=skipPending.current;
  if(pendingVote?.id===next.id&&(next.phase!=="study"||next.studySkip?.myAgreed===pendingVote.agree))skipPending.current=null;
  setBattle(current=>current?.id===next.id&&(current.revision??0)>(next.revision??0)?current:next);
 },[]);
 const polling=useRef(false);
 const refresh=useCallback(async()=>{if(polling.current)return;polling.current=true;try{acceptState(await getBattle(id));setError("");}catch(e){setError(socialMessage(e));}finally{polling.current=false;}},[id,acceptState]);
 useEffect(()=>{void Promise.resolve().then(refresh);const timer=setInterval(()=>void refresh(),1000);const active=AppState.addEventListener("change",s=>{if(s==="active")void refresh();});return()=>{clearInterval(timer);active.remove();};},[refresh]);
 useEffect(()=>{const timer=setInterval(()=>setNow(serverNow()),250);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(!battle||!["finished","void"].includes(battle.status)||settled.current===battle.id)return;
  let alive=true;Promise.all([refreshRecords(),refreshWallet()]).then(()=>{if(alive)settled.current=battle.id;}).catch(()=>{if(alive)setError("결과를 갱신하지 못했어요. 다시 확인해 주세요.");});
  return()=>{alive=false;};
 },[battle,refreshRecords,refreshWallet]);
 const b=battle,ot=b?.overtime,position=b?.myAnswers.findIndex(a=>a===null)??-1;
 const question=b?.phase==="overtime"?ot?.question:position>=0?b?.questions?.[position]:null;
 const submitted=b?.phase==="overtime"?ot?.mySubmitted:b?.mySubmitted;
 const key=b?.phase==="overtime"?"ot:"+ot?.round:"main:"+position;

 async function answer(value:number|boolean){
  if(!b||busy)return;const choice=pending.current?.key===key?pending.current.answer:value;pending.current={key,answer:choice};setBusy(true);
  try{const result=b.phase==="overtime"?await submitOvertime(id,ot!.round,choice):await answerBattle(id,position+1,choice);pending.current=null;acceptState(result);setError("");}catch(e){setError(socialMessage(e));}finally{setBusy(false);}
 }
 async function finishEarly(){if(busy)return;setBusy(true);try{acceptState(await submitBattle(id));}catch(e){setError(socialMessage(e));}finally{setBusy(false);}}
 async function toggleStudySkip(){
  if(!b||b.phase!=="study"||busy)return;
  const agree=skipPending.current?.id===id?skipPending.current.agree:!b.studySkip?.myAgreed;
  skipPending.current={id,agree};setBusy(true);
  try{const result=await setStudySkip(id,agree);skipPending.current=null;acceptState(result);setError("");}catch(e){setError(socialMessage(e));}finally{setBusy(false);}
 }
 function forfeit(){showDialog({title:"배틀을 포기할까요?",message:"포기하면 패배로 처리되며 배틀권은 반환되지 않아요.",buttons:[{text:"계속하기"},{text:"포기하기",onPress:async()=>{setBusy(true);try{acceptState(await forfeitBattle(id));}catch(e){setError(socialMessage(e));}finally{setBusy(false);}}}]});}
 const topic=b?.topicId?topicById(b.topicId):undefined;
 const end=b?.phase==="countdown"?b.startAt:b?.phase==="study"?b.quizStartAt:b?.phase==="overtime"&&ot?.roundStartAt?new Date(Date.parse(ot.roundStartAt)+ot.roundSec*1000).toISOString():b?.quizEndAt;
 const left=Math.max(0,Math.ceil(((end?Date.parse(end):now)-now)/1000));
 const finished=b?.status==="finished"||b?.status==="void",mine=b?.results[uid],other=b?(b.from.uid===uid?b.to:b.from):null;
 return <Screen>
  {!!error&&<Card><T color="accent">{error}</T><Btn title="진행 상태 다시 확인" onPress={()=>void refresh()}/></Card>}
  {!b?<T>배틀을 불러오고 있어요.</T>:<>
   <T size={22} weight="bold">{other?.nickname}님과 배틀</T>
   {topic&&<T>{topic.ko}</T>}
   {!finished&&<T size={28} weight="bold">{fmtClock(left)}</T>}
   {b.phase==="countdown"&&<T>잠시 후 같은 주제로 학습을 시작해요.</T>}
   {b.phase==="study"&&<><T>10분 동안 학습해요. 연결이 끊겨도 시간은 계속 흘러요.</T>{topic&&<TopicLinks topic={topic} onOpen={(url,title)=>setReader({url,title})}/>}<StudyReader page={reader} left={left} total={b.studySec} running onClose={()=>setReader(null)}/>
    <Btn title={`학습 스킵 ${b.studySkip?.count??0}/2${b.studySkip?.myAgreed?" · 동의 취소":""}`} variant={b.studySkip?.myAgreed?"accent":"outline"} loading={busy} onPress={()=>void toggleStudySkip()}/>
    <T size={13} color="muted">두 명 모두 동의하면 바로 문제 풀이를 시작해요. 다시 누르면 동의를 취소할 수 있어요.</T>
   </>}
   {(b.phase==="quiz"||b.phase==="overtime")&&<Card style={{gap:12}}>
    <T>{b.phase==="overtime"?`연장전 ${(ot?.round??0)+1} / 5`:`본 문제 ${Math.min(position+1,5)} / 5`}</T>
    {submitted?<T>답안을 저장했어요. 상대의 제출을 기다려요.</T>:question?<>
     <T size={20} weight="semibold">{question.q}</T>
     {question.type==="mc"?question.choices.map((choice,i)=><Btn key={i} title={choice} disabled={busy||left===0} onPress={()=>void answer(i)}/>):<View style={{gap:8}}><Btn title="O (참)" disabled={busy||left===0} onPress={()=>void answer(true)}/><Btn title="X (거짓)" disabled={busy||left===0} onPress={()=>void answer(false)}/></View>}
     {!!error&&<T color="muted">연결을 확인한 뒤 다시 누르면 처음 고른 답안을 재전송해요.</T>}
    </>:<T>다음 문제가 시작되기를 기다려요.</T>}
    {b.phase==="quiz"&&!submitted&&<Btn title="현재 답안으로 제출" disabled={busy} onPress={()=>void finishEarly()}/>}
   </Card>}
   {b.phase==="submitted"&&<T>제출했어요. 상대의 제출 또는 제한 시간 종료를 기다려요.</T>}
   {finished&&<Card style={{gap:10}}>
    <T size={26} weight="bold">{b.status==="void"?"배틀 무효":!b.outcome?.winner?"무승부":b.outcome.winner===uid?"승리":"패배"}</T>
    <T>{b.status==="void"?"서버 문제 또는 참여 불가로 취소됐어요. 배틀권을 반환하며 XP는 변하지 않아요.":`본 문제 ${mine?.score??0} / 5 · ${b.outcome?.winner?(b.outcome.winner===uid?"+":"−")+(b.outcome.xp??0):"0"} XP`}</T>
    <T color="muted">본 문제 정답만 분야 랭크에 반영해요. 포기·무응답 기록은 학습 실적으로 인정하지 않아요.</T>
    {b.recordId&&<Btn title="문항별 풀이 기록 보기" onPress={()=>router.push({pathname:"/record/[id]",params:{id:b.recordId!}})}/>}
   </Card>}
   {!finished&&<Btn title="배틀 포기" disabled={busy} onPress={forfeit}/>}
   <Btn title={finished?"배틀 메뉴로":"화면 닫기 (시간은 계속 진행)"} onPress={()=>router.back()}/>
  </>}
 </Screen>;
}
