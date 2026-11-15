import {walletState} from './wallet-state.mjs';
import {randomBytes} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {AuthError} from '../server/auth.mjs';
import {planStreakRescue} from './policy/economy.mjs';
import {hash} from '../shared/question-store.mjs';
const parse=v=>typeof v==='string'?JSON.parse(v):v;
const code=()=>Array.from(randomBytes(8),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
export function createMemberService({auth,connectionFactory=connect,now=()=>new Date()}) {
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
  const [rows]=await db.execute(`SELECT f.status,f.requested_by,m.friend_code AS uid,p.nickname,(SELECT COALESCE(SUM(x.amount),0) FROM xp_ledger x WHERE x.user_id=m.user_id)+(SELECT COALESCE(SUM(s.awarded_xp),0) FROM speed_runs s WHERE s.user_id=m.user_id) AS xp,
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
  wallet:header=>member(header,wallet),
  operate:(header,body)=>member(header,async(db,id)=>{
   const {requestId,action,payload={}}=body??{};
   if(typeof requestId!=='string'||!/^[a-zA-Z0-9:._-]{1,90}$/.test(requestId)||typeof action!=='string'||!payload||Array.isArray(payload)||typeof payload!=='object')throw new AuthError('invalid_operation',400);
   const digest=Buffer.from(hash({action,payload}),'hex');
   const [[old]]=await db.execute('SELECT request_hash,result_json FROM wallet_operations WHERE user_id=? AND request_id=?',[id,requestId]);
   if(old){if(!old.request_hash.equals(digest))throw new AuthError('operation_conflict',409);return {...await wallet(db,id),replayed:true};}
   const value=await wallet(db,id),s=value.state;let amount=0;
   if(action==='buy_freeze'){if(s.freezes>=2)throw new AuthError('inventory_full',409);amount=-30;s.freezes++;}
   else if(action==='buy_battle_ticket'){if(s.boughtTickets>=5)throw new AuthError('inventory_full',409);amount=-50;s.boughtTickets++;}
   else if(action==='check_streak'||action==='restore_streak'){
    const [rows]=await db.execute("SELECT studied_at AS studiedAt,memo FROM study_records WHERE user_id=? AND time_validation_status='accepted'",[id]);
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
   else if(action==='spend'){
    // Benefits without server inventory are deliberately unavailable until their persistence is connected.
    const prices={study_extend:10};amount=-prices[payload.product];
    if(!Number.isInteger(amount))throw new AuthError('product_not_available',409);
   }
   else if(action==='ad_reward'||action==='premium')throw new AuthError('verification_required',409);
   else throw new AuthError('operation_not_available',409);
   if(value.balance+amount<0)throw new AuthError('insufficient_balance',409);
   value.balance+=amount;
   await db.execute('UPDATE wallets SET balance=? WHERE user_id=?',[value.balance,id]);
   if(amount)await db.execute('INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,?,?)',[id,amount,action,action==='quest'?payload.key:'op:'+requestId]);
   const result={balance:value.balance,state:s};
   await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',[id,requestId,digest,action,JSON.stringify(payload),JSON.stringify(result)]);
   return {...await wallet(db,id),replayed:false};
  })
 };
}
