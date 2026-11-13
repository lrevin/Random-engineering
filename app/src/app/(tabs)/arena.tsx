import {router,useFocusEffect} from "expo-router";
import {useCallback,useRef,useState} from "react";
import {BattleIntro} from "@/components/BattleIntro";
import {Btn,Card,Screen,T} from "@/components/ui";
import {useApp} from "@/lib/app-state";
import {getBattleHistory,getMatch,joinMatch,leaveMatch,socialMessage,type Battle,type MatchState} from "@/lib/social";

export default function Arena(){
 const {mode,uid,freeTickets,boughtTickets,gears,buyBattleTicket,refreshWallet,walletNotice}=useApp();
 const [match,setMatch]=useState<MatchState>({status:"none"}),[history,setHistory]=useState<Battle[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [intro,setIntro]=useState(false);
 const running=useRef(false);
 const refresh=useCallback(async()=>{if(mode!=="user"||running.current)return;running.current=true;try{setMatch(await getMatch());const h=await getBattleHistory();setHistory(h.battles);await refreshWallet();setNotice("");}catch(e){setNotice(socialMessage(e));}finally{running.current=false;}},[mode,refreshWallet]);
 useFocusEffect(useCallback(()=>{void refresh();const timer=setInterval(()=>void refresh(),2500);return()=>clearInterval(timer);},[refresh]));
 async function join(){if(busy)return;setBusy(true);try{setMatch(await joinMatch());await refreshWallet();setNotice("");}catch(e){setNotice(socialMessage(e));}finally{setBusy(false);}}
 async function cancel(){if(match.status!=="waiting"||busy)return;setBusy(true);try{setMatch(await leaveMatch(match.id));await refreshWallet();}catch(e){setNotice(socialMessage(e));}finally{setBusy(false);}}
 return <Screen scroll edges={["top"]}>
  <BattleIntro open={intro} onClose={()=>setIntro(false)}/>
  <Btn title="배틀 이용 안내" onPress={()=>setIntro(true)}/>
  <Btn title="스피드 퀴즈" onPress={()=>router.push("../speed")}/>
  <T size={24} weight="bold">관심 분야로 1:1 배틀</T>
  <T>서로 겹치는 관심 분야에서 같은 주제를 학습해요. 10분 학습 후 본 문제 5개를 풀어요.</T>
  <T color="muted">본 문제는 5분, 동점이면 문항당 45초의 연장전을 최대 5번 진행해요. 패자의 회원 XP 5% (최대 100)가 승자에게 이동해요.</T>
  {mode!=="user"?<T>로그인 후 매칭을 이용할 수 있어요.</T>:<>
   <Card style={{gap:10}}><T>배틀권 무료 {freeTickets} · 구매 {boughtTickets} / 톱니바퀴 {gears}</T>
    {match.status==="waiting"?<><T>상대를 찾고 있어요. 최대 3분 대기하며 취소·만료 시 배틀권을 반환해요.</T><Btn title="매칭 취소" loading={busy} onPress={()=>void cancel()}/></>:match.status==="matched"?<><T>진행 중인 배틀이 있어요.</T><Btn title="배틀 입장 · 이어하기" variant="primary" onPress={()=>{if(match.status==="matched")router.push({pathname:"/battle",params:{id:match.battle.id}});}}/></>:<Btn title="랜덤 매칭 시작" variant="primary" loading={busy} onPress={()=>void join()}/>}
    <Btn title="배틀권 구매 (톱니바퀴 50개)" disabled={busy} onPress={async()=>{setBusy(true);try{if(!await buyBattleTicket())setNotice("톱니바퀴 또는 구매 한도를 확인해 주세요.");}finally{setBusy(false);}}}/>
   </Card>
   <T color="muted">인터넷이 필요해요. 앱을 닫아도 매칭 후 제한 시간은 멈추지 않아요. 서버에 저장한 답안으로 이어서 풀 수 있어요.</T>
   {!!(notice||walletNotice)&&<T color="accent">{notice||walletNotice}</T>}
   <Btn title="진행 상태 새로 확인" onPress={()=>void refresh()}/>
   <T size={20} weight="bold">최근 배틀</T>
   {history.slice(0,10).map(b=><Card key={b.id}><T>{(b.from.uid===uid?b.to:b.from).nickname} · {b.status==="void"?"무효":!b.outcome?.winner?"무승부":b.outcome.winner===uid?"승리":"패배"}</T><Btn title="결과 보기" onPress={()=>router.push({pathname:"/battle",params:{id:b.id}})}/></Card>)}
  </>}
 </Screen>;
}
