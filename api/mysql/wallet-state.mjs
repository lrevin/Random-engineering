const json=v=>typeof v==='string'?JSON.parse(v):v;
import {kstDayStartUtc} from './ad-reward.mjs';
export async function walletState(db,id,now=new Date()){
 const [[w]]=await db.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE',[id]);
 if(!w){await db.execute('INSERT INTO wallets(user_id,balance) VALUES (?,30)',[id]);await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,30,'starter','starter')",[id]);return walletState(db,id,now);}
 const [[last]]=await db.execute('SELECT id,result_json FROM wallet_operations WHERE user_id=? ORDER BY id DESC LIMIT 1',[id]);
 const state=last?json(last.result_json).state:{freezes:0,boughtTickets:0,freeTickets:2,month:'',premium:false,keptDays:[]};
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(now);
 if(state.month!==month){state.month=month;state.freeTickets=2;}
 const [claims]=await db.execute("SELECT request_id FROM wallet_transactions WHERE user_id=? AND reason='quest'",[id]);
 // 오늘(한국 시간) 서버가 확인해 지급한 광고 보상 횟수 (AdMob SSV)
 const [[ads]]=await db.execute("SELECT COUNT(*) AS n FROM wallet_transactions WHERE user_id=? AND reason='ad_reward' AND created_at>=?",[id,kstDayStartUtc(now)]);
 return {balance:Number(w.balance),revision:String(last?.id??0),state,claims:claims.map(x=>x.request_id),adsToday:Number(ads.n)};
}
