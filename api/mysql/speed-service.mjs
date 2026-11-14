import {randomUUID,randomInt} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {AuthError} from '../server/auth.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const json=v=>typeof v==='string'?JSON.parse(v):v;
const instant=v=>new Date(v instanceof Date?v:v.includes('T')?v:v.replace(' ','T')+'Z');
const day=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
function choicesFor(row){const choices=json(row.choices),order=[0,1,2,3];for(let i=3;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}return {choices:order.map(i=>choices[i]),answer:order.indexOf(json(row.answer))};}
function publicItem(item,position){if(!item)return null;const {answer,explain,...q}=item.q;return {position,topic:item.topic,q};}
export function createSpeedService({auth,connectionFactory=connect,now=()=>new Date()}){
 async function member(header,action){
  const claims=await auth.verifyAccess(header),db=await connectionFactory();
  try{return await transaction(db,async()=>{const [[user]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[claims.sub]);if(!user||user.status!=='active'||user.auth_version!==claims.av)throw new AuthError('unauthorized',401);return action(db,user.id);});}finally{await db.end();}
 }
 async function stats(db,id){
  const [[r]]=await db.execute(`SELECT COALESCE(MAX(correct_count),0) AS best,COUNT(*) AS plays,COALESCE(SUM(awarded_xp),0) AS totalXp,
   COALESCE(SUM(IF(reward_day=?,awarded_xp,0)),0) AS xpToday FROM speed_runs WHERE user_id=? AND status='completed'`,[day(now()),id]);
  return {best:Number(r.best),plays:Number(r.plays),day:day(now()),xpToday:Number(r.xpToday),totalXp:Number(r.totalXp)};
 }
 async function finish(db,id,run){
  if(run.status==='completed')return {...json(run.result_json),store:await stats(db,id)};
  const before=await stats(db,id);
  const [[used]]=await db.execute("SELECT COALESCE(SUM(awarded_xp),0) AS n FROM speed_runs WHERE user_id=? AND reward_day=? AND status='completed'",[id,run.reward_day]);
  const xp=Math.max(0,Math.min(run.correct_count*3,150-Number(used.n)));
  const result={xp,newBest:run.correct_count>before.best,correct:run.correct_count,total:run.next_position,runId:run.id};
  await db.execute("UPDATE speed_runs SET status='completed',awarded_xp=?,completed_at=?,result_json=? WHERE id=?",[xp,now(),JSON.stringify(result),run.id]);
  return {...result,store:await stats(db,id)};
 }
 async function settleExpired(db,id){const [runs]=await db.execute("SELECT * FROM speed_runs WHERE user_id=? AND status='issued' AND deadline_at<=? ORDER BY started_at,id",[id,now()]);for(const run of runs)await finish(db,id,run);}
 const view=run=>({runId:run.id,deadlineAt:instant(run.deadline_at).toISOString(),serverNow:now().toISOString(),question:run.status==='issued'?publicItem(json(run.questions)[run.next_position],run.next_position):null,completed:run.status==='completed'});
 return {
  stats:header=>member(header,async(db,id)=>{await settleExpired(db,id);return stats(db,id);}),
  start:(header,body)=>member(header,async(db,id)=>{
   if(!UUID.test(body?.requestId??''))throw new AuthError('invalid_request',400);
   await settleExpired(db,id);
   const [[existing]]=await db.execute('SELECT * FROM speed_runs WHERE user_id=? AND request_id=?',[id,body.requestId]);if(existing)return view(existing);
   const [[active]]=await db.execute("SELECT * FROM speed_runs WHERE user_id=? AND status='issued' LIMIT 1",[id]);if(active)return view(active);
   const [rows]=await db.execute(`SELECT q.id,q.topic_id,d.body,d.choices,d.answer,d.explanation,t.name_ko,c.name_ko AS category_name,c.domain_id,t.category_id,t.difficulty
    FROM questions q JOIN question_details d ON d.question_id=q.id JOIN topics t ON t.id=q.topic_id
    JOIN categories c ON c.id=t.category_id JOIN domains dm ON dm.id=c.domain_id
    WHERE q.source='bank' AND q.status='published' AND d.type='mc' AND t.is_active=1 AND c.is_active=1 AND dm.is_active=1
    AND EXISTS(SELECT 1 FROM study_records r WHERE r.user_id=? AND r.topic_id=q.topic_id)
    AND EXISTS(SELECT 1 FROM question_file_items i JOIN question_files f ON f.id=i.file_id WHERE i.question_id=q.id AND f.status='published')
    ORDER BY RAND() LIMIT 100`,[id]);
   if(!rows.length)throw new AuthError('speed_no_questions',409);
   const questions=rows.map(r=>({questionId:r.id,topic:{id:r.topic_id,ko:r.name_ko,categoryName:r.category_name,domain:r.domain_id,category:r.category_id,lv:r.difficulty,level:['','기초','중급','심화'][r.difficulty],en:r.name_ko,hint:''},q:{type:'mc',q:r.body,...choicesFor(r),explain:r.explanation,src:'bank'}}));
   const run={id:randomUUID(),user_id:id,request_id:body.requestId,reward_day:day(now()),started_at:now(),deadline_at:new Date(now().getTime()+60000),questions,next_position:0,status:'issued'};
   await db.execute('INSERT INTO speed_runs(id,user_id,request_id,reward_day,started_at,deadline_at,questions) VALUES (?,?,?,?,?,?,?)',[run.id,id,run.request_id,run.reward_day,run.started_at,run.deadline_at,JSON.stringify(questions)]);
   return view(run);
  }),
  answer:(header,runId,body)=>member(header,async(db,id)=>{
   if(!UUID.test(runId)||!Number.isInteger(body?.position)||!Number.isInteger(body?.answer)||body.answer<0||body.answer>3)throw new AuthError('invalid_answer',400);
   const [[run]]=await db.execute('SELECT * FROM speed_runs WHERE id=? AND user_id=?',[runId,id]);if(!run)throw new AuthError('not_found',404);
   const [[old]]=await db.execute('SELECT submitted_answer,response_json FROM speed_answers WHERE run_id=? AND position=?',[runId,body.position]);
   if(old){if(old.submitted_answer!==body.answer)throw new AuthError('answer_conflict',409);return json(old.response_json);}
   if(run.status!=='issued'||now()>=instant(run.deadline_at))throw new AuthError('speed_expired',409);
   const qs=json(run.questions),item=qs[run.next_position];if(!item||run.next_position!==body.position)throw new AuthError('invalid_position',409);
   const correct=body.answer===item.q.answer,result={correct,answer:item.q.answer,explain:item.q.explain,next:publicItem(qs[body.position+1],body.position+1)};
   await db.execute('INSERT INTO speed_answers(run_id,position,submitted_answer,is_correct,response_json,received_at) VALUES (?,?,?,?,?,?)',[runId,body.position,body.answer,correct,JSON.stringify(result),now()]);
   await db.execute('UPDATE speed_runs SET next_position=next_position+1,correct_count=correct_count+? WHERE id=?',[correct?1:0,runId]);return result;
  }),
  finish:(header,runId)=>member(header,async(db,id)=>{if(!UUID.test(runId))throw new AuthError('not_found',404);const [[run]]=await db.execute('SELECT * FROM speed_runs WHERE id=? AND user_id=?',[runId,id]);if(!run)throw new AuthError('not_found',404);return finish(db,id,run);}),
 };
}
