import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(url,deps){
 const source=fs.readFileSync(url,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const out={};new Function('exports','require',code)(out,key=>{assert.ok(Object.hasOwn(deps,key),'알 수 없는 의존성: '+key);return deps[key];});return out;
}
const skins=load(new URL('../src/lib/skins.ts',import.meta.url),{'@react-native-async-storage/async-storage':{},'./local-data':{LOCAL_KEYS:{skins:{key:'test'}}},react:{},'./profile-look':{applyServerLooks(){},resetProfileLook(){}}});
const looks=load(new URL('../src/lib/profile-look.ts',import.meta.url),{'@react-native-async-storage/async-storage':{},'./local-data':{LOCAL_KEYS:{profileLook:{key:'test'}}},react:{}});
const themes=load(new URL('../src/themes.ts',import.meta.url),{});

test('앱 테마 가격이 서버 상품 정의와 일치 (칭호는 팔지 않음)',()=>{
 const policy=load(new URL('../../api/mysql/purchase-policy.mjs',import.meta.url),{'../server/auth.mjs':{AuthError:class extends Error{}}});
 const sold=skins.THEMES.filter(t=>t.price>0);
 const paidLooks=Object.entries(looks.LOOK_PRICES);
 assert.deepEqual(Object.keys(policy.COSMETICS).sort(),[...sold.map(t=>'skin:'+t.id),...paidLooks.map(([id])=>'skin:'+id)].sort());
 for(const t of sold)assert.equal(policy.COSMETICS['skin:'+t.id].price,t.price,t.id);
 // 유료 프로필 그림: 가격이 서버와 같고, 서버는 장착하지 않고 보관만 함
 for(const [id,price] of paidLooks){assert.equal(policy.COSMETICS['skin:'+id].price,price,id);assert.ok(policy.isProfileLook(id),id);}
 assert.equal(policy.isProfileLook('sunset'),false);
 assert.deepEqual([...looks.PAID_AVATARS,...looks.PAID_BACKDROPS].sort(),paidLooks.map(([id])=>id).sort());
});

test('파는 테마마다 색이 전부 있고, 강조 버튼 글자가 읽힐 만큼 대비가 됨',()=>{
 const keys=Object.keys(themes.classicLight);
 const lum=hex=>{const n=parseInt(hex.slice(1),16),ch=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});return 0.2126*ch[0]+0.7152*ch[1]+0.0722*ch[2];};
 const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
 for(const t of skins.THEMES.filter(t=>t.id!=='classic')){
  const p=themes.PALETTES[t.id];assert.ok(p,t.id);
  assert.deepEqual(Object.keys(p).sort(),keys.slice().sort(),t.id);
  for(const g of ['bg','accent','hero'])assert.match(p.grad[g],/^linear-gradient\(/,t.id+' '+g);
  assert.ok(contrast(p.accent,p.accentInk)>=3,t.id+' 강조색 위 글자 대비');
  assert.ok(contrast(p.paper,p.ink)>=7,t.id+' 카드 위 본문 대비');
 }
 assert.equal(themes.paletteFor('classic','dark'),themes.classicDark);
 assert.equal(themes.paletteFor('없는테마','light'),themes.classicLight);
});
