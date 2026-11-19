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
