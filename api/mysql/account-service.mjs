import { connect, transaction } from '../server/db.mjs';
import { AuthError, normalizeEmail, passwordMatches } from '../server/auth.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { nicknameAllowed } from '../server/nickname-policy.mjs';

/** 새로 정하는 닉네임 길이 (기존에 길게 정한 닉네임은 그대로 둠) */
export const NICK_MIN=2, NICK_MAX=5;
/** 닉네임 변경: 첫 변경은 무료, 그다음부터 톱니바퀴 이만큼 */
export const NICKNAME_CHANGE_COST=50;

const asJson=v=>typeof v==='string'?JSON.parse(v):v;
const profile=row=>({nickname:row.nickname,interests:asJson(row.interests),level:row.level,
  studyMinutes:row.study_minutes,reminderEnabled:!!row.reminder_enabled,reminderTime:row.reminder_time});
function validate(value) {
  const p={nickname:value.nickname,interests:value.interests,level:value.level,studyMinutes:value.studyMinutes,
    reminderEnabled:value.reminderEnabled,reminderTime:value.reminderTime};
  if(typeof p.nickname!=='string' || !p.nickname.trim() || [...p.nickname.trim()].length>20 ||
    !Array.isArray(p.interests) || p.interests.length>90 || p.interests.some(x=>typeof x!=='string'||!/^[a-z0-9_-]{1,32}$/.test(x)) ||
    new Set(p.interests).size!==p.interests.length || !Number.isInteger(p.level)||p.level<0||p.level>3 ||
    !Number.isInteger(p.studyMinutes)||p.studyMinutes<1||p.studyMinutes>120 || typeof p.reminderEnabled!=='boolean' ||
    typeof p.reminderTime!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(p.reminderTime)) throw new AuthError('invalid_profile');
  p.nickname=p.nickname.trim();
  if(!nicknameAllowed(p.nickname)) throw new AuthError('nickname_not_allowed');
  return p;
}
/**
 * 닉네임 변경 비용 정산 (같은 거래 안에서). 변경마다 wallet_operations에 'nickname_change' 영수증을 남겨
 * 첫 변경(영수증 0개)은 무료, 이후는 톱니바퀴 차감 + wallet_transactions 기록. DB 구조는 그대로.
 */
async function chargeNicknameChange(db,userId){
  let [[w]]=await db.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE',[userId]);
  if(!w){
    await db.execute('INSERT INTO wallets(user_id,balance) VALUES (?,30)',[userId]);
    await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,30,'starter','starter')",[userId]);
    w={balance:30};
  }
  const [[done]]=await db.execute("SELECT COUNT(*) AS n FROM wallet_operations WHERE user_id=? AND action='nickname_change'",[userId]);
  const cost=Number(done.n)>0?NICKNAME_CHANGE_COST:0;
  if(Number(w.balance)<cost) throw new AuthError('insufficient_balance',409);
  const requestId='nick-'+randomUUID();
  if(cost){
    await db.execute('UPDATE wallets SET balance=balance-? WHERE user_id=?',[cost,userId]);
    await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,'nickname_change',?)",[userId,-cost,requestId]);
  }
  await db.execute("INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,'nickname_change',?,?)",
    [userId,requestId,createHash('sha256').update(requestId).digest(),JSON.stringify({cost}),JSON.stringify({charged:cost})]);
  return cost;
}

