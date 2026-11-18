import {assetsState} from './purchase-service.mjs';
const json=v=>typeof v==='string'?JSON.parse(v):v;
import {kstDayStartUtc} from './ad-reward.mjs';
export async function walletState(db,id,now=new Date()){
 const [[w]]=await db.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE',[id]);
 if(!w){await db.execute('INSERT INTO wallets(user_id,balance) VALUES (?,30)',[id]);await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,30,'starter','starter')",[id]);return walletState(db,id,now);}
 const [[last]]=await db.execute('SELECT id,result_json FROM wallet_operations WHERE user_id=? ORDER BY id DESC LIMIT 1',[id]);
 const state=last?json(last.result_json).state:{freezes:0,boughtTickets:0,freeTickets:2,month:'',premium:false,keptDays:[]};
 // 프리미엄 = 운영자가 켠 것 또는 기간이 남은 월 구독. 저장된 state.premium 이 구독 때문에 켜진 값(subscribed)이면 운영자 값(grantedPremium)을 씀
 const granted=state.subscribed?!!state.grantedPremium:!!state.premium;state.grantedPremium=granted;
 let subscribed=false;try{const [[sub]]=await db.execute('SELECT current_period_end>? AS ok FROM subscriptions WHERE user_id=?',[now,id]);subscribed=!!Number(sub?.ok);}catch(e){if(e.code!=='ER_NO_SUCH_TABLE')throw e;}
 state.subscribed=subscribed;state.premium=granted||subscribed;
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(now);
 if(state.month!==month){state.month=month;state.freeTickets=2;}
 const [claims]=await db.execute("SELECT request_id FROM wallet_transactions WHERE user_id=? AND reason='quest'",[id]);
 // 오늘(한국 시간) 서버가 확인해 지급한 광고 보상 횟수 (AdMob SSV)
 const [[ads]]=await db.execute("SELECT COUNT(*) AS n FROM wallet_transactions WHERE user_id=? AND reason='ad_reward' AND created_at>=?",[id,kstDayStartUtc(now)]);
 return {balance:Number(w.balance),revision:String(last?.id??0),state,claims:claims.map(x=>x.request_id),adsToday:Number(ads.n),assets:await assetsState(db,id)};
}
