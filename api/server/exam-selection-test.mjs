import test from 'node:test';
import assert from 'node:assert/strict';
import {questions} from '../mysql/activity-service.mjs';
const rows=[{id:'mc',type:'mc',body:'객관식',choices:'["가","나","다","라"]',answer:'0',explanation:'해설'},{id:'ox',type:'ox',body:'OX',choices:null,answer:'true',explanation:'해설'},{id:'bad',type:'mc',body:'보기 부족',choices:'["가","나"]',answer:'0',explanation:'해설'}];
const database=()=>({async execute(sql){if(sql.startsWith('SELECT t.*'))return [[{name_ko:'주제',category_name:'분야'}]];return [sql.includes("AND d.type='mc' AND JSON_LENGTH(d.choices)=4")?rows.slice(0,1):rows];}});
test('모의고사는 OX·보기 부족을 제외하고 4지선다로 문항 수를 채운다',async()=>{
 const result=await questions(database(),'ai-23',10,new Set(),new Set(),{multipleChoiceOnly:true});
 assert.equal(result.length,10);assert.equal(result.filter(x=>x.questionId==='mc').length,1);
 for(const {question:q} of result){assert.equal(q.type,'mc');assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);}
});
test('일반 학습·복습에서는 OX 선택을 유지한다',async()=>{assert.ok((await questions(database(),'ai-23',3)).some(x=>x.question.type==='ox'));});
