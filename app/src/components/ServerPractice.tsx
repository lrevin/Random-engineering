import * as Crypto from 'expo-crypto';
import {router} from 'expo-router';
import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {topicById} from '@/data';
import {mysqlAuth,authErrorMessage} from '@/lib/auth';
import {useApp} from '@/lib/app-state';
import {useRewardStatus} from '@/lib/useRewardStatus';
import {clearCachedActivity,readCachedActivity,saveCachedActivity,type CachedActivity} from '@/lib/activity-cache';
import type {ServerActivity} from '@/lib/reward-types';
import {QuestionView,answerText} from '@/app/quiz';
import {Badge,Btn,Card,Row,Screen,T} from './ui';
import {showDialog} from './Dialog';
import {Icon} from './Icon';

/** 회원 복습·오답 풀이. 답안은 기기에 먼저 보관하고 서버 성공 후 완료로 표시한다. */
export function ServerPractice({purpose}:{purpose:'recall'|'review'}){
 const {refreshWallet,premium}=useApp(),{rewards,refresh}=useRewardStatus();
 const [session,setSession]=useState<CachedActivity|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [completed,setCompleted]=useState<ServerActivity|null>(null),[got,setGot]=useState(false);
 const lock=useRef(false),owner=mysqlAuth.getUserId();
 useEffect(()=>{let alive=true;readCachedActivity(purpose).then(x=>{if(alive&&mysqlAuth.getUserId()===owner){setSession(x);setReady(true);}}).catch(()=>{if(alive){setNotice('저장된 진행을 읽지 못했어요. 다시 열어 주세요.');}});return()=>{alive=false;};},[owner,purpose]);
 const run=async(task:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setNotice('');try{await task();}catch(e){const pending=await readCachedActivity(purpose).catch(()=>null);if(pending)setSession(pending);setNotice(authErrorMessage(e));}finally{lock.current=false;setBusy(false);}};
 const resolve=async(x:CachedActivity)=>{
  const activity=x.activity?await mysqlAuth.getActivity(x.activity.id):await mysqlAuth.issueActivity(x.request);
  if(activity.status==='abandoned'){await clearCachedActivity(purpose);setSession(null);return;}
  const next={...x,activity};await saveCachedActivity(next);setSession(next);
  if(activity.status==='completed'){setCompleted(activity);await refreshWallet();await refresh();await clearCachedActivity(purpose);}
 };
 const start=()=>run(async()=>{
  const x=session??{owner:owner!,request:{purpose,requestId:Crypto.randomUUID()},answers:[]};
  await saveCachedActivity(x);setSession(x);setCompleted(null);setGot(false);await resolve(x);
 });
 const submit=async(x:CachedActivity)=>{
  const before=x.activity!.wallet.claims;
  const activity=await mysqlAuth.completeActivity(x.activity!.id,x.answers);
  setCompleted(activity);setGot(purpose==='recall'&&activity.wallet.claims.some(k=>k.startsWith('recall:')&&!before.includes(k)));
  await refreshWallet();await refresh();await clearCachedActivity(purpose);
 };
 const next=(answer:number|boolean)=>run(async()=>{
  if(!session?.activity)return;
  const a=session.activity,index=session.answers.length;
  const x={...session,answers:[...session.answers,answer]};
  // 오답 해결은 서버의 문항별 승인이 난 뒤 다음 문제로 넘어간다.
  await saveCachedActivity(x);
  if(purpose==='review')await mysqlAuth.activityAnswer(a.id,index+1,answer);
  setSession(x);
  if(x.answers.length===a.items.length)await submit(x);
 });
 const retry=()=>run(async()=>{
  if(!session)return;
  if(!session.activity){await resolve(session);return;}
  if(purpose==='review')for(let i=0;i<session.answers.length;i++)await mysqlAuth.activityAnswer(session.activity.id,i+1,session.answers[i]);
  if(session.answers.length===session.activity.items.length)await submit(session);else await resolve(session);
 });
 const quit=()=>showDialog({title:'풀이를 그만둘까요?',message:purpose==='review'?'서버에서 해결이 확인된 오답은 유지돼요.':'완료하지 않은 복습은 보상에 포함되지 않아요.',buttons:[{text:'계속 풀기',style:'cancel'},{text:'그만두기',style:'destructive',onPress:()=>{void run(async()=>{if(session){const a=session.activity??await mysqlAuth.issueActivity(session.request);await mysqlAuth.abandonActivity(a.id);}await clearCachedActivity(purpose);setSession(null);setCompleted(null);await refresh();});}}]});
 if(session&&session.owner!==owner)return <Screen><T>현재 계정의 진행을 확인하고 있어요.</T></Screen>;
 const activity=session?.activity,index=session?.answers.length??0;
 // 요청 실패 때도 답안과 같은 UUID를 남겨서 재시도한다.
 if(activity&&!completed&&index<activity.items.length&&!notice){
  const item=activity.items[index],topic=topicById(item.topicId);
  return <QuestionView key={activity.id+':'+index} q={item.question} index={index} count={activity.items.length} topicName={topic?.ko??item.topicId} badges={<Row><Badge label={purpose==='recall'?'복습':'오답 다시'} /></Row>} saving={busy} onQuit={quit} onNext={answer=>{void next(answer);}} />;
 }
 return <Screen scroll>
  <T size={26} weight="bold">{purpose==='recall'?'오늘의 복습':'오답 다시 풀기'}</T>
  {!!notice&&<Card><T color="accent">{notice}</T></Card>}
  {completed?<>
   <Icon name="check" size={52}/><T size={24} weight="bold">서버에 완료를 저장했어요</T>
   <T>{completed.result?.total}문제 중 {completed.result?.score}문제를 맞혔어요.</T>
   {got&&<T color="success">복습 보상 +5 톱니바퀴</T>}
   {completed.items.filter((it,i)=>completed.answers[i]!==it.question.answer).map(it=><Card key={it.position}><T>{it.question.q}</T><T color="success">정답: {answerText(it.question)}</T><T color="ink2">{it.question.explain}</T></Card>)}
   <Btn title="목록으로" onPress={()=>{setSession(null);setCompleted(null);}}/>
  </>:session?<>
   <T>이 기기에 저장한 풀이가 있어요. 같은 요청으로 확인하므로 중복 보상·차감되지 않아요.</T>
   <Btn title={busy?'확인 중…':'풀이 이어서 / 전송 다시 시도'} disabled={busy} onPress={()=>{void retry();}}/>
   <Btn title="풀이 포기" disabled={busy} onPress={quit}/>
  </>:<>
   <T color="ink2">{purpose==='recall'?'마지막 학습·복습에서 한국 날짜로 이틀 지난 주제를 최대 5개, 주제마다 3문제씩 풀어요. 하루 최초 완료 시 5톱니바퀴를 자동으로 받아요.':'서버에서 확인된 미해결 오답을 최대 10개씩 풀어요. 맞힌 문항은 즉시 해결로 저장돼요.'}</T>
   {purpose==='recall'&&rewards?.recall.map(t=><Card key={t.topicId}><T>{topicById(t.topicId)?.ko??t.topicId}</T></Card>)}
   {purpose==='review'&&!premium&&<T>프리미엄 회원 전용이에요.</T>}
   <Btn title={busy?'문제 준비 중…':'풀이 시작'} disabled={!ready||busy||(purpose==='review'&&!premium)||(purpose==='recall'&&!rewards?.recall.length)} onPress={()=>{void start();}}/>
   {!!rewards&&purpose==='recall'&&!rewards.recall.length&&<T>오늘 복습할 주제가 없어요.</T>}
   <Btn title="서버 상태 다시 확인" disabled={busy} onPress={()=>{void refresh();}}/>
  </>}
  <View><Btn title="닫기" onPress={()=>router.back()}/></View>
 </Screen>;
}
