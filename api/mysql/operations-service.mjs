// 운영 보존 정책: 학습·답안·지갑·XP·결제·배틀 결과는 자동 삭제하지 않는다.
// 자동 정리: 만료 확인 코드 7일, 알림 90일, 만료/폐기 세션·토큰 30일,
// 참조 없는 종료 생성 작업 90일. 문제·매칭은 검토 후보만 반환한다.
import {createHash} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
const DAY=86400000;
export const RETENTION=Object.freeze({passwordResets:7,notifications:90,sessions:30,jobs:90,questions:90,matches:30});
const definitions=[
 {name:'password_resets',table:'password_resets',key:['id'],days:7,where:'x.expires_at < ?'},
 {name:'notification_log',table:'notification_log',key:['kind','ref','period'],days:90,where:'x.created_at < ?'},
 {name:'refresh_tokens',table:'refresh_tokens',key:['token_hash'],days:30,where:'(x.expires_at < ? OR x.revoked_at < ?)',copies:2},
 {name:'auth_sessions',table:'auth_sessions',key:['id'],days:30,where:'(x.expires_at < ? OR x.revoked_at < ?)',copies:2},
 {name:'quiz_jobs',table:'quiz_jobs',key:['id'],days:90,where:`x.status IN ('succeeded','partial','failed','cancelled') AND x.finished_at < ?
  AND NOT EXISTS(SELECT 1 FROM questions q WHERE q.generation_job_id=x.id)
  AND NOT EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.generation_job_id=x.id)`},
];
const reviewDefinitions=[
 {name:'questions_review',table:'questions',key:['id'],days:90,where:`x.source='ai' AND x.status IN ('draft','disabled') AND x.updated_at < ?
  AND NOT EXISTS(SELECT 1 FROM quiz_attempt_items i WHERE i.question_id=x.id)
  AND NOT EXISTS(SELECT 1 FROM question_file_items i WHERE i.question_id=x.id)`},
 {name:'matches_review',table:'match_entries',key:['id'],days:30,where:`x.status IN ('canceled','expired') AND x.battle_id IS NULL AND x.expires_at < ?
  AND NOT EXISTS(SELECT 1 FROM battle_challenges c WHERE c.from_entry_id=x.id)`},
];
export function maintenanceOptions({apply=false,limit=200,now=new Date()}={}){
 if(typeof apply!=='boolean'||!Number.isInteger(limit)||limit<1||limit>1000||!(now instanceof Date)||!Number.isFinite(+now))throw Error('OPS_INVALID_OPTIONS');
 return {apply,limit,now};
}
function query(d,now,limit,lock=false){
 const cutoff=new Date(+now-d.days*DAY),args=Array(d.copies??1).fill(cutoff);
 return {sql:`SELECT ${d.key.map(k=>'x.'+k).join(',')} FROM ${d.table} x WHERE ${d.where} ORDER BY ${d.key.map(k=>'x.'+k).join(',')} LIMIT ${limit}${lock?' FOR UPDATE SKIP LOCKED':''}`,args};
}
export async function runMaintenance(input={},connectionFactory=connect){
 const {apply,limit,now}=maintenanceOptions(input),db=await connectionFactory();let locked=false;
 const report={policy:'retention-v1',mode:apply?'apply':'preview',at:now.toISOString(),limit,automatic:[],review:[],accounts:{graceDays:30,due:0}};
 let lock;
 try{
  const [[database]]=await db.query('SELECT DATABASE() AS name');
  lock='ops:'+createHash('sha256').update(database.name??'').digest('hex').slice(0,45);
  if(apply){const [[r]]=await db.execute('SELECT GET_LOCK(?,0) AS acquired',[lock]);if(!Number(r.acquired))throw Error('OPS_ALREADY_RUNNING');locked=true;await db.query('SET SESSION innodb_lock_wait_timeout=5');}
  for(const d of definitions){
   const run=async()=>{
    const {sql,args}=query(d,now,limit,apply);const [rows]=await db.execute(sql,args);let deleted=0;
    if(apply)for(const row of rows){
     // 행 잠금 후에도 조건을 다시 확인한다. 참조가 추가되면 FK 오류로 해당 묶음 전체를 롤백한다.
     const [result]=await db.execute(`DELETE x FROM ${d.table} x WHERE ${d.key.map(k=>'x.'+k+'=?').join(' AND ')} AND ${d.where}`,[...d.key.map(k=>row[k]),...args]);deleted+=result.affectedRows;
    }
    return {table:d.name,retentionDays:d.days,selected:rows.length,deleted,possiblyMore:rows.length===limit};
   };
   report.automatic.push(apply?await transaction(db,run):await run());
  }
  for(const d of reviewDefinitions){const {sql,args}=query(d,now,limit);const [rows]=await db.execute(sql,args);report.review.push({type:d.name,retentionDays:d.days,selected:rows.length,ids:rows.map(r=>r.id),deleted:0,automaticDeletion:false,possiblyMore:rows.length===limit});}
  const [[due]]=await db.execute("SELECT COUNT(*) AS n FROM users WHERE status='deleting' AND deletion_requested_at<=DATE_SUB(?,INTERVAL 30 DAY)",[now]);report.accounts.due=Number(due.n);
  return report;
 }catch(error){error.operationsCompleted=report.automatic;throw error;}finally{if(locked)await db.execute('SELECT RELEASE_LOCK(?)',[lock]).catch(()=>{});await db.end();}
}
export async function databaseUsage(connectionFactory=connect){
 const db=await connectionFactory();try{const [rows]=await db.query(`SELECT table_name AS name,table_rows AS approximateRows,COALESCE(data_length,0)+COALESCE(index_length,0) AS bytes FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY bytes DESC,table_name`);return {tables:rows.map(r=>({...r,approximateRows:Number(r.approximateRows??0),bytes:Number(r.bytes)})),totalBytes:rows.reduce((n,r)=>n+Number(r.bytes),0)};}finally{await db.end();}
}
