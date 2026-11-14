import {router, useLocalSearchParams} from "expo-router";
import {useCallback, useEffect, useRef, useState} from "react";
import {ActivityIndicator, AppState, Pressable, View} from "react-native";
import {showDialog} from "@/components/Dialog";
import {StudyReader, type ReaderPage} from "@/components/StudyReader";
import {TopicLinks} from "@/components/TopicLinks";
import {Badge, Btn, Card, levelTone, Row, Screen, T} from "@/components/ui";
import {DomainIcon, Icon} from "@/components/Icon";
import {domainById, levelText, topicById} from "@/data";
import {useApp} from "@/lib/app-state";
import {answerBattle, forfeitBattle, getBattle, serverNow, setStudySkip, socialMessage, submitBattle, submitOvertime, type Battle} from "@/lib/social";
import {fmtClock} from "@/lib/stats";
import {sfx} from "@/lib/sfx";
import {useKeepScreenOn} from "@/lib/useKeepScreenOn";
import {battleXpTransfer} from "@/lib/economy";
import type {QuizQuestion} from "@/lib/quiz";
import {radius, raised, shadow, useColors} from "@/theme";

export default function BattleScreen(){
 useKeepScreenOn("battle");
 const {id}=useLocalSearchParams<{id:string}>();
 const {uid,prefs,refreshRecords,refreshWallet}=useApp();
 const c=useColors();
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
 // 효과음: 시작 전 3·2·1, 문제 시작, 연장 라운드, 결과 (같은 소리는 한 번만)
 const heard=useRef({phase:"",left:-1,result:""});
 const phase=b?.phase??"",resultKey=finished&&b?b.id+":"+b.status:"";
 useEffect(()=>{
  const h=heard.current;
  if(!b)return;
  if(phase!==h.phase){if(h.phase&&(phase==="quiz"||phase==="overtime"))sfx("go");h.phase=phase;h.left=-1;}
  if((phase==="countdown"||phase==="study")&&left>0&&left<=3&&left!==h.left){h.left=left;sfx("count");}
  if(resultKey&&h.result!==resultKey){h.result=resultKey;if(b.status==="finished"&&b.outcome?.winner)sfx(b.outcome.winner===uid?"victory":"defeat");}
 },[b,phase,left,resultKey,uid]);
 // ───────── 화면 (디자인은 예전 배틀 화면, 진행·채점은 모두 서버) ─────────
 if(!b){
  return <Screen contentStyle={{flex:1,justifyContent:"center",alignItems:"center",gap:12}}>
   {error?<><T size={16} center>{error}</T><Btn title="다시 확인" onPress={()=>void refresh()}/><Btn title="돌아가기" variant="ghost" onPress={()=>router.back()}/></>:<ActivityIndicator size="large" color={c.accent}/>}
  </Screen>;
 }
 const d=domainById(topic?.domain??b.domain);
 const header=<Row style={{justifyContent:"space-between",flexWrap:"nowrap"}}>
  <Badge label={`${d?.name??"랜덤"} 배틀`} tone="accent" icon={d?<DomainIcon id={d.id} size={20}/>:<Icon name="dice" size={20}/>}/>
  <T size={14} color="ink2">vs {other?.nickname}</T>
 </Row>;
 const errorLine=error?<T size={13} color="accent" center>{error}</T>:null;
 const leaveBtn=<Btn title={finished?"배틀 메뉴로":"화면 닫기 (시간은 계속 흘러요)"} variant={finished?"primary":"ghost"} size={finished?"lg":"md"} onPress={()=>router.back()}/>;

 // 시작 전 카운트다운
 if(b.phase==="countdown"){
  return <Screen contentStyle={{flex:1,justifyContent:"center"}}>
   {header}
   <View style={{alignItems:"center",gap:8,paddingVertical:30}}>
    <T size={16} color="ink2">두 사람에게 같은 주제가 곧 공개돼요</T>
    <T size={96} weight="bold" color="accent" style={{lineHeight:110}}>{Math.max(1,left)}</T>
    <T size={14} color="muted">공부 {Math.round(b.studySec/60)}분 · 본 문제 {b.quizCount??5}개 · 시간 추가 없음</T>
   </View>
   {errorLine}{leaveBtn}
  </Screen>;
 }

 // 공부
 if(b.phase==="study"){
  const skip=b.studySkip;
  return <Screen scroll>
   {header}
   <Card style={{alignItems:"center",gap:8,borderTopWidth:4,borderTopColor:c.accent}}>
    {topic?<>
     <Row gap={6} style={{justifyContent:"center"}}><Badge label={topic.categoryName}/><Badge label={levelText(topic.lv)} tone={levelTone(topic.level)}/></Row>
     <T size={30} weight="bold" center>{topic.ko}</T>
     <T size={14} color="muted" center>{topic.en}</T>
     <T size={15} color="ink2" center>{topic.hint}</T>
    </>:<T size={24} weight="bold" color="ink2" center>주제를 불러오고 있어요</T>}
   </Card>
   <View style={{alignItems:"center",gap:2}}>
    <T size={56} weight="bold" style={{lineHeight:66}}>{fmtClock(left)}</T>
    <T size={13} color="muted" center>두 사람 모두 같은 시각에 문제로 넘어가요 · 앱을 닫아도 시간은 흘러요</T>
   </View>
   {topic&&<TopicLinks topic={topic} onOpen={(url,title)=>setReader({url,title})}/>}
   <Card style={{gap:8}}>
    <Row style={{justifyContent:"space-between"}}>
     <T size={15} weight="bold">바로 문제 풀기</T>
     <T size={14} weight="bold" color={skip?.myAgreed?"accent":"muted"}>동의 {skip?.count??0} / 2</T>
    </Row>
    <T size={13} color="muted">두 사람 모두 동의하면 공부를 끝내고 바로 시작해요. 다시 누르면 취소돼요.</T>
    <Btn title={skip?.myAgreed?"동의 취소":"나도 바로 풀래요"} variant={skip?.myAgreed?"outline":"accent"} loading={busy} onPress={()=>void toggleStudySkip()}/>
   </Card>
   <StudyReader page={reader} left={left} total={b.studySec} running onClose={()=>setReader(null)}/>
   {errorLine}
   <Btn title="배틀 포기" variant="ghost" disabled={busy} onPress={forfeit}/>
   {leaveBtn}
  </Screen>;
 }

 // 본 문제 · 연장전
 if(b.phase==="quiz"||b.phase==="overtime"){
  const isOt=b.phase==="overtime";
  const total=b.quizCount??5;
  return <Screen scroll>
   {header}
   <Row style={{justifyContent:"space-between",flexWrap:"nowrap"}}>
    <Row gap={6}>
     <Badge label={isOt?`연장전 ${(ot?.round??0)+1}번째`:`${Math.min(position+1,total)} / ${total}`} tone="accent" icon={<Icon name="swords" size={20}/>}/>
     <Badge label={fmtClock(left)} icon={<Icon name="clock" size={18}/>}/>
    </Row>
    {topic&&<T size={13} color="muted" numberOfLines={1} style={{flexShrink:1}}>{topic.ko}</T>}
   </Row>
   {!isOt&&<View style={{height:8,borderRadius:4,backgroundColor:c.chip,overflow:"hidden"}}>
    <View style={{width:`${(b.myAnswers.filter(a=>a!==null).length/total)*100}%`,height:"100%",backgroundColor:c.accent}}/>
   </View>}
   {submitted?(
    <Card style={{alignItems:"center",gap:10}}>
     <ActivityIndicator size="large" color={c.accent}/>
     <T size={18} weight="bold" center>{isOt?"답을 냈어요":"답안을 모두 냈어요"}</T>
     <T size={14} color="muted" center>{other?.nickname}님을 기다리고 있어요. 시간이 끝나면 그때까지 낸 답으로 채점돼요.</T>
    </Card>
   ):question?(
    <BattleQuestion key={key} q={question} busy={busy} disabled={left===0} onPick={v=>void answer(v)}/>
   ):(
    <Card style={{alignItems:"center",gap:10}}><ActivityIndicator color={c.accent}/><T size={15} color="ink2" center>다음 문제를 기다리고 있어요</T></Card>
   )}
   {isOt&&<T size={13} color="muted" center>점수가 같아서 연장전이에요. 한 문제씩 같이 풀어서 한 사람만 맞히면 그 사람이 이겨요.</T>}
   {error?<T size={13} color="accent" center>{error} · 다시 누르면 처음 고른 답을 다시 보내요.</T>:null}
   {!isOt&&!submitted&&<Btn title="지금까지 푼 답으로 제출" disabled={busy} onPress={()=>showDialog({icon:"swords",title:"제출할까요?",message:"안 푼 문제는 틀린 것으로 처리돼요.",buttons:[{text:"계속 풀기",style:"cancel"},{text:"제출하기",style:"destructive",onPress:()=>void finishEarly()}]})}/>}
   <Btn title="배틀 포기" variant="ghost" disabled={busy} onPress={forfeit}/>
  </Screen>;
 }

 // 제출하고 상대 기다리는 중
 if(!finished){
  return <Screen contentStyle={{flex:1,justifyContent:"center"}}>
   {header}
   <Card style={{alignItems:"center",gap:10}}>
    <ActivityIndicator size="large" color={c.accent}/>
    <T size={18} weight="bold" center>{other?.nickname}님이 다 풀 때까지 기다리고 있어요</T>
    <T size={13} color="muted" center>제한 시간이 끝나면 그때까지 낸 답으로 채점돼요. ({fmtClock(left)})</T>
   </Card>
   {errorLine}{leaveBtn}
  </Screen>;
 }

 // 결과
 const theirs=other?b.results[other.uid]:undefined;
 const winner=b.outcome?.winner??null,amount=b.outcome?.xp??0,won=winner===uid,draw=!winner,voided=b.status==="void";
 const total=b.quizCount??5;
 return <Screen scroll>
  {header}
  <View style={{alignItems:"center",gap:6,paddingTop:10}}>
   <Icon name={voided?"nope":draw?"handshake":won?"trophy":"dizzy"} size={104}/>
   <T size={26} weight="bold" center>{voided?"배틀이 취소됐어요":draw?"비겼어요":won?"배틀에서 이겼어요!":"아쉽게 졌어요"}</T>
   {topic&&<T size={15} color="ink2" center>{topic.ko}</T>}
   {!!ot?.past?.length&&<Badge label={`동점 · 연장전 ${ot.past.length}문제`} tone="navy" icon={<Icon name="swords" size={20}/>}/>}
  </View>
  {!voided&&<View style={{borderRadius:radius.lg,borderWidth:2,borderColor:c.line,backgroundColor:c.paper,overflow:"hidden"}}>
   {[{name:prefs.nickname||"나",r:mine,isMe:true,id:uid},{name:other?.nickname??"상대",r:theirs,isMe:false,id:other?.uid}]
    .sort((x,y)=>Number(y.id===winner)-Number(x.id===winner)||(y.r?.score??-1)-(x.r?.score??-1)||(x.isMe?-1:1))
    .map((p,i)=><View key={p.name+i} style={{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:14,paddingHorizontal:16,backgroundColor:p.isMe?c.successSoft:c.paper,borderTopWidth:i?1:0,borderTopColor:c.line}}>
     <T size={18} weight="bold" color={p.isMe?"success":"ink2"} style={{width:18,textAlign:"center"}}>{draw?"-":i+1}</T>
     <View style={{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:p.isMe?c.navy:c.accent}}>
      <T size={19} weight="bold" style={{color:"#fffaf0"}}>{p.name.slice(0,1)}</T>
     </View>
     <View style={{flex:1}}>
      <T size={17} weight="bold" color={p.isMe?"success":"ink"} numberOfLines={1}>{p.name}{p.isMe?" (나)":""}</T>
      {!p.r&&<T size={12} color="accent">제출 안 함</T>}
     </View>
     {!draw&&i===0&&<Icon name="crown" size={26}/>}
     <T size={17} weight="bold" color={p.isMe?"success":"ink2"}>{p.r?.score??0} / {p.r?.total??total}</T>
    </View>)}
  </View>}
  <Card style={{alignItems:"center",gap:4}}>
   {!draw&&!voided&&<Icon name="bolt" size={36}/>}
   <T size={16} weight="bold" center>
    {voided?"배틀권을 돌려받았고 경험치는 그대로예요.":draw?"경험치는 그대로예요.":won?`${other?.nickname}님의 경험치 ${amount} XP를 가져왔어요!`:`경험치 ${amount} XP를 ${other?.nickname}님에게 뺏겼어요.`}
   </T>
   {!voided&&<T size={13} color="muted" center>진 사람 누적 경험치의 5% (최대 {battleXpTransfer(1e9)} XP) · 본 문제 정답만 분야 랭크에 반영</T>}
  </Card>
  {b.recordId&&<Btn title="문항별 풀이 기록 보기" onPress={()=>router.push({pathname:"/record/[id]",params:{id:b.recordId!}})}/>}
  {errorLine}{leaveBtn}
 </Screen>;
}

