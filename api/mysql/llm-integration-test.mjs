// 임시 MySQL에서만 실행하는 실제 큐·출제·채점 검사. 강의실 PC·RDS를 호출하지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {connect,transaction} from '../server/db.mjs';
import {createAuth} from '../server/auth.mjs';
import {createActivityService} from './activity-service.mjs';
import {createMemberService} from './member-service.mjs';
import {createRecordService} from './record-service.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
import {createQuizJobWorker,enqueueQuizJob} from './quiz-job-service.mjs';
import {saveAiQuestions,parseJson} from './ai-question-store.mjs';
import {importAiQuizzes} from './import-ai-quizzes.mjs';
const q=n=>({type:'mc',q:'AI 검증 문제 '+n,choices:['가','나','다','라'],answer:2,explain:'서버 검증 해설 '+n});
test('LLM 실제 DB: 큐·발급·채점·보상·JSON 가져오기',async t=>{
 const db=await connect(),users=[],topics=[],bankJobs=[],auth=createAuth({secret:randomBytes(48).toString('hex')});
 const makeTopic=async()=>{const id='llm-'+randomBytes(6).toString('hex');await db.execute("INSERT INTO topics(id,category_id,name_ko,difficulty) VALUES (?,'ds',?,1)",[id,id]);topics.push(id);return id;};
 const a=await auth.signup({email:randomUUID()+'@example.com',password:'Llm-Test!12345'});users.push(a.user.id);const h='Bearer '+a.accessToken;
 const activity=createActivityService({auth,quizJobsEnabled:true}),records=createRecordService({auth});
 const settings={url:'http://127.0.0.1:1',token:'fake-test-token',enabled:true};
 const worker=(reply,opts={})=>createQuizJobWorker({settings,fetcher:reply,...opts});
 const response=(topic,qs=Array.from({length:4},(_,i)=>q(i)))=>new Response(JSON.stringify({topicId:topic,questions:qs,model:'qwen3:14b',generated:qs.length,seconds:1}));
 const job=id=>db.execute('SELECT * FROM quiz_jobs WHERE id=?',[id]).then(([r])=>r[0]);
 const issue=topicId=>activity.issue(h,{requestId:randomUUID(),purpose:'study',topicId,studySec:60});
 t.after(async()=>{
  for(const id of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=?",[id]);await purgeExpiredAccounts({onlyUserIds:users});
  for(const id of bankJobs){await db.execute('DELETE d FROM question_details d JOIN questions q ON q.id=d.question_id WHERE q.generation_job_id=?',[id]);await db.execute('DELETE FROM questions WHERE generation_job_id=?',[id]);await db.execute('DELETE FROM quiz_jobs WHERE id=?',[id]);}
  for(const id of topics){await db.execute('DELETE d FROM question_details d JOIN questions q ON q.id=d.question_id WHERE q.topic_id=?',[id]);await db.execute('DELETE FROM questions WHERE topic_id=?',[id]);await db.execute('DELETE FROM quiz_jobs WHERE topic_id=?',[id]);await db.execute('DELETE FROM topics WHERE id=?',[id]);}await db.end();
 });
 if(process.env.AI_IMPORT_FILE)await t.test('전달받은 2145개 실제 JSON·summary 가져오기·반복 실행 검증',async()=>{
  const report=await importAiQuizzes(db,{file:process.env.AI_IMPORT_FILE,summaryFile:process.env.AI_IMPORT_SUMMARY});assert.equal(report.sourceQuestions,2145);assert.equal(report.sourceTopics,1052);assert.equal(report.emptyTopics.length,293);assert.equal(report.summary.matches,true);assert.equal(report.summary.countsMatch,true);assert.deepEqual(report.missingTopics.filter(x=>!x.startsWith('llm-')),['en-water-02','theory-01']);
  // 앞에서 만든 검사 주제는 실제 카탈로그 비교 대상에서 제외한다.
  const officialMissing=report.missingTopics.filter(x=>!topics.includes(x));assert.equal(officialMissing.length,2);
  const again=await importAiQuizzes(db,{file:process.env.AI_IMPORT_FILE});assert.equal(again.inserted,0);
  if(process.env.AI_IMPORT_REPORT)fs.writeFileSync(process.env.AI_IMPORT_REPORT,JSON.stringify(report,null,2));
  console.log('AI_IMPORT_RESULT',JSON.stringify({inserted:report.inserted,reused:report.reused,rejected:report.rejected.length,activeQuestions:report.activeQuestions,missing:officialMissing}));
  // 다른 회귀 검사에 AI 은행이 섞이지 않게, 이 테스트가 적재한 사전 문제만 제거한다.
  await db.execute("DELETE d FROM question_details d JOIN questions q ON q.id=d.question_id WHERE q.source='ai' AND q.generation_job_id IS NULL");await db.execute("DELETE FROM questions WHERE source='ai' AND generation_job_id IS NULL");
 });
 let topic,attempt,jid;
 await t.test('동시 학습·재전송은 주제 작업 하나를 공유하고 HTTP는 짧은 등록 이후 실행',async()=>{
  topic=await makeTopic();const results=await Promise.all([issue(topic),issue(topic)]);attempt=results[0];
  const [rows]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id IN (?,?)',results.map(x=>x.id));assert.equal(rows[0].generation_job_id,rows[1].generation_job_id);jid=rows[0].generation_job_id;
  const replay=await activity.issue(h,{requestId:attempt.id,purpose:'study',topicId:topic,studySec:60});assert.equal(replay.id,attempt.id);assert.equal((await job(jid)).attempt_count,0);
 });
 await t.test('실제 가짜 HTTP 서버의 기존 API 형식·인증 헤더를 사용하고 생성 결과를 원자 저장',async()=>{
  const server=createServer(async(req,res)=>{assert.equal(req.url,'/quiz');assert.equal(req.headers['x-quiz-token'],'fake-test-token');let body='';for await(const c of req)body+=c;assert.deepEqual(JSON.parse(body),{topicId:topic,count:4});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({topicId:topic,questions:Array.from({length:4},(_,i)=>q(i)),model:'qwen3:14b',generated:4,seconds:1}));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const w=createQuizJobWorker({settings:{...settings,url:'http://127.0.0.1:'+server.address().port}});assert.equal(await w.runOnce(),true);w.stop();}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  const saved=await job(jid);assert.equal(saved.status,'succeeded');assert.equal(Number(saved.accepted_count),4);assert(saved.response_hash);assert.equal(parseJson(saved.result_summary).questionIds.length,4);
 });
 await t.test('AI 4개와 보충 3개를 확정·재진입 불변·정답 변조 무시·XP 및 부스터 자격',async()=>{
  const fixed=await activity.event(h,attempt.id,{requestId:randomUUID(),event:'quiz'});assert.equal(fixed.items.length,7);assert(fixed.quizFixedAt);assert.equal(fixed.items.filter(x=>x.question.src==='ai').length,4);assert.equal(new Set(fixed.items.map(x=>x.question.q)).size,7);
  const again=await activity.event(h,attempt.id,{requestId:randomUUID(),event:'quiz'});assert.deepEqual(again.items,fixed.items);
  const members=createMemberService({auth});await members.wallet(h);await db.execute('UPDATE wallets SET balance=100 WHERE user_id=?',[a.user.id]);await members.operate(h,{requestId:randomUUID(),action:'spend',payload:{product:'xp_boost'}});
  const body={id:attempt.id,attemptId:attempt.id,topicId:topic,memo:'AI 채점 검사',studySec:60,score:0,total:7,studiedAt:new Date().toISOString(),items:fixed.items.map(i=>({question:{...i.question,answer:0},answer:i.question.answer}))};
  const out=await records.upload(h,{records:[body]});assert.equal(out.results[0].ok,true,JSON.stringify(out));const r=out.results[0].record;assert.equal(r.score,7);assert.equal(r.rewardStatus,'eligible');assert.equal(r.verificationStatus,'server_verified');assert.equal(r.quizSource,'ai');assert.equal(r.eligibility.questEligible,true);assert.equal(r.eligibility.rankEligible,true);assert(r.xpParts.some(x=>x.label==='부스터 2배'));
  assert.equal((await records.upload(h,{records:[body]})).results[0].record.rp,r.rp);
  const [[n]]=await db.execute("SELECT COUNT(*) AS n FROM xp_ledger WHERE source_record_id=? AND event_type='award'",[attempt.id]);assert.equal(Number(n.n),1);
 });
 await t.test('기본 은행이 있으면 AI 4+기본 3, 기기 단독 AI 업로드는 보상 불인정',async()=>{
  const x=await issue('ds-01'),[[row]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[x.id]);bankJobs.push(row.generation_job_id);
  await worker(async()=>response('ds-01')).runOnce();
  const fixed=await activity.event(h,x.id,{requestId:randomUUID(),event:'quiz'});assert.equal(fixed.items.filter(i=>i.question.src==='ai').length,4);assert.equal(fixed.items.filter(i=>i.question.src==='bank').length,3);
  const untrusted={id:randomUUID(),topicId:'ds-01',memo:'',studySec:60,score:7,total:7,studiedAt:new Date().toISOString(),items:fixed.items.map(i=>({question:i.question,answer:i.question.answer}))};
  const out=await records.upload(h,{records:[untrusted]});assert.equal(out.results[0].record.rewardStatus,'ineligible');assert.equal(out.results[0].record.rp,0);
 });
 await t.test('토큰 미설정은 생성 호출 없이 실패 이력·은행 보충, 대기 중 만료 작업은 복구 처리',async()=>{
  const id=await makeTopic(),off=createActivityService({auth,quizJobsEnabled:false});
  const x=await off.issue(h,{requestId:randomUUID(),purpose:'study',topicId:id,studySec:0});const [[r]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[x.id]);assert.equal((await job(r.generation_job_id)).status,'failed');assert.equal(parseJson((await job(r.generation_job_id)).result_summary).reason,'not_configured');
  assert.equal((await off.event(h,x.id,{requestId:randomUUID(),event:'quiz'})).items.length,7);
  const y=await issue(id),[[j]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[y.id]);
  await db.execute('UPDATE quiz_jobs SET created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 20 MINUTE),deadline_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=?',[j.generation_job_id]);
  assert.equal(await worker(async()=>{throw Error('must not call');}).runOnce(),false);assert.equal((await job(j.generation_job_id)).status,'failed');
 });
 await t.test('조기 출제 뒤 응답은 문제 은행에만 저장하고 현재 문항을 바꾸지 않음',async()=>{
  const id=await makeTopic(),x=await issue(id),[[row]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[x.id]);
  const fixed=await activity.event(h,x.id,{requestId:randomUUID(),event:'quiz'});assert(fixed.items.every(x=>x.question.src!=='ai'));
  await worker(async()=>response(id)).runOnce();assert.equal((await job(row.generation_job_id)).status,'succeeded');assert.deepEqual((await activity.get(h,x.id)).items,fixed.items);
  const next=await issue(id),picked=await activity.event(h,next.id,{requestId:randomUUID(),event:'quiz'});assert.equal(picked.items.filter(i=>i.question.src==='ai').length,4);
  await db.execute("UPDATE quiz_jobs SET status='cancelled',finished_at=UTC_TIMESTAMP(3) WHERE topic_id=? AND status='queued'",[id]);
 });
 await t.test('부분 응답·중복·주제 불일치·빈 응답 처리',async()=>{
  for(const kind of ['partial','wrong','empty']){
   const id=await makeTopic(),x=await issue(id),[[r]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[x.id]);
   await worker(async()=>kind==='wrong'?response('wrong-topic'):response(id,kind==='empty'?[]:[q(1),q(1),{...q(2),answer:9}])).runOnce();
   const j=await job(r.generation_job_id);assert.equal(j.status,kind==='partial'?'partial':'failed');assert.equal(Number(j.accepted_count),kind==='partial'?1:0);
   assert.equal((await activity.event(h,x.id,{requestId:randomUUID(),event:'quiz'})).items.length,7);
  }
 });
 await t.test('전달 여부가 불명확한 시간 초과는 재요청하지 않고 연결 전 실패만 제한 재시도',async()=>{
  for(const code of ['ECONNREFUSED','UND_ERR_HEADERS_TIMEOUT']){
   const id=await makeTopic(),x=await issue(id),[[r]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[x.id]);
   const w=worker(async()=>{throw Object.assign(new TypeError('fake'),{cause:{code}});});await w.runOnce();let j=await job(r.generation_job_id);assert.equal(j.status,code==='ECONNREFUSED'?'queued':'failed');
   if(j.status==='queued'){await db.execute('UPDATE quiz_jobs SET available_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=?',[j.id]);await w.runOnce();j=await job(j.id);assert.equal(j.status,'failed');assert.equal(Number(j.attempt_count),2);}
  }
 });
 await t.test('다중 처리 프로그램도 한 요청만 실행·점유 만료와 늦은 응답 차단',async()=>{
  const id=await makeTopic(),x=await issue(id),[[r]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[x.id]);let release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);let calls=0;
  const w=worker(async()=>{calls++;started();await gate;return response(id);});const pending=w.runOnce();await ready;
  assert.equal(await worker(async()=>{calls++;return response(id);}).runOnce(),false);assert.equal(calls,1);
  await db.execute('UPDATE quiz_jobs SET lease_expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=?',[r.generation_job_id]);await worker(async()=>response(id)).runOnce();release();await pending;assert.equal((await job(r.generation_job_id)).status,'failed');
  const [[n]]=await db.execute("SELECT COUNT(*) AS n FROM questions WHERE topic_id=? AND source='ai'",[id]);assert.equal(Number(n.n),0);
 });
 await t.test('저장 중 오류는 문제·상세·작업 완료를 함께 롤백',async()=>{
  const id=await makeTopic(),x=await issue(id),[[r]]=await db.execute('SELECT generation_job_id FROM quiz_attempts WHERE id=?',[x.id]);
  const factory=async()=>{const c=await connect();return new Proxy(c,{get(target,k){if(k==='execute')return(sql,args)=>{if(sql.startsWith('INSERT INTO question_details'))throw Error('fake storage error');return target.execute(sql,args);};const v=target[k];return typeof v==='function'?v.bind(target):v;}});};
  await worker(async()=>response(id),{connectionFactory:factory}).runOnce();assert.equal((await job(r.generation_job_id)).status,'failed');const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM questions WHERE topic_id=?',[id]);assert.equal(Number(n.n),0);
 });
 await t.test('API 실행 프로세스가 작업을 자동 처리하고 학습 HTTP 응답은 생성을 기다리지 않음',async()=>{
  const id=await makeTopic();let release,started;const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const mock=createServer(async(req,res)=>{assert.equal(req.headers['x-quiz-token'],'process-test-token');started();await gate;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({topicId:id,questions:Array.from({length:4},(_,i)=>q(i)),model:'qwen3:14b',generated:4,seconds:1}));});
  await new Promise(r=>mock.listen(0,'127.0.0.1',r));
  const child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('../server/',import.meta.url)),env:{...process.env,HOST:'127.0.0.1',PORT:'0',JWT_SECRET:'llm-process-fake-secret-12345678901234567890',QUIZ_SERVER_URL:'http://127.0.0.1:'+mock.address().port,QUIZ_SERVER_TOKEN:'process-test-token'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  try{
   const base=await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('API start timeout')),15000);child.once('exit',()=>{clearTimeout(timeout);reject(Error('API exited'));});child.stdout.on('data',chunk=>{text+=chunk;const m=/Question API listening on (\{[^\n]+\})/.exec(text);if(m){clearTimeout(timeout);resolve('http://127.0.0.1:'+JSON.parse(m[1]).port);}});child.stderr.resume();});
   const request=async(url,body,token)=>{const res=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});assert(res.ok,url+':'+res.status);return res.json();};
   const user=await request('/auth/signup',{email:randomUUID()+'@example.com',password:'Llm-Process!123'});users.push(user.user.id);
   const attempt=await request('/me/activities',{requestId:randomUUID(),purpose:'study',topicId:id,studySec:60},user.accessToken);
   assert.equal(attempt.items.length,0);await Promise.race([ready,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('worker did not start')),10000);t.unref();})]);
   const fixed=await request('/me/activities/'+attempt.id+'/events',{requestId:randomUUID(),event:'quiz'},user.accessToken);assert.equal(fixed.items.length,7);assert(fixed.items.every(x=>x.question.src!=='ai'));
   release();
   let done=false;for(let i=0;i<100;i++){const [[n]]=await db.execute("SELECT COUNT(*) AS n FROM questions WHERE topic_id=? AND source='ai'",[id]);if(Number(n.n)===4){done=true;break;}await new Promise(r=>setTimeout(r,20));}assert(done,'worker result not stored');
  }finally{
   release();child.kill();await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);});mock.closeAllConnections();await new Promise(r=>mock.close(r));
  }
 });
 await t.test('주제당 공개 40개·비활성 원본 보존·반복 가져오기·summary 대조',async()=>{
  const id=await makeTopic(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'llm-import-'));
  try{const file=path.join(dir,'questions.json'),summaryFile=path.join(dir,'summary.txt');fs.writeFileSync(file,JSON.stringify({[id]:Array.from({length:45},(_,i)=>q(i))}));fs.writeFileSync(summaryFile,'주제 0개 중 처리 1개, 문제 45개\n문제가 0개인 주제 0개\n');
   const one=await importAiQuizzes(db,{file,summaryFile});assert.equal(one.inserted,45);const two=await importAiQuizzes(db,{file});assert.equal(two.inserted,0);
   const [[n]]=await db.execute("SELECT COUNT(*) AS allCount,SUM(status='published') AS active FROM questions WHERE topic_id=? AND source='ai'",[id]);assert.equal(Number(n.allCount),45);assert.equal(Number(n.active),40);assert.equal(one.summary.countsMatch,false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });

});
