import {writeLlmLog} from '../mysql/llm-observation.mjs';
import {createQuizJobWorker} from '../mysql/quiz-job-service.mjs';
import {createServer} from 'node:http';
import {llmFetch} from '../mysql/llm-http.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAi,validateAiResponse} from '../mysql/ai-question-store.mjs';
import {llmSettings,readLimitedJson,llmFailureReason} from '../mysql/quiz-job-service.mjs';
const q={type:'mc',q:' 테스트 문제 ',choices:[' A ','B','C','D'],answer:0,explain:' 해설 '};
test('LLM 문제는 본문·보기·해설을 정규화하고 잘못된 답·중복 보기·길이를 거절',()=>{
 assert.equal(normalizeAi(q).q,'테스트 문제');assert.equal(normalizeAi(q).choices[0],'A');
 for(const patch of [{answer:4},{choices:['a','a','b','c']},{q:'x'.repeat(401)},{explain:''}])assert.throws(()=>normalizeAi({...q,...patch}));
 assert.equal(normalizeAi({type:'ox',q:'O/X',answer:false,explain:'설명'}).answer,false);
});
test('LLM 응답의 주제·모델을 확인하고 유효한 일부 문항만 수락',()=>{
 const data={topicId:'ds-01',model:'qwen3:14b',questions:[q,q,{...q,choices:['D','C','B','A'],answer:3},{...q,answer:9}],generated:1,seconds:3};
 const v=validateAiResponse(data,'ds-01');assert.equal(v.questions.length,1);assert.equal(v.rejected.length,3);
 assert.throws(()=>validateAiResponse(data,'ds-02'));assert.throws(()=>validateAiResponse({...data,model:''},'ds-01'));
 assert.throws(()=>validateAiResponse({...data,questions:Array(33).fill(q)},'ds-01'));
});
test('LLM 설정·응답 크기 제한은 비밀값 없이 검증',async()=>{
 assert.equal(llmSettings({}).enabled,false);assert.equal(llmSettings({QUIZ_SERVER_TOKEN:'fake'}).url,'http://127.0.0.1:18788');
 assert.throws(()=>llmSettings({QUIZ_SERVER_URL:'http://user:secret@localhost'}));
 assert.deepEqual(await readLimitedJson(new Response('{"ok":true}')),{ok:true});
 await assert.rejects(readLimitedJson(new Response('x'.repeat(100)),10),/response_too_large/);
 await assert.rejects(readLimitedJson(new Response('not JSON')));
});


test('실제 생성 응답의 generated는 반환 수와 달라도 live/pool을 독립 집계한다',()=>{
 const a={...q,q:'실시간',source:'live'},b={...q,q:'창고',source:'pool'};
 const mixed=validateAiResponse({topicId:'ds-01',model:'qwen3:14b',questions:[a,b],generated:7,seconds:87},'ds-01');
 assert.equal(mixed.generated,7);assert.equal(mixed.returnedCount,2);assert.equal(mixed.acceptedLiveCount,1);assert.equal(mixed.acceptedPoolCount,1);
 assert.equal(llmSettings({QUIZ_SERVER_TOKEN:' fake '}).token,'fake');assert.equal(llmSettings({}).newQuestionStatus,'draft');
 assert.equal(llmSettings({QUIZ_NEW_QUESTION_STATUS:'published'}).newQuestionStatus,'published');assert.throws(()=>llmSettings({QUIZ_NEW_QUESTION_STATUS:'invalid'}));
 assert.equal(llmFailureReason({code:'LLM_UNAUTHORIZED',status:401}),'upstream_unauthorized');
});


