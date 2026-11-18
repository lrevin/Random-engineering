import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAi,validateAiResponse} from '../mysql/ai-question-store.mjs';
import {llmSettings,readLimitedJson} from '../mysql/quiz-job-service.mjs';
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
