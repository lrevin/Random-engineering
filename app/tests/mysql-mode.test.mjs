import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
const authSource=fs.readFileSync(new URL('../src/lib/auth.ts',import.meta.url),'utf8');
function load(provider,url){
 const code=ts.transpileModule(authSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={},calls=[];
 const deps={'./api':{API_URL:url},'./auth-client':{createAuthClient:(...args)=>{calls.push(args);return {provider:'mysql'};},AuthApiError:class extends Error{}},'./auth-storage':{authStorage:{}},'./supabase':{authErrorMessage:()=>''}};
 new Function('exports','require','process',code)(exports,key=>deps[key],{env:{EXPO_PUBLIC_AUTH_PROVIDER:provider}});return {exports,calls};
}
test('provider selection defaults to Supabase even with API URL configured',()=>{const r=load(undefined,'http://localhost:8788');assert.equal(r.exports.mysqlAuth,null);assert.equal(r.calls.length,0);});
test('MySQL selection requires an API URL and rejects invalid provider',()=>{assert.throws(()=>load('mysql',''),/required/);assert.throws(()=>load('typo','http://localhost'),/must be/);});
test('explicit MySQL selection uses isolated authentication storage',()=>{const r=load('mysql','http://localhost:8788');assert.equal(r.exports.mysqlAuth.provider,'mysql');assert.equal(r.calls[0][0],'http://localhost:8788');});

test('MySQL mode does not initialize the Supabase SDK even if legacy credentials remain',()=>{
 const source=fs.readFileSync(new URL('../src/lib/supabase.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};let initialized=0;
 const deps={'./storage-polyfill':{},'@supabase/supabase-js':{createClient:()=>{initialized++;throw new Error('Unexpected Supabase initialization');}},'react-native':{AppState:{addEventListener:()=>({remove(){}})}}};
 new Function('exports','require','process',code)(exports,key=>deps[key],{env:{EXPO_PUBLIC_AUTH_PROVIDER:'mysql',EXPO_PUBLIC_SUPABASE_URL:'legacy-invalid-placeholder',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'unused'}});
 assert.equal(initialized,0);assert.equal(exports.supabase,null);
});