export function createAccountService({auth,connectionFactory=connect}) {
  async function withDb(action) {const db=await connectionFactory();try{return await action(db);}finally{await db.end();}}
  async function withUser(header,action) {
    const claims=await auth.verifyAccess(header);
    return withDb(db=>transaction(db,async()=>{
      const [[user]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[claims.sub]);
      if(!user||user.status!=='active'||user.auth_version!==claims.av) throw new AuthError('unauthorized',401);
      return action(db,user);
    }));
  }
  return {
    async getProfile(header) {
      return withUser(header,async(db,user)=>{
        const [[row]]=await db.execute('SELECT * FROM profiles WHERE user_id=?',[user.id]);
        if(!row) throw new AuthError('not_found',404);
        return {profile:profile(row)};
      });
    },
    async saveProfile(header,body) {
      const p=validate(body);
      return withUser(header,async(db,user)=>{
        if(p.interests.length) {
          const marks=p.interests.map(()=>'?').join(',');
          const [rows]=await db.execute(`SELECT id FROM categories WHERE is_active=1 AND id IN (${marks}) UNION SELECT id FROM certificates WHERE is_active=1 AND id IN (${marks})`,[...p.interests,...p.interests]);
          if(rows.length!==p.interests.length) throw new AuthError('invalid_interests');
        }
        const [[old]]=await db.execute('SELECT nickname FROM profiles WHERE user_id=?',[user.id]);
        const changed=!old||old.nickname!==p.nickname;
        // 새로 정하는 닉네임만 2~5자 (예전에 정한 긴 닉네임으로 다른 설정을 저장하는 건 허용)
        const len=[...p.nickname].length;
        if(changed&&(len<NICK_MIN||len>NICK_MAX)) throw new AuthError('nickname_length');
        let nicknameCharged=0;
        if(old&&changed){
          nicknameCharged=await chargeNicknameChange(db,user.id);
          // 닉네임을 바꾸면 이전 닉네임에 대한 신고는 초기화
          await db.execute('DELETE FROM nickname_reports WHERE target_id=?',[user.id]);
        }
        await db.execute(`INSERT INTO profiles(user_id,nickname,interests,level,study_minutes,reminder_enabled,reminder_time)
          VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE nickname=?,interests=?,level=?,study_minutes=?,reminder_enabled=?,reminder_time=?`,
          [user.id,p.nickname,JSON.stringify(p.interests),p.level,p.studyMinutes,p.reminderEnabled,p.reminderTime,
            p.nickname,JSON.stringify(p.interests),p.level,p.studyMinutes,p.reminderEnabled,p.reminderTime]);
        return {profile:p,nicknameCharged};
      });
    },
    async requestDeletion(header) {
      return withUser(header,async(db,user)=>{
        await db.execute("UPDATE users SET status='deleting',deletion_requested_at=UTC_TIMESTAMP(3),auth_version=auth_version+1 WHERE id=?",[user.id]);
        await db.execute('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)) WHERE user_id=?',[user.id]);
        await db.execute(`UPDATE refresh_tokens t JOIN auth_sessions s ON s.id=t.session_id
          SET t.revoked_at=COALESCE(t.revoked_at,UTC_TIMESTAMP(3)) WHERE s.user_id=?`,[user.id]);
        const [[row]]=await db.execute(`SELECT DATE_FORMAT(deletion_requested_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS requested,
          DATE_FORMAT(DATE_ADD(deletion_requested_at,INTERVAL 7 DAY),'%Y-%m-%dT%H:%i:%s.%fZ') AS due FROM users WHERE id=?`,[user.id]);
        return {status:'deleting',deletionRequestedAt:row.requested,deleteAfter:row.due};
      });
    },
    async cancelDeletion(body) {
      const email=normalizeEmail(body.email);
      return withDb(async db=>{
        const [[identity]]=await db.execute("SELECT user_id,password_hash FROM auth_identities WHERE provider='email' AND provider_subject=?",[email]);
        if(!identity||!await passwordMatches(body.password,identity.password_hash)) throw new AuthError('invalid_credentials',401);
        return transaction(db,async()=>{
          const [[user]]=await db.execute(`SELECT id,status,deletion_requested_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY) AS cancellable FROM users WHERE id=? FOR UPDATE`,[identity.user_id]);
          const [[current]]=await db.execute("SELECT password_hash FROM auth_identities WHERE user_id=? AND provider='email'",[identity.user_id]);
          if(!user||current?.password_hash!==identity.password_hash) throw new AuthError('invalid_credentials',401);
          if(user.status==='active') return {cancelled:true};
          if(user.status!=='deleting'||!Number(user.cancellable)) throw new AuthError('deletion_period_expired',409);
          await db.execute("UPDATE users SET status='active',deletion_requested_at=NULL WHERE id=?",[user.id]);
          return {cancelled:true};
        });
      });
    },
  };
}

// Run by an operator/scheduler, never exposed as a public HTTP endpoint.
export async function purgeExpiredAccounts({connectionFactory=connect,limit=100,onlyUserIds}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>1000) throw new Error('invalid purge limit');
  if(onlyUserIds && (!Array.isArray(onlyUserIds)||!onlyUserIds.length)) return {deleted:0};
  const db=await connectionFactory();
  try {
    const restriction=onlyUserIds?` AND id IN (${onlyUserIds.map(()=>'?').join(',')})`:'';
    const [candidates]=await db.execute(`SELECT id FROM users WHERE status='deleting'
      AND deletion_requested_at<=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY)${restriction} ORDER BY deletion_requested_at,id LIMIT ${limit}`,onlyUserIds??[]);
    let deleted=0;
    for(const candidate of candidates) {
      deleted+=await transaction(db,async()=>{
        const [[user]]=await db.execute(`SELECT id,status,deletion_requested_at<=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY) AS due FROM users WHERE id=? FOR UPDATE`,[candidate.id]);
        if(!user||user.status!=='deleting'||!Number(user.due)) return 0;
        await db.execute('DELETE FROM study_records WHERE user_id=?',[user.id]);
        await db.execute('UPDATE quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id SET i.source_attempt_id=NULL,i.source_position=NULL WHERE a.user_id=?',[user.id]);
        await db.execute('DELETE i FROM quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id WHERE a.user_id=?',[user.id]);
        await db.execute('DELETE FROM quiz_attempts WHERE user_id=?',[user.id]);
        await db.execute('DELETE FROM study_record_tombstones WHERE user_id=?',[user.id]);
        await db.execute('DELETE FROM xp_ledger WHERE user_id=?',[user.id]);
        await db.execute('DELETE FROM profiles WHERE user_id=?',[user.id]);
        await db.execute('DELETE t FROM refresh_tokens t JOIN auth_sessions s ON s.id=t.session_id WHERE s.user_id=?',[user.id]);
        await db.execute('DELETE FROM auth_sessions WHERE user_id=?',[user.id]);
        await db.execute('DELETE FROM auth_identities WHERE user_id=?',[user.id]);
        await db.execute('DELETE FROM user_sync_states WHERE user_id=?',[user.id]);
        await db.execute('DELETE FROM users WHERE id=?',[user.id]);
        return 1;
      });
    }
    return {deleted};
  } finally {await db.end();}
}