/** 배틀 문제: 퀴즈와 같은 모양의 보기. 정답은 서버만 알아서, 고르면 바로 저장하고 다음 문제로 */
function BattleQuestion({q,busy,disabled,onPick}:{q:QuizQuestion;busy:boolean;disabled:boolean;onPick:(v:number|boolean)=>void}){
 const c=useColors();
 const [picked,setPicked]=useState<number|boolean|null>(null);
 const choices:{v:number|boolean;label:string}[]=q.type==="mc"?q.choices.map((ch,i)=>({v:i,label:ch})):[{v:true,label:"O (맞다)"},{v:false,label:"X (틀리다)"}];
 return <View style={{gap:12}}>
  <Card style={{paddingVertical:22}}><T size={20} weight="bold" center style={{lineHeight:29}}>{q.q}</T></Card>
  {choices.map((x,i)=>{
   const mine=picked===x.v;
   return <Pressable key={i} disabled={disabled||(busy&&!mine)} onPress={()=>{setPicked(x.v);onPick(x.v);}} accessibilityRole="button" accessibilityLabel={`${i+1}번 ${x.label}`}
    style={({pressed})=>({flexDirection:"row",alignItems:"center",gap:12,paddingVertical:14,paddingHorizontal:14,borderRadius:radius.lg,borderWidth:2,
     borderColor:mine?c.navy:c.line2,backgroundColor:mine?c.chip:c.paper,...raised(c.paperEdge,pressed,5),...(!pressed?shadow(c,1):null)})}>
    <View style={{width:28,height:28,borderRadius:8,borderWidth:1.5,borderBottomWidth:3,borderColor:c.line2,backgroundColor:c.bg,alignItems:"center",justifyContent:"center"}}>
     <T size={13} weight="bold" color="ink2">{q.type==="mc"?i+1:x.v?"O":"X"}</T>
    </View>
    <T size={15} style={{flex:1}} numberOfLines={3}>{x.label}</T>
    {mine&&busy&&<ActivityIndicator color={c.navy}/>}
   </Pressable>;
  })}
 </View>;
}
