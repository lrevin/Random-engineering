import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(name,deps={}){const source=fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('exports','require',code)(exports,k=>{assert(Object.hasOwn(deps,k),k);return deps[k];});return exports;}
test('특수 보상 요청은 인증 토큰으로 서버 경로를 사용하고 재전송 ID를 유지',async()=>{
 const {createAuthClient}=load('auth-client'),calls=[];
 const client=createAuthClient('http://api',{read:async()=>null,write:async()=>{},remove:async()=>{}},async(url,init)=>{
  calls.push({url,...init});return {ok:true,status:200,json:async()=>url.endsWith('/auth/login')?{accessToken:'token',refreshToken:'refresh',expiresIn:3600,user:{id:'a'}}:{}};
 });
 await client.signIn('a@example.com','password');await client.rewardStatus();
 await client.issueActivity({requestId:'same',purpose:'recall'});await client.issueActivity({requestId:'same',purpose:'recall'});
 await client.activityEvent('attempt','quiz','event-id');await client.activityAnswer('attempt',1,false);await client.completeActivity('attempt',[false]);await client.recordVisibility('record',true);
 assert.equal(calls.filter(c=>c.url.endsWith('/auth/me')).length,0);
 assert(calls.slice(1).every(c=>c.headers.Authorization==='Bearer token'));
 assert.equal(calls[2].body,calls[3].body);
 assert.deepEqual(JSON.parse(calls.at(-1).body),{hidden:true});assert(calls.at(-1).url.endsWith('/visibility'));
});
test('서버 풀이 캐시는 회원·기능별로 분리하고 전체 답안·전송 UUID를 보존',async()=>{
 let owner='a';const values=new Map(),storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)};
 const local=load('local-data',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage}});
 const deps={'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'./local-data':local,'./auth':{mysqlAuth:{getUserId:()=>owner}}};
 let cache=load('activity-cache',deps);const state={owner,request:{requestId:'same-id',purpose:'recall'},answers:[false,0]};await cache.saveCachedActivity(state);
 cache=load('activity-cache',deps);assert.deepEqual(await cache.readCachedActivity('recall'),state);
 owner='b';assert.equal(await cache.readCachedActivity('recall'),null);await assert.rejects(cache.saveCachedActivity(state),/session_changed/);
 owner='a';await cache.saveStudyEvent({attemptId:'attempt',event:'extend',id:'same-event'});cache=load('activity-cache',deps);assert.equal((await cache.readStudyEvent()).id,'same-event');
 await cache.clearStudyEvent();assert.equal(await cache.readStudyEvent(),null);await cache.clearCachedActivity('recall');assert.equal(await cache.readCachedActivity('recall'),null);
});
test('학습일·연속일은 기기 시간대와 무관하게 한국 날짜를 사용',()=>{
 const clock=load('quest-time'),stats=load('stats',{'./quest-time':clock}),old=process.env.TZ;
 try{for(const zone of ['UTC','Asia/Seoul','America/New_York']){process.env.TZ=zone;
  const records=[{studiedAt:'2026-11-13T15:01:00Z'},{studiedAt:'2026-11-14T15:01:00Z'}];
  assert.equal(stats.dateKey(new Date('2026-11-14T15:00:00Z')),'2026-11-15');assert.equal(stats.calcStreak(records,new Date('2026-11-15T00:00:00Z')).streak,2);
 }}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});

test('모의고사 오답 캐시는 일반 OX 복습과 분리하여 복원·삭제한다',async()=>{
 const values=new Map(),storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)};
 const local=load('local-data',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage}});
 const cache=load('activity-cache',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'./local-data':local,'./auth':{mysqlAuth:{getUserId:()=> 'a'}}});
 const general={owner:'a',request:{requestId:'g',purpose:'review'},answers:[true]};
 const exam={owner:'a',request:{requestId:'e',purpose:'review',reviewSource:'exam'},answers:[1]};
 await cache.saveCachedActivity(general);await cache.saveCachedActivity(exam);
 assert.deepEqual(await cache.readCachedActivity('review'),general);assert.deepEqual(await cache.readCachedActivity('review',true),exam);
 await cache.clearCachedActivity('review',true);assert.equal(await cache.readCachedActivity('review',true),null);assert.deepEqual(await cache.readCachedActivity('review'),general);
});
