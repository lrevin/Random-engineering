import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(url,deps){
 const source=fs.readFileSync(url,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const out={};new Function('exports','require',code)(out,key=>{assert.ok(Object.hasOwn(deps,key),'알 수 없는 의존성: '+key);return deps[key];});return out;
}
test('앱 꾸미기 가격·판매 월이 서버 상품 정의와 일치',()=>{
 const skins=load(new URL('../src/lib/skins.ts',import.meta.url),{'@react-native-async-storage/async-storage':{},'./local-data':{LOCAL_KEYS:{skins:{key:'test'}}},react:{}});
 const policy=load(new URL('../../api/mysql/purchase-policy.mjs',import.meta.url),{'../server/auth.mjs':{AuthError:class extends Error{}}});
 for(const [key,p]of Object.entries(policy.COSMETICS)){
  const [type,id]=key.split(':');const item=(type==='skin'?skins.SKINS:skins.TITLES).find(x=>x.id===id);assert(item,key);
  assert.equal(type==='skin'?item.price:item.source.price,p.price,key);assert.deepEqual(item.source.months,p.months,key);
 }
});
