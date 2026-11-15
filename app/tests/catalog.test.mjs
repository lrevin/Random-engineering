import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function module(name,deps){const source=fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),exports={};new Function('exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{assert(key in deps,key);return deps[key];});return exports;}
test('catalog cache validates before replacement, sends version and preserves cache on failure',async()=>{
 let raw=JSON.stringify({version:'v1'}),applied=[];
 const storage={getItem:async()=>raw,setItem:async(k,v)=>{raw=v;}},original=globalThis.fetch;
 const mod=module('catalog-sync',{'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'@/data':{applyCatalog:(data,validate)=>{if(!data.version)throw new Error('invalid');if(!validate)applied.push(data.version);}},'./api':{API_URL:'https://example.test'}});
 try{
  await mod.restoreCatalog();assert.deepEqual(applied,['v1']);
  globalThis.fetch=async(url,init)=>{assert.equal(init.headers['If-None-Match'],'"v1"');return new Response(null,{status:304});};assert.equal(await mod.syncCatalog(),false);
  globalThis.fetch=async()=>new Response('{}');await assert.rejects(mod.syncCatalog());assert.equal(JSON.parse(raw).version,'v1');
  globalThis.fetch=async()=>new Response('{"version":"v2"}');assert.equal(await mod.syncCatalog(),true);assert.equal(JSON.parse(raw).version,'v2');assert.deepEqual(applied,['v1','v2']);
 }finally{globalThis.fetch=original;}
});