test('실제 HTTP는 연결 제한 뒤에도 생성을 기다리고 크기·전체 기한을 지킨다',async()=>{
 const server=createServer((req,res)=>{if(req.url==='/large'){res.end('x'.repeat(100));return;}setTimeout(()=>{res.setHeader('content-type','application/json');res.end('{"ok":true}');},120);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.deepEqual(await (await llmFetch(base,{connectTimeoutMs:80,signal:AbortSignal.timeout(2000)})).json(),{ok:true});
  await assert.rejects(llmFetch(base+'/large',{maxBytes:10,signal:AbortSignal.timeout(2000)}),{code:'LLM_RESPONSE_TOO_LARGE'});
  await assert.rejects(llmFetch(base,{signal:AbortSignal.timeout(30)}),{name:'AbortError'});
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});


test('관측 로그는 비밀·문제·답안·임의 오류를 제외하고 출력 실패를 삼킨다',()=>{
 const lines=[];
 writeLlmLog('response_received',{topicId:'arch-19',returnedCount:4,liveCount:1,poolCount:3,token:'secret',answer:2,questions:[q],reason:'raw secret',requestElapsedMs:1234},s=>lines.push(s));
 const log=JSON.parse(lines[0]);assert.equal(log.returnedCount,4);assert.equal(log.requestElapsedMs,1234);assert.equal(log.event,'response_received');
 assert(!lines[0].includes('secret'));assert(!('questions' in log));assert(!('answer' in log));assert(!('reason' in log));
 assert.doesNotThrow(()=>writeLlmLog('job_finished',{},()=>{throw Error('출력 실패');}));
});
test('실제 작업자는 응답 원본 수와 검증·저장 탈락을 분리하고 커밋 후 결과를 기록한다',async()=>{
 const id='00000000-0000-4000-8000-000000000001',at=new Date(),deadline=new Date(+at+600000);
 let state={id,topic_id:'arch-19',status:'queued',attempt_count:0,requested_count:4,created_at:at,deadline_at:deadline},commits=0,checks=0;
 const logs=[],original=console.info;
 const db={beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{},end:async()=>{},
  async query(sql){if(sql.includes('GET_LOCK'))return [[{ok:1}]];return [[]];},
  async execute(sql,args=[]){
   if(sql.startsWith('SELECT id FROM quiz_jobs'))return [[]];
   if(sql.startsWith('SELECT id,topic_id FROM quiz_jobs'))return [[{id,topic_id:'arch-19'}]];
   if(sql.startsWith('SELECT * FROM quiz_jobs'))return [[{...state}]];
   if(sql.includes("SET status='running'")){state={...state,status:'running',lease_token:args[1],lease_expires_at:args[2],attempt_count:1};return [{}];}
   if(sql.startsWith('SELECT id,status FROM questions'))return [++checks===1?[]:[{id:'disabled',status:'disabled'}]];
   return [[]];
  }};
 console.info=line=>{const x=JSON.parse(line);if(x.event==='job_finished')assert.equal(commits,2);logs.push(x);};
 try{
  const questions=[{...q,q:'원본 하나',source:'live'},{...q,q:'원본 하나',source:'pool'},{...q,answer:99,source:'live'},{...q,q:'기존 비활성',source:'pool'}];
  const worker=createQuizJobWorker({connectionFactory:async()=>db,settings:{enabled:true,url:'http://fake',token:'not-in-logs',newQuestionStatus:'draft'},fetcher:async()=>new Response(JSON.stringify({topicId:'arch-19',model:'test',questions,seconds:2,generated:8}))});
  assert.equal(await worker.runOnce(),true);
 }finally{console.info=original;}
 assert.deepEqual(logs.map(x=>x.event),['request_started','response_received','job_finished']);
 assert.equal(logs[1].returnedCount,4);assert.equal(logs[1].liveCount,2);assert.equal(logs[1].poolCount,2);
 const done=logs[2];assert.equal(done.acceptedCount,1);assert.equal(done.validationRejectedCount,2);assert.equal(done.storageRejectedCount,1);assert.equal(done.status,'partial');assert.equal(done.rejections.length,3);
 assert(!JSON.stringify(logs).includes('not-in-logs'));assert(!JSON.stringify(logs).includes('원본 하나'));
});
