import test from 'node:test';
import assert from 'node:assert/strict';
import {productPrice,extendBoost,kstDay,isProfileLook,PREMIUM_THEMES} from '../mysql/purchase-policy.mjs';
test('상품 가격(테마)·시간 상한은 서버에서 결정, 칭호·보상 스킨은 팔지 않음',()=>{
 const now=new Date('2026-11-15T00:00:00Z');
 assert.equal(productPrice('exam_ticket',now),40);assert.equal(productPrice('xp_boost',now),40);
 assert.equal(productPrice('skin:sunset',now),900);assert.equal(productPrice('skin:midnight',now),1200);
 // 유료 프로필 캐릭터·배경: 'skin' 칸에 보관만 함(장착 없음)
 assert.equal(productPrice('skin:av-phoenix',now),1200);assert.equal(productPrice('skin:av-unicorn',now),1100);assert.ok(isProfileLook('av-hamster'));assert.equal(productPrice('skin:bg-galaxy',now),1400);
 // 프리미엄 전용 테마는 팔지 않음 (프리미엄인 동안 장착)
 assert.deepEqual(PREMIUM_THEMES,['prism']);assert.throws(()=>productPrice('skin:prism',now),{code:'product_not_available'});
 assert.ok(isProfileLook('av-astro'));assert.ok(isProfileLook('bg-neon'));assert.equal(isProfileLook('midnight'),false);assert.equal(isProfileLook('av-'),false);
 assert.throws(()=>productPrice('title:t-autumn',now),{code:'product_not_available'});
 assert.throws(()=>productPrice('skin:cherry',now),{code:'product_not_available'});
 assert.throws(()=>productPrice('skin:sprout',now),{code:'product_not_available'});
 assert.throws(()=>productPrice('skin:classic',now),{code:'product_not_available'});
 assert.throws(()=>productPrice('__proto__',now),{code:'product_not_available'});
 assert.equal(extendBoost(null,now)-now,1800000);
 assert.equal(extendBoost(new Date(now.getTime()+5400000),now)-now,7200000);
 assert.throws(()=>extendBoost(new Date(now.getTime()+5400001),now),{code:'inventory_full'});
 assert.equal(kstDay(new Date('2026-11-14T15:00:00Z')),'2026-11-15');
});

test('프리미엄 전용 테마: 프리미엄일 때만 장착하고, 처음 쓰면 보관함에 넣음',async()=>{
 const {equip}=await import('../mysql/purchase-service.mjs');
 const calls=[];
 const db={async execute(sql,args){calls.push(sql.replace(/\s+/g,' '));if(sql.startsWith('SELECT item_id'))return [[{item_id:args[2]}]];return [{affectedRows:1}];}};
 await assert.rejects(()=>equip(db,'u1','skin','prism'),{code:'premium_required'});
 assert.equal(calls.length,0,'프리미엄이 아니면 DB를 건드리지 않음');
 await equip(db,'u1','skin','prism',{premium:true});
 assert.ok(calls.some(s=>s.startsWith("INSERT IGNORE INTO member_cosmetics")&&s.includes("'default'")));
 assert.ok(calls.some(s=>s.includes('SET is_equipped=TRUE')));
});
