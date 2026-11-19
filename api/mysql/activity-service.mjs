import {writeLlmLog} from './llm-observation.mjs';
import {enqueueQuizJob} from './quiz-job-service.mjs';
import {selectAiQuestions} from './ai-question-store.mjs';
import {sourceAttemptSql} from './reward-eligibility.mjs';
import {STUDY_EXTEND_SECONDS,STUDY_EXTEND_COST} from './policy/economy.mjs';
import {randomUUID,randomInt} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {AuthError} from '../server/auth.mjs';
import {hash,loadTopics} from '../shared/question-store.mjs';
import {walletState} from './wallet-state.mjs';
import {assetsState,startExam} from './purchase-service.mjs';
import {instant} from './purchase-policy.mjs';
import {parse,rewardStatus,recallTargets,issuedItems,dailyAssignment} from './reward-evidence.mjs';
import {SPECIAL_RULE_VERSION,gradeIssued,gradeIssuedExam,studyElapsed} from './special-reward-policy.mjs';
import {questDateKey} from './policy/quest-time.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const catalog=loadTopics();
const fail=(code,status=409)=>{throw new AuthError(code,status);};
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;};
// 기본 은행 부족분은 기준 데이터·생성 버전을 포함한 스냅샷만 보존한다.
async function questions(db,topicId,count,avoid=new Set(),exclude=new Set()){
 const [[t]]=await db.execute('SELECT t.*,c.name_ko AS category_name,c.domain_id FROM topics t JOIN categories c ON c.id=t.category_id WHERE t.id=?',[topicId]);if(!t)fail('unknown_topic',400);
 const [rows]=await db.execute(`SELECT q.id,d.type,d.body,d.choices,d.answer,d.explanation FROM questions q JOIN question_details d ON d.question_id=q.id WHERE q.topic_id=? AND q.source='bank' AND q.status='published' AND EXISTS(SELECT 1 FROM question_file_items i JOIN question_files f ON f.id=i.file_id WHERE i.question_id=q.id AND f.status='published') ORDER BY q.id`,[topicId]);
 const result=shuffle(rows.filter(q=>!exclude.has(q.body.trim().normalize('NFC')))).sort((a,b)=>Number(avoid.has(a.body))-Number(avoid.has(b.body))).slice(0,count).map(q=>({topicId,questionId:q.id,question:{type:q.type,q:q.body,...(q.type==='mc'?{choices:parse(q.choices)}:{}),answer:parse(q.answer),explain:q.explanation,src:'bank'}}));
 const info=catalog[topicId],hint=info?.hint??`${t.name_ko}은(는) ${t.category_name} 분야의 주제입니다.`;
 for(let n=result.length;n<count;n++){
  const seed=randomUUID(),material={name:t.name_ko,hint,category:t.category_name,distractors:[...new Set(shuffle(Object.entries(catalog).filter(([id,x])=>id!==topicId&&x.ko!==t.name_ko).map(([,x])=>x.ko)))].slice(0,3)};
  result.push({topicId,questionId:null,question:reproducePractice(material,seed,n+1)});
 }
 return result;
}
// 보관한 재료·시드·규칙 버전으로 당시 보기 순서와 정답을 그대로 재현한다.
export function reproducePractice(material,seed,position){
 const choices=[material.name,...material.distractors].sort((a,b)=>hash([seed,a]).localeCompare(hash([seed,b])));
 if(choices.length!==4||new Set(choices).size!==4)fail('questions_unavailable');
 return {type:'mc',q:`다음 설명에 해당하는 주제를 고르세요. (${position})\n${material.hint}`.slice(0,400),choices,answer:choices.indexOf(material.name),explain:material.hint.slice(0,400),src:'offline',generatorVersion:'topic-v1',seed,material};
}
async function storeItems(db,id,items){
 for(let i=0;i<items.length;i++){const x=items[i];await db.execute('INSERT INTO quiz_attempt_items(attempt_id,position,question_id,question_snapshot,topic_id,subject_position,source_attempt_id,source_position) VALUES (?,?,?,?,?,?,?,?)',[id,i+1,x.questionId??null,JSON.stringify({...x.question,...(x.subjectName?{subjectName:x.subjectName}:{}),topicId:x.topicId}),x.topicId,x.subject??null,x.sourceAttemptId??null,x.sourcePosition??null]);}
}
async function receipt(db,id,key,action,payload,value){
 const result={balance:value.balance,state:value.state,assets:await assetsState(db,id)};
 await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',[id,key,Buffer.from(hash({action,payload}),'hex'),action,JSON.stringify(payload),JSON.stringify(result)]);
}
export function createActivityService({auth,connectionFactory=connect,now=()=>new Date(),quizJobsEnabled}){
 async function member(header,action){const claims=await auth.verifyAccess(header),db=await connectionFactory(),observations=[];try{const result=await transaction(db,async()=>{
 const [[u]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[claims.sub]);if(!u||u.status!=='active'||u.auth_version!==claims.av)fail('unauthorized',401);return action(db,u.id,observations);
 });for(const fields of observations)writeLlmLog('quiz_issued',fields);return result;}finally{await db.end();}}
 async function find(db,id,attemptId){if(!UUID.test(attemptId??''))fail('not_found',404);const [[a]]=await db.execute("SELECT * FROM quiz_attempts WHERE id=? AND user_id=? AND rule_version=?",[attemptId,id,SPECIAL_RULE_VERSION]);if(!a)fail('not_found',404);return a;}
 async function view(db,id,a){const items=await issuedItems(db,a.id);const answers=items.map(i=>i.submitted_answer===null?null:parse(i.submitted_answer));
 let result=null;if(a.status==='completed'&&items.length)result=a.purpose==='exam'?gradeIssuedExam(items,answers):gradeIssued(items,answers);
 return {id:a.id,purpose:a.purpose,status:a.status,topicId:a.topic_id,certId:a.certificate_id,startedAt:instant(a.started_at).toISOString(),studyEndedAt:a.study_ended_at?instant(a.study_ended_at).toISOString():null,completedAt:a.completed_at?instant(a.completed_at).toISOString():null,allowedSec:Number(a.allowed_sec),studySec:a.purpose==='study'&&!a.study_ended_at?studyElapsed({startedAt:instant(a.started_at),pausedSec:Number(a.paused_sec),pausedAt:a.paused_at?instant(a.paused_at):null,allowedSec:Number(a.allowed_sec)},now()):Number(a.study_sec),quizSec:a.quiz_sec===null?null:Number(a.quiz_sec),paused:!!a.paused_at,quizFixedAt:a.quiz_fixed_at?instant(a.quiz_fixed_at).toISOString():null,
 items:items.map(i=>({position:Number(i.position),topicId:i.topicId,subject:i.subject,subjectName:i.subjectName,question:i.question})),answers,result,wallet:await walletState(db,id,now())};}
 return {
 status:header=>member(header,(db,id)=>rewardStatus(db,id,now())),
 get:(header,attemptId)=>member(header,async(db,id)=>view(db,id,await find(db,id,attemptId))),
 issue:(header,body)=>member(header,async(db,id)=>{
 const {requestId,purpose,topicId=null,certId=null}=body??{};
 if(!UUID.test(requestId??'')||!['study','recall','exam','review'].includes(purpose))fail('invalid_activity',400);
 const duration=purpose==='study'?body.studySec:0;
 if(!Number.isInteger(duration)||duration<0)fail('invalid_study_time',400);
 const digest=Buffer.from(hash({purpose,topicId,certId,duration}),'hex');
 const [[prior]]=await db.execute('SELECT * FROM quiz_attempts WHERE user_id=? AND purpose=? AND request_id=?',[id,purpose,requestId]);
 if(prior){if(!prior.request_hash.equals(digest))fail('operation_conflict');return view(db,id,prior);}
 const [[taken]]=await db.execute('SELECT id FROM quiz_attempts WHERE id=?',[requestId]);if(taken)fail('operation_conflict');
 if((purpose==='study'&&(typeof topicId!=='string'||!/^[a-z0-9_-]{1,32}$/.test(topicId)))||(purpose==='exam'&&(typeof certId!=='string'||!/^[a-z0-9_-]{1,32}$/.test(certId))))fail('invalid_activity',400);
 const value=await walletState(db,id,now()),attemptId=requestId;let items=[];
 if(purpose==='study'){
  if(duration>(value.state.premium?7200:900))fail('invalid_study_time',400);
  await dailyAssignment(db,id,now());
  const [[t]]=await db.execute('SELECT t.id FROM topics t JOIN categories c ON c.id=t.category_id JOIN domains d ON d.id=c.domain_id WHERE t.id=? AND t.is_active=1 AND c.is_active=1 AND d.is_active=1',[topicId]);if(!t)fail('unknown_topic',400);
 }else if(purpose==='recall'){
  const due=await recallTargets(db,id,now());if(!due.length)fail('recall_not_due');for(const t of due)items.push(...await questions(db,t.topicId,3));
 }else if(purpose==='review'){
  if(!value.state.premium)fail('premium_required');
  const [wrongs]=await db.execute(`SELECT * FROM (SELECT i.*,ROW_NUMBER() OVER(PARTITION BY i.topic_id,COALESCE(i.question_id,SHA2(JSON_EXTRACT(i.question_snapshot,'$.q'),256)) ORDER BY i.answered_at,i.attempt_id,i.position) AS rn FROM quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id WHERE a.user_id=? AND a.status='completed' AND a.verification_status='server_verified' AND a.purpose IN ('study','exam') AND ${sourceAttemptSql()} AND i.is_correct=0 AND i.resolved_at IS NULL) x WHERE rn=1 ORDER BY answered_at,attempt_id,position LIMIT 10`,[id]);
  if(!wrongs.length)fail('review_not_due');
  items=wrongs.map(i=>({topicId:i.topic_id,questionId:i.question_id,question:parse(i.question_snapshot),sourceAttemptId:i.attempt_id,sourcePosition:i.position}));
 }else{
  const [recent]=await db.execute("SELECT i.question_snapshot,i.topic_id FROM quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id WHERE a.user_id=? AND a.purpose='exam' ORDER BY a.created_at DESC,a.id DESC,i.position LIMIT 300",[id]);
  const avoid=new Set(recent.map(i=>parse(i.question_snapshot).q)),avoidTopics=new Set([...new Set(recent.map(i=>i.topic_id))].slice(0,120));
  const [subjects]=await db.execute('SELECT * FROM certificate_subjects WHERE certificate_id=? ORDER BY display_order',[certId]);if(!subjects.length)fail('unknown_certificate',400);
  for(let subject=0;subject<subjects.length;subject++){
   const [pool]=await db.execute(`SELECT DISTINCT t.id FROM certificate_subject_items i JOIN topics t ON t.id=i.topic_id OR t.category_id=i.category_id JOIN categories c ON c.id=t.category_id JOIN domains d ON d.id=c.domain_id WHERE i.subject_id=? AND t.is_active=1 AND c.is_active=1 AND d.is_active=1 ORDER BY t.id`,[subjects[subject].id]);
   if(!pool.length)fail('questions_unavailable');
   const qs=[];for(const t of shuffle(pool))qs.push(...await questions(db,t.id,10,avoid));
   const picked=shuffle(qs).sort((a,b)=>(Number(avoid.has(a.question.q))*2+Number(avoidTopics.has(a.topicId)))-(Number(avoid.has(b.question.q))*2+Number(avoidTopics.has(b.topicId)))).slice(0,10);
   items.push(...picked.map(q=>({...q,question:{...q.question,grading:{version:"exam-v1",subjectMin:.4,totalMin:.6}},subject,subjectName:subjects[subject].name_ko})));
   for(const q of picked)avoid.add(q.question.q);
  }
  if(items.length>500)fail('questions_unavailable');
  // V7의 기존 시작 승인 요청이 있으면 소비 결과를 재사용한다.
  const [[approved]]=await db.execute("SELECT payload FROM wallet_operations WHERE user_id=? AND action='exam_start' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.startId'))=?",[id,attemptId]);
  if(approved){if(parse(approved.payload).certId!==certId)fail('operation_conflict');}
  else{const payload={startId:attemptId,certId};await startExam(db,id,payload,value,now());await receipt(db,id,`activity-exam:${attemptId}`,'exam_start',payload,value);}
 }
 await db.execute(`INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,purpose,certificate_id,request_id,request_hash,rule_version,allowed_sec,study_ended_at) VALUES (?,?,?,'issued','server_verified',?,?,?,?,?,?,?,?)`,[attemptId,id,topicId,now(),purpose,certId,requestId,digest,SPECIAL_RULE_VERSION,duration,purpose==='study'?null:now()]);
 if(purpose==='study'){const job=await enqueueQuizJob(db,topicId,now(),{ownerAttemptId:attemptId,...(quizJobsEnabled===undefined?{}:{enabled:quizJobsEnabled})});await db.execute('UPDATE quiz_attempts SET generation_job_id=? WHERE id=?',[job,attemptId]);}
 await storeItems(db,attemptId,items);return view(db,id,await find(db,id,attemptId));
 }),
 event:(header,attemptId,body)=>member(header,async(db,id,observations)=>{
 const a=await find(db,id,attemptId),{requestId,event}=body??{};if(!UUID.test(requestId??'')||!['pause','resume','quiz','extend'].includes(event))fail('invalid_activity',400);
 const key=`activity-event:${requestId}`,payload={attemptId,event},digest=Buffer.from(hash({action:'activity_event',payload}),'hex');
 const [[old]]=await db.execute('SELECT request_hash FROM wallet_operations WHERE user_id=? AND request_id=?',[id,key]);
 if(old){if(!old.request_hash.equals(digest))fail('operation_conflict');return view(db,id,a);}
 if(a.status!=='issued'||a.purpose!=='study')fail('activity_closed');
 if(a.study_ended_at){if(event==='quiz')return view(db,id,a);fail('study_already_ended');}
 const value=await walletState(db,id,now()),at=now();
 if(event==='pause'&&!a.paused_at)await db.execute('UPDATE quiz_attempts SET paused_at=? WHERE id=?',[at,a.id]);
 if(event==='resume'&&a.paused_at)await db.execute('UPDATE quiz_attempts SET paused_sec=paused_sec+?,paused_at=NULL WHERE id=?',[Math.max(0,Math.floor((at-instant(a.paused_at))/1000)),a.id]);
 if(event==='extend'){
  if(value.balance<STUDY_EXTEND_COST)fail('insufficient_balance');if(a.allowed_sec>=7200)fail('study_limit');
  value.balance-=STUDY_EXTEND_COST;await db.execute('UPDATE wallets SET balance=? WHERE user_id=?',[value.balance,id]);
  await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,'spend',?)",[id,-STUDY_EXTEND_COST,key]);
  const elapsed=Math.max(0,Math.floor((at-instant(a.started_at))/1000)-Number(a.paused_sec));
  const idle=Math.max(0,elapsed-Number(a.allowed_sec));
  await db.execute('UPDATE quiz_attempts SET allowed_sec=LEAST(7200,allowed_sec+?),paused_sec=paused_sec+?,paused_at=NULL WHERE id=?',[STUDY_EXTEND_SECONDS,idle,a.id]);
 }
 if(event==='quiz'){
  const seconds=studyElapsed({startedAt:instant(a.started_at),pausedSec:a.paused_sec,pausedAt:a.paused_at?instant(a.paused_at):null,allowedSec:a.allowed_sec},at);
  const ai=await selectAiQuestions(db,a.topic_id,a.generation_job_id,4,{attemptId:a.id});
  const bank=await questions(db,a.topic_id,7-ai.length,new Set(),new Set(ai.map(x=>x.question.q.trim().normalize('NFC'))));
  const final=shuffle([...ai,...bank]).map((x,i)=>x.question.src==='offline'?{...x,question:reproducePractice(x.question.material,x.question.seed,i+1)}:x);
  await storeItems(db,a.id,final);
  await db.execute('UPDATE quiz_attempts SET study_ended_at=?,quiz_fixed_at=?,study_sec=?,paused_at=NULL WHERE id=?',[at,at,seconds,a.id]);
  observations.push({jobId:a.generation_job_id,attemptId:a.id,topicId:a.topic_id,aiCount:final.filter(x=>x.question.src==='ai').length,bankCount:final.filter(x=>x.question.src==='bank').length,practiceCount:final.filter(x=>x.question.src==='offline').length,totalCount:final.length});
 }
 await receipt(db,id,key,'activity_event',payload,value);return view(db,id,await find(db,id,a.id));
 }),
 answer:(header,attemptId,body)=>member(header,async(db,id)=>{
 const a=await find(db,id,attemptId);if(a.purpose!=='review'||a.status!=='issued')fail('activity_closed');
 const items=await issuedItems(db,a.id),item=items.find(i=>Number(i.position)===body?.position);if(!item)fail('invalid_answers',400);
 const result=gradeIssued([item],[body.answer]),correct=result.score===1;
 if(item.submitted_answer!==null){if(JSON.stringify(parse(item.submitted_answer))!==JSON.stringify(body.answer))fail('answer_conflict');return view(db,id,a);}
 await db.execute('UPDATE quiz_attempt_items SET submitted_answer=?,is_correct=?,answered_at=? WHERE attempt_id=? AND position=?',[JSON.stringify(body.answer),correct,now(),a.id,item.position]);
 if(correct){
  const [[source]]=await db.execute("SELECT topic_id,resolved_at,COALESCE(question_id,SHA2(JSON_EXTRACT(question_snapshot,'$.q'),256)) AS identity_key FROM quiz_attempt_items WHERE attempt_id=? AND position=?",[item.source_attempt_id,item.source_position]);
  // 해결 전에 여러 번 틀린 같은 원본은 묶어서 닫는다. 이후 새로 틀린 문항은 다시 대상이 된다.
  if(!source.resolved_at)await db.execute(`UPDATE quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id SET i.resolved_at=? WHERE a.user_id=? AND a.status='completed' AND a.purpose IN ('study','exam') AND ${sourceAttemptSql()} AND a.verification_status='server_verified' AND i.is_correct=0 AND i.resolved_at IS NULL AND i.topic_id=? AND COALESCE(i.question_id,SHA2(JSON_EXTRACT(i.question_snapshot,'$.q'),256))=?`,[now(),id,source.topic_id,source.identity_key]);
 }
 return view(db,id,a);
 }),
 complete:(header,attemptId,body)=>member(header,async(db,id)=>{
 const a=await find(db,id,attemptId);if(a.purpose==='study')fail('record_upload_required');if(a.status==='abandoned')fail('activity_closed');
 const items=await issuedItems(db,a.id),result=a.purpose==='exam'?gradeIssuedExam(items,body?.answers):gradeIssued(items,body?.answers);
 if(a.status==='completed'){
  if(items.some((item,i)=>JSON.stringify(parse(item.submitted_answer))!==JSON.stringify(body.answers[i])))fail('answer_conflict');return view(db,id,a);
 }
 if(a.purpose==='review'&&items.some((item,i)=>item.submitted_answer===null||JSON.stringify(parse(item.submitted_answer))!==JSON.stringify(body.answers[i])))fail('incomplete_record',400);
 const at=now();for(let i=0;i<items.length;i++)await db.execute('UPDATE quiz_attempt_items SET submitted_answer=?,is_correct=?,answered_at=COALESCE(answered_at,?) WHERE attempt_id=? AND position=?',[JSON.stringify(body.answers[i]),result.items[i].correct,at,a.id,items[i].position]);
 await db.execute("UPDATE quiz_attempts SET status='completed',completed_at=?,quiz_sec=? WHERE id=?",[at,Math.max(0,Math.floor((at-instant(a.study_ended_at))/1000)),a.id]);
 if(a.purpose==='recall'){
  const key=`recall:${questDateKey(at)}`,value=await walletState(db,id,at);
  const [[claimed]]=await db.execute('SELECT id FROM wallet_transactions WHERE user_id=? AND request_id=?',[id,key]);
  if(!claimed){value.balance+=5;await db.execute('UPDATE wallets SET balance=? WHERE user_id=?',[value.balance,id]);await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,5,'quest',?)",[id,key]);await receipt(db,id,key,'recall_complete',{attemptId:a.id},value);}
 }
 return view(db,id,await find(db,id,a.id));
 }),
 abandon:(header,attemptId)=>member(header,async(db,id)=>{const a=await find(db,id,attemptId);if(a.status==='issued')await db.execute("UPDATE quiz_attempts SET status='abandoned' WHERE id=?",[a.id]);return view(db,id,await find(db,id,a.id));}),
 };
}
