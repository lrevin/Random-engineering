import test from 'node:test';
import assert from 'node:assert/strict';
import {productPrice,extendBoost,kstDay} from '../mysql/purchase-policy.mjs';
test('상품 가격(테마)·시간 상한은 서버에서 결정, 칭호·보상 스킨은 팔지 않음',()=>{
 const now=new Date('2026-11-15T00:00:00Z');
 assert.equal(productPrice('exam_ticket',now),40);assert.equal(productPrice('xp_boost',now),40);
 assert.equal(productPrice('skin:sunset',now),900);assert.equal(productPrice('skin:midnight',now),1800);
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
