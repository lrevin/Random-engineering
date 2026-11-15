import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');

function load(name,deps){
 const source=fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 new Function('exports','require',code)(exports,key=>{assert.ok(Object.hasOwn(deps,key),`Unexpected dependency: ${key}`);return deps[key];});
 return exports;
}
const LOCAL_KEYS={exam:{key:'pg.exam'},reviewDone:{key:'pg.review.done2'},recall:{key:'pg.recall'},certDates:{key:'pg.certDates'}};

function setup(server={}){
 const mem=new Map();
 const storage={getItem:async k=>mem.get(k)??null,setItem:async(k,v)=>{mem.set(k,v);}};
 const puts=[];let clock=0;
 const api={apiRequest:async(path,body,method)=>{
  if(method==='GET')return {items:structuredClone(server)};
  const name=path.split('/').pop(),at=`t${++clock}`;
  server[name]={value:body.value,updatedAt:at};puts.push([name,body.value]);return {updatedAt:at};
 }};
 const mod=load('progress-sync',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'./auth':{mysqlAuth:api},'./local-data':{LOCAL_KEYS}});
 return {mem,puts,server,sync:(id='u1')=>mod.syncProgress(id,()=>true)};
}

test('처음 로그인한 기기: 서버 값이 있으면 받고, 없으면 기기 값을 올림',async()=>{
 const s=setup({exam:{value:{results:[1]},updatedAt:'a'}});
 s.mem.set('pg.exam','{"results":[]}');
 s.mem.set('pg.recall','{"os-01":5}');
 await s.sync();
 assert.equal(s.mem.get('pg.exam'),'{"results":[1]}','계정 기록이 이 기기의 둘러보기 기록보다 우선');
 assert.deepEqual(s.puts,[['recall',{'os-01':5}]]);
});

test('로그아웃 등으로 기기 값이 지워졌으면 서버에서 다시 받음',async()=>{
 const s=setup();
 s.mem.set('pg.certDates','{"cert-ipe":"2026-12-01"}');
 await s.sync();
 s.mem.delete('pg.certDates');
 await s.sync();
 assert.equal(s.mem.get('pg.certDates'),'{"cert-ipe":"2026-12-01"}');
});

test('기기에서 바꾼 값은 올리고, 바뀐 게 없으면 다시 올리지 않음',async()=>{
 const s=setup();
 s.mem.set('pg.exam','{"n":1}');
 await s.sync();
 await s.sync();
 assert.equal(s.puts.length,1);
 s.mem.set('pg.exam','{"n":2}');
 await s.sync();
 assert.deepEqual(s.puts.at(-1),['exam',{n:2}]);
});

test('다른 기기에서 서버 값이 바뀌고 이 기기는 그대로면 서버 값을 받음',async()=>{
 const s=setup();
 s.mem.set('pg.review.done2','{"a":1}');
 await s.sync();
 s.server.reviewDone={value:{a:1,b:2},updatedAt:'other-device'};
 await s.sync();
 assert.equal(s.mem.get('pg.review.done2'),'{"a":1,"b":2}');
 assert.equal(s.puts.length,1);
});
