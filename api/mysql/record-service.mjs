import {verifyBankItems} from './verify-bank.mjs';
import { randomUUID } from 'node:crypto';
import { connect, transaction } from '../server/db.mjs';
import { AuthError } from '../server/auth.mjs';
import { question, hash } from '../shared/question-store.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sourceSet=new Set(['bank','ai','offline']);
const json=v=>typeof v==='string'?JSON.parse(v):v;
const iso=v=>new Date(v.includes('T')?v:`${v.replace(' ','T')}Z`).toISOString();
const day=d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10);
const prev=d=>new Date(Date.parse(d+'T00:00:00Z')-86400000).toISOString().slice(0,10);
class RecordError extends AuthError {constructor(code,status=400,details={}){super(code,status);this.details=details;}}
export function validateRecord(p) {
 if(!p||typeof p!=='object'||!UUID.test(p.id??'')||!UUID.test(p.attemptId??p.id??'')||typeof p.topicId!=='string'||!/^[a-z0-9_-]{1,32}$/.test(p.topicId)||
  typeof p.memo!=='string'||[...p.memo].length>5000||!Number.isInteger(p.studySec)||p.studySec<0||p.studySec>2147483647||
  !Number.isInteger(p.score)||p.score<0||p.score>p.total||!Number.isInteger(p.total)||p.total<5||p.total>10||(p.studyType!==undefined&&p.studyType!=='study')||typeof p.studiedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.studiedAt))throw new RecordError('invalid_record');
 const date=new Date(p.studiedAt);if(!Number.isFinite(date.getTime())||date.getUTCFullYear()<1000||date.toISOString()!==p.studiedAt)throw new RecordError('invalid_record');
 if(!Array.isArray(p.items)||p.items.length!==p.total)throw new RecordError('incomplete_record');
 const items=p.items.map(item=>{
  if(!item||typeof item!=='object')throw new RecordError('invalid_answers');
  let q;try{q=question(item.question);}catch{throw new RecordError('invalid_answers');}
  const src=item.question.src??'offline';if(!sourceSet.has(src))throw new RecordError('invalid_answers');
  const answer=item.answer??null;
  if(answer!==null && (q.type==='mc'? !Number.isInteger(answer)||answer<0||answer>3 : typeof answer!=='boolean'))throw new RecordError('invalid_answers');
  return {question:{...q,src},answer};
 });
 const score=items.filter(i=>i.answer!==null&&i.answer===i.question.answer).length;
 if(score!==p.score)throw new RecordError('invalid_score');
 return {id:p.id,attemptId:p.attemptId??p.id,topicId:p.topicId,memo:p.memo,studySec:p.studySec,studiedAt:p.studiedAt,total:p.total,score,items};
}
export function calculateXp(difficulty,score,prior,streak,total=7) {
 const per=[0,6,9,13][difficulty],repeat=prior===0?1:prior===1?.7:.5;
 const base=Math.round(score*per*repeat),parts=[{label:'기본 경험치',value:base}];
 if(score===total)parts.push({label:'만점 보너스',value:Math.round(base*.2)});
 if(prior===0&&score>=Math.ceil(total*.7))parts.push({label:'첫 시도 클리어',value:difficulty*10});
 if(streak>=3)parts.push({label:'연속 학습 보너스',value:Math.round(base*.1)});
 return {total:parts.reduce((n,p)=>n+p.value,0),parts,base,repeat,priorAttempts:prior,streak};
}
export function createRecordService({auth,connectionFactory=connect,now=()=>new Date()}) {
 async function withUser(header,action){
  const claims=await auth.verifyAccess(header),db=await connectionFactory();
  try{return await transaction(db,async()=>{
   const [[u]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[claims.sub]);
   if(!u||u.status!=='active'||u.auth_version!==claims.av)throw new RecordError('unauthorized',401);
   const [[state]]=await db.execute('SELECT last_change_seq,min_available_seq FROM user_sync_states WHERE user_id=? FOR UPDATE',[u.id]);
   if(!state)throw new Error('Missing sync state');
   return action(db,u,state);
  });}finally{await db.end();}
 }
 async function nextSeq(db,user,state){const n=(BigInt(state.last_change_seq)+1n).toString();await db.execute('UPDATE user_sync_states SET last_change_seq=? WHERE user_id=?',[n,user.id]);state.last_change_seq=n;return n;}
 async function read(db,user,ids){
  if(!ids.length)return [];
  const [records]=await db.execute(`SELECT r.*,a.verification_status,l.calculation_details FROM study_records r
   JOIN quiz_attempts a ON a.id=r.attempt_id JOIN xp_ledger l ON l.user_id=r.user_id AND l.source_record_id=r.id AND l.event_type='award'
   WHERE r.user_id=? AND r.id IN (${ids.map(()=>'?').join(',')}) ORDER BY r.studied_at,r.id`,[user.id,...ids]);
  if(!records.length)return [];
  const map=new Map();
  for(let start=0;start<records.length;start+=100){
   const batch=records.slice(start,start+100).map(r=>r.attempt_id);
   const [items]=await db.execute(`SELECT * FROM quiz_attempt_items WHERE attempt_id IN (${batch.map(()=>'?').join(',')}) ORDER BY attempt_id,position`,batch);
   for(const item of items){const list=map.get(item.attempt_id)??[];list.push(item);map.set(item.attempt_id,list);}
  }
  return records.map(r=>{
   const items=map.get(r.attempt_id)??[],snapshots=items.map(i=>json(i.question_snapshot)),details=json(r.calculation_details);
   return {studyType:r.study_type,battleId:r.battle_id,rankScore:r.rank_score===null?undefined:Number(r.rank_score),countsAsStudy:r.study_type!=='battle'||r.study_date!==null,id:r.id,attemptId:r.attempt_id,topicId:r.topic_id,topicKo:r.topic_ko,domain:r.domain,category:r.category,
    level:['','기초','중급','심화'][r.difficulty],memo:r.memo,score:r.score,total:r.quiz_total,rp:r.rp,studySec:r.study_sec,
    studiedAt:iso(r.studied_at),studyDate:r.study_date,changeSeq:String(r.change_seq),synced:true,verificationStatus:r.verification_status,
    quizSource:snapshots.some(q=>q.src==='ai')?'ai':snapshots.some(q=>q.src==='bank')?'bank':'offline',
    wrong:items.filter(i=>Number(i.is_correct)===0).map(i=>{const q=json(i.question_snapshot);return {q:q.q,answer:q.type==='mc'?q.choices[q.answer]:q.answer?'O (맞다)':'X (틀리다)',explain:q.explain};}),
    items:items.map(i=>{const s=json(i.question_snapshot);return {stage:s.stage??'main',question:{...question(s),src:s.src},answer:i.submitted_answer===null?null:json(i.submitted_answer)};}),
    xpParts:details.parts??[],streak:details.streak??0};
  });
 }
 async function one(db,user,id){return (await read(db,user,[id]))[0]??null;}
 return {
  async upload(header,body){
   if(!Array.isArray(body.records)||body.records.length<1||body.records.length>100)throw new RecordError('invalid_batch');
   const sorted=body.records.map((r,index)=>({r,index})).sort((a,b)=>String(a.r?.studiedAt??'').localeCompare(String(b.r?.studiedAt??''))||String(a.r?.id??'').localeCompare(String(b.r?.id??'')));
   const results=[];
   for(const {r,index} of sorted){
    try{
     const p=validateRecord(r),digest=Buffer.from(hash({attemptId:p.attemptId,topicId:p.topicId,studySec:p.studySec,studiedAt:p.studiedAt,total:p.total,score:p.score,items:p.items}),'hex');
     const record=await withUser(header,async(db,user,state)=>{
      const [[existing]]=await db.execute('SELECT user_id,submission_hash FROM study_records WHERE id=?',[p.id]);
      if(existing){if(existing.user_id!==user.id||!existing.submission_hash.equals(digest))throw new RecordError('record_conflict',409);return one(db,user,p.id);}
      const [[used]]=await db.execute('SELECT id FROM xp_ledger WHERE user_id=? AND source_record_id=? LIMIT 1',[user.id,p.id]);
      const [[tomb]]=await db.execute('SELECT record_id FROM study_record_tombstones WHERE user_id=? AND record_id=?',[user.id,p.id]);
      if(used||tomb)throw new RecordError('record_deleted',409);
      const [[attempt]]=await db.execute('SELECT id FROM quiz_attempts WHERE id=?',[p.attemptId]);
      if(attempt)throw new RecordError('attempt_conflict',409);
      const [[topic]]=await db.execute('SELECT t.*,c.domain_id FROM topics t JOIN categories c ON c.id=t.category_id WHERE t.id=?',[p.topicId]);
      if(!topic)throw new RecordError('unknown_topic');
      const verification=await verifyBankItems(db,p.topicId,p.items);
      const received=now(),studied=new Date(p.studiedAt),future=studied-received>300000;
      const studyDate=!future&&received-studied<=30*86400000?day(new Date(Math.min(studied.getTime(),received.getTime()))):null;
      const [[prior]]=await db.execute("SELECT COUNT(*) AS n FROM xp_ledger WHERE user_id=? AND topic_id=? AND event_type='award' AND source_type='study'",[user.id,p.topicId]);
      let streak=0;
      if(studyDate){const [days]=await db.execute('SELECT DISTINCT study_date FROM study_records WHERE user_id=? AND study_date<=?',[user.id,studyDate]);const set=new Set(days.map(d=>d.study_date));set.add(studyDate);for(let d=studyDate;set.has(d);d=prev(d))streak++;}
      const xp=calculateXp(topic.difficulty,p.score,Number(prior.n),streak,p.total),seq=await nextSeq(db,user,state);
      await db.execute("INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,completed_at) VALUES (?,?,?,'completed',?,?,?)",[p.attemptId,user.id,p.topicId,verification,studied,studied]);
      for(let i=0;i<p.total;i++){
       const item=p.items[i],snapshot={...item.question,topicId:p.topicId,topicKo:topic.name_ko,domain:topic.domain_id,category:topic.category_id,difficulty:topic.difficulty};
       await db.execute('INSERT INTO quiz_attempt_items(attempt_id,position,question_id,question_snapshot,submitted_answer,is_correct,answered_at) VALUES (?,?,?,?,?,?,?)',
        [p.attemptId,i+1,item.questionId??null,JSON.stringify(snapshot),item.answer===null?null:JSON.stringify(item.answer),item.answer!==null&&item.answer===item.question.answer,studied]);
      }
      await db.execute(`INSERT INTO study_records(id,user_id,attempt_id,topic_id,topic_ko,domain,category,difficulty,memo,score,quiz_total,rp,study_sec,studied_at,study_date,time_validation_status,submission_hash,change_seq,received_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[p.id,user.id,p.attemptId,p.topicId,topic.name_ko,topic.domain_id,topic.category_id,topic.difficulty,p.memo,p.score,p.total,xp.total,p.studySec,studied,studyDate,future?'needs_review':'accepted',digest,seq,received]);
      await db.execute("INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,rule_version,verification_status,calculation_details,idempotency_key) VALUES (?,?,?,?,'award',?,'rp-v1',?,?,?)",[randomUUID(),user.id,p.id,p.topicId,xp.total,verification,JSON.stringify(xp),`award:${user.id}:${p.id}`]);
      return one(db,user,p.id);
     });
     results.push({index,id:p.id,ok:true,record});
    }catch(error){
     if(error instanceof AuthError){if(error.status===401)throw error;results.push({index,id:r?.id??null,ok:false,error:error.code});}
     else if(error.code==='ER_DUP_ENTRY')results.push({index,id:r?.id??null,ok:false,error:'record_conflict'});
     else throw error;
    }
   }
   results.sort((a,b)=>a.index-b.index);return {saved:results.filter(r=>r.ok).length,results};
  },
  async snapshot(header){return withUser(header,async(db,user,state)=>{const [ids]=await db.execute('SELECT id FROM study_records WHERE user_id=? ORDER BY studied_at,id',[user.id]);return {records:await read(db,user,ids.map(r=>r.id)),cursor:String(state.last_change_seq)};});},
  async list(header,params){
   const limit=Number(params.get('limit')??100);if(!Number.isInteger(limit)||limit<1||limit>100)throw new RecordError('invalid_cursor');
   let cursor=null;if(params.has('cursor')){try{cursor=JSON.parse(Buffer.from(params.get('cursor'),'base64url').toString());if(!UUID.test(cursor.id)||new Date(cursor.at).toISOString()!==cursor.at)throw new Error();}catch{throw new RecordError('invalid_cursor');}}
   return withUser(header,async(db,user)=>{const where=cursor?' AND (studied_at>? OR (studied_at=? AND id>?))':'';
    const args=cursor?[user.id,new Date(cursor.at),new Date(cursor.at),cursor.id]:[user.id];
    const [ids]=await db.execute(`SELECT id,studied_at FROM study_records WHERE user_id=?${where} ORDER BY studied_at,id LIMIT ${limit+1}`,args);
    const page=ids.slice(0,limit),last=page.at(-1);return {records:await read(db,user,page.map(r=>r.id)),nextCursor:ids.length>limit?Buffer.from(JSON.stringify({id:last.id,at:iso(last.studied_at)})).toString('base64url'):null};
   });
  },
  async get(header,id){if(!UUID.test(id))throw new RecordError('not_found',404);return withUser(header,async(db,user)=>{const record=await one(db,user,id);if(!record)throw new RecordError('not_found',404);return {record};});},
  async memo(header,id,body){
   if(!UUID.test(id)||typeof body.memo!=='string'||[...body.memo].length>5000||!/^\d{1,20}$/.test(String(body.baseChangeSeq)))throw new RecordError('invalid_memo');
   return withUser(header,async(db,user,state)=>{const [[r]]=await db.execute('SELECT memo,change_seq FROM study_records WHERE user_id=? AND id=?',[user.id,id]);
    if(!r)throw new RecordError('not_found',404);
    if(r.memo===body.memo)return {record:await one(db,user,id)};
    if(BigInt(r.change_seq)!==BigInt(body.baseChangeSeq))throw new RecordError('memo_conflict',409,{record:await one(db,user,id)});
    const seq=await nextSeq(db,user,state);await db.execute('UPDATE study_records SET memo=?,change_seq=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[body.memo,seq,id]);
    return {record:await one(db,user,id)};
   });
  },
  async remove(header,id){
   if(!UUID.test(id))throw new RecordError('not_found',404);
   return withUser(header,async(db,user,state)=>{const [[r]]=await db.execute('SELECT attempt_id,study_type FROM study_records WHERE user_id=? AND id=?',[user.id,id]);
    if(!r){const [[gone]]=await db.execute("SELECT id FROM xp_ledger WHERE user_id=? AND source_record_id=? AND event_type='reversal'",[user.id,id]);if(gone)return;throw new RecordError('not_found',404);}
    if(r.study_type==='battle')throw new RecordError('battle_record_locked',409);
    const [[award]]=await db.execute("SELECT * FROM xp_ledger WHERE user_id=? AND source_record_id=? AND event_type='award'",[user.id,id]);if(!award)throw new Error('Missing award');
    const seq=await nextSeq(db,user,state);
    await db.execute('DELETE FROM study_records WHERE user_id=? AND id=?',[user.id,id]);
    await db.execute('DELETE FROM quiz_attempt_items WHERE attempt_id=?',[r.attempt_id]);
    await db.execute("INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,reverses_entry_id,rule_version,verification_status,calculation_details,idempotency_key) VALUES (?,?,?,?,'reversal',?,?,?,?,JSON_OBJECT(),?)",[randomUUID(),user.id,id,award.topic_id,-award.amount,award.id,award.rule_version,award.verification_status,`reversal:${user.id}:${id}`]);
    await db.execute('INSERT INTO study_record_tombstones(user_id,record_id,change_seq,deleted_at,expires_at) VALUES (?,?,?,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 90 DAY))',[user.id,id,seq]);
   });
  },
  async changes(header,params){
   const cursor=params.get('cursor')??'0',limit=Number(params.get('limit')??100);
   if(!/^\d{1,20}$/.test(cursor)||!Number.isInteger(limit)||limit<1||limit>100)throw new RecordError('invalid_cursor');
   return withUser(header,async(db,user,state)=>{
    if(BigInt(cursor)<BigInt(state.min_available_seq))throw new RecordError('full_resync_required',409);
    if(BigInt(cursor)>BigInt(state.last_change_seq))throw new RecordError('invalid_cursor');
    const [rows]=await db.execute(`SELECT id,change_seq,0 AS deleted FROM study_records WHERE user_id=? AND change_seq>?
     UNION ALL SELECT record_id AS id,change_seq,1 AS deleted FROM study_record_tombstones WHERE user_id=? AND change_seq>?
     ORDER BY change_seq LIMIT ${limit+1}`,[user.id,cursor,user.id,cursor]);
    const page=rows.slice(0,limit),records=await read(db,user,page.filter(r=>!Number(r.deleted)).map(r=>r.id)),byId=new Map(records.map(r=>[r.id,r]));
    return {changes:page.map(r=>({id:r.id,changeSeq:String(r.change_seq),deleted:!!Number(r.deleted),...(Number(r.deleted)?{}:{record:byId.get(r.id)})})),cursor:page.length?String(page.at(-1).change_seq):String(state.last_change_seq),hasMore:rows.length>limit};
   });
  },
  async stats(header){return withUser(header,async(db,user)=>{const [[xp]]=await db.execute('SELECT COALESCE(SUM(amount),0) AS n FROM xp_ledger WHERE user_id=?',[user.id]);
   const [topics]=await db.execute("SELECT topic_id AS topicId,COUNT(*) AS attempts,SUM(COALESCE(rank_score,score)) AS correct,MAX(COALESCE(rank_score,score)) AS best,MAX(IF(study_type='battle',rank_score=5,score=quiz_total)) AS perfect FROM study_records WHERE user_id=? AND (study_type='study' OR study_date IS NOT NULL) GROUP BY topic_id",[user.id]);
   const [[speed]]=await db.execute("SELECT COALESCE(SUM(awarded_xp),0) AS n FROM speed_runs WHERE user_id=?",[user.id]);
   return {totalXp:Math.max(0,Number(xp.n)+Number(speed.n)),studyXp:Number(xp.n),speedXp:Number(speed.n),topics:topics.map(t=>({...t,attempts:Number(t.attempts),correct:Number(t.correct),perfect:!!Number(t.perfect)}))};
  });},
 };
}
