import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(bank){
 const topics=Array.from({length:12},(_,i)=>({id:`t${i}`,ko:`개념${i}`,en:`concept${i}`,hint:`고유 설명 ${i}`,category:'c',categoryName:'분야',domain:'d'}));
 const deps={'@react-native-async-storage/async-storage':{},'@/data':{TOPICS:topics},'@/data/quizbank':{BANK_BUNDLED_FULL:true,QUIZ_BANK:{t0:bank}},'./api':{fetchBankQuestions:()=>{throw Error('내장 문제만 사용');}}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/quiz.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports','require',code)(exports,key=>{assert.ok(Object.hasOwn(deps,key),key);return deps[key];});return {quiz:exports,topic:topics[0]};
}
const mc={type:'mc',q:'서로 다른 보기를 가진 은행 객관식 문제',choices:['가','나','다','라'],answer:0,explain:'해설'};
test('게스트 모의고사는 혼합 은행에서 4지선다만 출제한다',async()=>{
 const {quiz,topic}=load([mc,{type:'ox',q:'OX 문제',answer:true,explain:'해설'},{...mc,q:'잘못된 보기',choices:['가','나']}]);
 const items=await quiz.examQuestions([topic],1);assert.equal(items.length,1);assert.equal(items[0].q.type,'mc');assert.equal(items[0].q.choices.length,4);
});
test('OX만 있는 은행도 게스트 모의고사에서 객관식으로 보충한다',async()=>{
 const {quiz,topic}=load([{type:'ox',q:'OX 문제',answer:true,explain:'해설'}]);
 const items=await quiz.examQuestions([topic],2);assert.equal(items.length,2);
 for(const {q} of items){assert.equal(q.type,'mc');assert.equal(q.choices.length,4);}
});
