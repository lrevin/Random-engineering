import {rewardSql} from './reward-eligibility.mjs';
import {purchase,equip,startExam,assetsState} from './purchase-service.mjs';
import {walletState} from './wallet-state.mjs';
import {randomBytes} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {AuthError} from '../server/auth.mjs';
import {planStreakRescue} from './policy/economy.mjs';
import {hash} from '../shared/question-store.mjs';
/** 시연용 프리미엄 티켓 1장으로 켜지는 프리미엄 기간 (일) */
export const PREMIUM_TICKET_DAYS=30;
import {weekStartKst} from './team-policy.mjs';
const kstDay=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const levelOf=xp=>Math.min(100,Math.max(1,Math.floor((-45+Math.sqrt(2025+20*Math.max(0,Number(xp))))/10)+1));
const parse=v=>typeof v==='string'?JSON.parse(v):v;
const code=()=>Array.from(randomBytes(8),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
export function createMemberService({auth,connectionFactory=connect,now=()=>new Date(),push=null}) {
 async function member(header,action){
  const claims=await auth.verifyAccess(header),db=await connectionFactory();
  try{return await transaction(db,async()=>{
   const [[u]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[claims.sub]);
   if(!u||u.status!=='active'||u.auth_version!==claims.av)throw new AuthError('unauthorized',401);
   return action(db,u.id);
  });}finally{await db.end();}
 }
 async function identity(db,id){
  const [[old]]=await db.execute('SELECT friend_code FROM social_members WHERE user_id=?',[id]);
  if(!old){for(let i=0;i<8;i++){try{await db.execute('INSERT INTO social_members(user_id,friend_code) VALUES (?,?)',[id,code()]);break;}catch(e){if(e.code!=='ER_DUP_ENTRY'||i===7)throw e;}}}
  await db.execute('UPDATE social_members SET last_seen_at=UTC_TIMESTAMP(3) WHERE user_id=?',[id]);
  const [[r]]=await db.execute('SELECT friend_code FROM social_members WHERE user_id=?',[id]);return r.friend_code;
 }
 async function friends(db,id){
  const [rows]=await db.execute(`SELECT f.status,f.requested_by,m.friend_code AS uid,p.nickname,(SELECT COALESCE(SUM(x.amount),0) FROM xp_ledger x WHERE x.user_id=m.user_id)+(SELECT COALESCE(SUM(s.awarded_xp),0) FROM speed_runs s WHERE s.user_id=m.user_id)+(SELECT COALESCE(SUM(b.reward_xp),0) FROM boss_runs b WHERE b.user_id=m.user_id AND b.status='cleared') AS xp,
   m.last_seen_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 30 SECOND) AS online FROM social_friendships f
   JOIN social_members m ON m.user_id=IF(f.user_low=?,f.user_high,f.user_low)
   JOIN users u ON u.id=m.user_id AND u.status='active' LEFT JOIN profiles p ON p.user_id=m.user_id
   WHERE f.user_low=? OR f.user_high=? ORDER BY m.friend_code`,[id,id,id]);
  const result={friends:[],incoming:[],outgoing:[]};
  for(const r of rows)result[r.status==='accepted'?'friends':r.requested_by===id?'outgoing':'incoming'].push({uid:r.uid,nickname:r.nickname??'학습자',level:Math.min(100,Math.max(1,Math.floor((-45+Math.sqrt(2025+20*Math.max(0,Number(r.xp))))/10)+1)),online:!!Number(r.online)});
  return result;
 }
 async function wallet(db,id){return walletState(db,id,now());}

 return {
  me:header=>member(header,async(db,id)=>({ok:true,uid:await identity(db,id)})),
  friends:header=>member(header,async(db,id)=>{await identity(db,id);return friends(db,id);}),
  friend: (header,friendCode,action)=>member(header,async(db,id)=>{
   await identity(db,id);
   if(!/^[A-Z2-9]{8}$/.test(friendCode))throw new AuthError('not_found',404);
   const [[target]]=await db.execute("SELECT m.user_id FROM social_members m JOIN users u ON u.id=m.user_id AND u.status='active' WHERE friend_code=?",[friendCode]);
   if(!target)throw new AuthError('not_found',404);if(target.user_id===id)throw new AuthError('self',400);
   const pair=[id,target.user_id].sort(),[[old]]=await db.execute('SELECT * FROM social_friendships WHERE user_low=? AND user_high=? FOR UPDATE',pair);
   if(action==='request'){
    if(old){if(old.status==='pending'&&old.requested_by!==id){await db.execute("UPDATE social_friendships SET status='accepted' WHERE user_low=? AND user_high=?",pair);return friends(db,id);}throw new AuthError(old.status==='accepted'?'already_friends':'already_requested',409);}
    await db.execute('INSERT INTO social_friendships(user_low,user_high,requested_by) VALUES (?,?,?)',[...pair,id]);
   }else if(action==='accept'||action==='decline'){
    if(!old||old.status!=='pending'||old.requested_by===id)throw new AuthError('not_pending',409);
    if(action==='accept')await db.execute("UPDATE social_friendships SET status='accepted' WHERE user_low=? AND user_high=?",pair);
    else await db.execute('DELETE FROM social_friendships WHERE user_low=? AND user_high=?',pair);
   }else await db.execute('DELETE FROM social_friendships WHERE user_low=? AND user_high=?',pair);
   return friends(db,id);
  }),
  /** 친구 정보 보기: 친구 사이일 때만 (아니면 없는 사용자처럼 404) */
  friendInfo:(header,friendCode)=>member(header,async(db,id)=>{
   await identity(db,id);
   if(!/^[A-Z2-9]{8}$/.test(friendCode??''))throw new AuthError('not_found',404);
   const [[t]]=await db.execute("SELECT m.user_id,m.friend_code,m.last_seen_at,p.nickname FROM social_members m JOIN users u ON u.id=m.user_id AND u.status='active' LEFT JOIN profiles p ON p.user_id=m.user_id WHERE m.friend_code=?",[friendCode]);
   if(!t||t.user_id===id)throw new AuthError('not_found',404);
   const [lo,hi]=[id,t.user_id].sort(),[[f]]=await db.execute("SELECT 1 AS ok FROM social_friendships WHERE user_low=? AND user_high=? AND status='accepted'",[lo,hi]);
   if(!f)throw new AuthError('not_found',404);
   const since=new Date(new Date(weekStartKst(now())+'T00:00:00Z').getTime()-9*3600e3);
   const [[x]]=await db.execute(`SELECT (SELECT COALESCE(SUM(amount),0) FROM xp_ledger WHERE user_id=?)+(SELECT COALESCE(SUM(awarded_xp),0) FROM speed_runs WHERE user_id=?)+(SELECT COALESCE(SUM(reward_xp),0) FROM boss_runs WHERE user_id=? AND status='cleared') AS total,
    (SELECT COALESCE(SUM(amount),0) FROM xp_ledger WHERE user_id=? AND created_at>=?)+(SELECT COALESCE(SUM(awarded_xp),0) FROM speed_runs WHERE user_id=? AND status='completed' AND completed_at>=?)+(SELECT COALESCE(SUM(reward_xp),0) FROM boss_runs WHERE user_id=? AND status='cleared' AND finished_at>=?) AS week`,
    [t.user_id,t.user_id,t.user_id,t.user_id,since,t.user_id,since,t.user_id,since]);
   const [[title]]=await db.execute("SELECT item_id FROM member_cosmetics WHERE user_id=? AND item_type='title' AND is_equipped=TRUE",[t.user_id]);
   const [[me]]=await db.execute('SELECT friend_code FROM social_members WHERE user_id=?',[id]);
   const [games]=await db.execute("SELECT state_json FROM battles WHERE status='finished' AND ((user_a=? AND user_b=?) OR (user_a=? AND user_b=?)) ORDER BY created_at DESC LIMIT 200",[id,t.user_id,t.user_id,id]);
   const versus={wins:0,losses:0,draws:0};
   for(const g of games){const w=parse(g.state_json)?.outcome?.winner;if(!w)versus.draws++;else if(w===me.friend_code)versus.wins++;else versus.losses++;}
   const total=Math.max(0,Number(x.total)),today=kstDay(now());
   const [[studied]]=await db.execute('SELECT 1 AS ok FROM study_records WHERE user_id=? AND study_date=? LIMIT 1',[t.user_id,today]);
   let poked=false;try{const [[p]]=await db.execute("SELECT 1 AS ok FROM notification_log WHERE kind='poke' AND ref=? AND period=?",[`${id}:${t.user_id}`,today]);poked=!!p;}catch(e){if(e.code!=='ER_NO_SUCH_TABLE')throw e;}
   return {studiedToday:!!studied,pokedToday:poked,uid:t.friend_code,nickname:t.nickname??'학습자',level:levelOf(total),xp:total,weekXp:Math.max(0,Number(x.week)),
    online:!!t.last_seen_at&&now().getTime()-new Date(String(t.last_seen_at).replace(' ','T')+'Z').getTime()<30000,lastSeenAt:t.last_seen_at?new Date(String(t.last_seen_at).replace(' ','T')+'Z').toISOString():null,
    title:title?.item_id??null,versus};
  }),
  /** 콕 찌르기: 오늘 아직 공부 안 한 친구에게 알림 (친구마다 하루 1번) */
  poke:async(header,friendCode)=>{
   const r=await member(header,async(db,id)=>{
    if(!/^[A-Z2-9]{8}$/.test(friendCode??''))throw new AuthError('not_found',404);
    const [[t]]=await db.execute("SELECT m.user_id FROM social_members m JOIN users u ON u.id=m.user_id AND u.status='active' WHERE m.friend_code=?",[friendCode]);
    if(!t||t.user_id===id)throw new AuthError('not_found',404);
    const [lo,hi]=[id,t.user_id].sort(),[[f]]=await db.execute("SELECT 1 AS ok FROM social_friendships WHERE user_low=? AND user_high=? AND status='accepted'",[lo,hi]);
    if(!f)throw new AuthError('not_friends',409);
    const today=kstDay(now());
    const [[studied]]=await db.execute('SELECT 1 AS ok FROM study_records WHERE user_id=? AND study_date=? LIMIT 1',[t.user_id,today]);
    if(studied)throw new AuthError('friend_studied_today',409);
    const [ins]=await db.execute("INSERT IGNORE INTO notification_log(kind,ref,period,user_id) VALUES ('poke',?,?,?)",[`${id}:${t.user_id}`,today,id]);
    if(!ins.affectedRows)throw new AuthError('already_poked',409);
    const [[me]]=await db.execute('SELECT nickname FROM profiles WHERE user_id=?',[id]);
    return {to:t.user_id,nickname:me?.nickname??'친구'};
   });
   const sent=push?await push.send(r.to,{title:'콕!',body:`${r.nickname}님이 콕 찔렀어요. 오늘 공부 한 판 어때요?`,data:{type:'poke'},channelId:'reminders'}):0;
   return {ok:true,notified:sent>0};
  },
  /** 이 기기의 푸시 알림 토큰 등록 · 해제 (로그아웃할 때 해제) */
  pushToken:(header,body,remove=false)=>member(header,async(db,id)=>{
   if(!push)return {ok:false};
   if(remove){await push.unregister(db,id,body?.token);return {ok:true};}
   if(!(await push.register(db,id,body?.token,body?.platform)))throw new AuthError('invalid_request',400);
   return {ok:true};
  }),
  wallet:header=>member(header,wallet),
  operate:(header,body)=>member(header,async(db,id)=>{
   const {requestId,action,payload={}}=body??{};
   if(typeof requestId!=='string'||!/^[a-zA-Z0-9:._-]{1,90}$/.test(requestId)||typeof action!=='string'||!payload||Array.isArray(payload)||typeof payload!=='object')throw new AuthError('invalid_operation',400);
   const digest=Buffer.from(hash({action,payload}),'hex');
   const [[old]]=await db.execute('SELECT request_hash,result_json FROM wallet_operations WHERE user_id=? AND request_id=? FOR UPDATE',[id,requestId]);
   if(old){if(!old.request_hash.equals(digest))throw new AuthError('operation_conflict',409);return {...await wallet(db,id),replayed:true};}
   const value=await wallet(db,id),s=value.state;let amount=0;
   if(action==='buy_freeze'){if(s.freezes>=2)throw new AuthError('inventory_full',409);amount=-30;s.freezes++;}
   else if(action==='buy_battle_ticket'){if(s.boughtTickets>=5)throw new AuthError('inventory_full',409);amount=-50;s.boughtTickets++;}
   else if(action==='check_streak'||action==='restore_streak'){
    const [rows]=await db.execute(`SELECT r.studied_at AS studiedAt,r.memo FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id WHERE r.user_id=? AND ${rewardSql('day')}`,[id]);
    const records=rows.map(r=>({...r,studiedAt:r.studiedAt.replace(' ','T')+'Z'}));
    const plan=planStreakRescue(records,s.keptDays,s.freezes,now());
    if(plan&&!plan.tooLate){
     s.keptDays=[...new Set([...s.keptDays,...plan.auto])].sort();s.freezes-=plan.auto.length;
     if(action==='restore_streak'&&plan.restore.length){amount=-30*plan.restore.length;s.keptDays=[...new Set([...s.keptDays,...plan.restore])].sort();}
    }
   }
   else if(action==='quest'){
    const {validateQuest}=await import('./quest-policy.mjs');
    amount=await validateQuest(db,id,payload.key,now());
    const [[claimed]]=await db.execute("SELECT id FROM wallet_transactions WHERE user_id=? AND request_id=?",[id,payload.key]);
    if(claimed)throw new AuthError('already_claimed',409);
   }
   else if(action==='equip_cosmetic'){await equip(db,id,payload.type,payload.itemId,{premium:!!value.state.premium});}
   else if(action==='exam_start'){await startExam(db,id,payload,value,now());}
   else if(action==='spend'){
    amount=payload.product==='study_extend'?-10:await purchase(db,id,payload.product,value,now());
   }
   else if(action==='use_premium_ticket'){
    // 프리미엄 티켓 1장 = 지금(또는 남은 기간 끝)부터 30일 프리미엄
    if(!(s.premiumTickets>0))throw new AuthError('no_premium_ticket',409);
    s.premiumTickets--;const at=now(),base=s.premiumUntil&&new Date(s.premiumUntil)>at?new Date(s.premiumUntil):at;
    s.premiumUntil=new Date(+base+PREMIUM_TICKET_DAYS*86400000).toISOString();s.ticketPremium=true;s.premium=true;
   }
   else if(action==='ad_reward'||action==='premium')throw new AuthError('verification_required',409);
   else throw new AuthError('operation_not_available',409);
   if(value.balance+amount<0)throw new AuthError('insufficient_balance',409);
   value.balance+=amount;
   await db.execute('UPDATE wallets SET balance=? WHERE user_id=?',[value.balance,id]);
   if(amount)await db.execute('INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,?,?)',[id,amount,action,action==='quest'?payload.key:'op:'+requestId]);
   const result={balance:value.balance,state:s,assets:await assetsState(db,id)};
   await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',[id,requestId,digest,action,JSON.stringify(payload),JSON.stringify(result)]);
   return {...await wallet(db,id),replayed:false};
  })
 };
}
