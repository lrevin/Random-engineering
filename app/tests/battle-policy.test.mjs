import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(name,deps={}){const source=fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('exports','require',code)(exports,k=>{assert(Object.hasOwn(deps,k),k);return deps[k];});return exports;}
test('battle rank uses only main answers; forfeit and no-answer records give no study days or achievements',()=>{
 const {domainMastery}=load('rank',{'./quiz':{QUIZ_LENGTH:7}}),stats=load('stats');
 const at=new Date().toISOString(),base={topicId:'ds-01',domain:'cs',category:'ds',studyType:'battle',score:10,total:10,rankScore:5,countsAsStudy:true,studiedAt:at,memo:'상대님과 배틀',rp:0};
 const absent={...base,countsAsStudy:false,score:0,rankScore:0};
 assert.equal(domainMastery('cs',[base]).points,5);assert.equal(domainMastery('cs',[absent]).index,-1);
 assert.equal(stats.studiedToday([absent]),false);assert.equal(stats.studyDays([absent]).size,0);assert.equal(stats.studiedToday([base]),true);
 assert.equal(stats.isBattleRecord({...base,studyType:'study'}),false);
});
test('match requests retain UUID after lost response and across module recreation; cancellation names its entry',async()=>{
 const values=new Map(),calls=[];let fail=true;
 const storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)};
 const deps={'@react-native-async-storage/async-storage':storage,'expo-crypto':{randomUUID:()=> 'request-uuid'},'./api':{API_URL:'https://example.com'},'./auth':{mysqlAuth:{getUserId:()=> 'member',apiRequest:async(path,body,method)=>{calls.push({path,body,method});if(fail){fail=false;throw new Error('offline');}return {status:'waiting',id:'entry'};}}}};
 await assert.rejects(load('social',deps).joinMatch());await load('social',deps).joinMatch();assert.equal(calls[0].body.requestId,calls[1].body.requestId);assert.equal(values.size,0);
 await load('social',deps).leaveMatch('entry');assert.deepEqual(calls.at(-1),{path:'/match',body:{entryId:'entry'},method:'DELETE'});
 await load('social',deps).setStudySkip('battle',true);assert.deepEqual(calls.at(-1),{path:'/battles/battle/study-skip',body:{agree:true},method:'POST'});
 await load('social',deps).setStudySkip('battle',false);assert.deepEqual(calls.at(-1).body,{agree:false});
});
