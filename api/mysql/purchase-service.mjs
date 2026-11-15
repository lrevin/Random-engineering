import {AuthError} from '../server/auth.mjs';
import {productPrice,extendBoost,kstDay,instant} from './purchase-policy.mjs';
export async function assetsState(db,id){
 await db.execute('INSERT IGNORE INTO member_assets(user_id) VALUES (?)',[id]);
 await db.execute("INSERT IGNORE INTO member_cosmetics(user_id,item_type,item_id,is_equipped,acquired_via) VALUES (?,'skin','classic',FALSE,'default')",[id]);
 const [[a]]=await db.execute('SELECT * FROM member_assets WHERE user_id=? FOR UPDATE',[id]);
 const [items]=await db.execute('SELECT item_type,item_id,is_equipped FROM member_cosmetics WHERE user_id=?',[id]);
 // 초기 회원만 기본 스킨을 장착한다. 기존 스킨 장착을 덮어쓰지 않는다.
 if(!items.some(i=>i.item_type==='skin'&&Number(i.is_equipped))){await db.execute("UPDATE member_cosmetics SET is_equipped=TRUE WHERE user_id=? AND item_type='skin' AND item_id='classic'",[id]);items.find(i=>i.item_type==='skin'&&i.item_id==='classic').is_equipped=1;}
 return {examTickets:Number(a.exam_tickets),examUsageDate:a.exam_usage_date,examFreeUsed:Number(a.exam_free_used),boostUntil:a.boost_until?instant(a.boost_until).toISOString():null,
 ownedSkins:items.filter(i=>i.item_type==='skin').map(i=>i.item_id),ownedTitles:items.filter(i=>i.item_type==='title').map(i=>i.item_id),
 activeSkin:items.find(i=>i.item_type==='skin'&&Number(i.is_equipped))?.item_id??'classic',activeTitle:items.find(i=>i.item_type==='title'&&Number(i.is_equipped))?.item_id??null};
}
export async function equip(db,id,type,item){
 if(!['skin','title'].includes(type)||!(typeof item==='string'||(type==='title'&&item===null)))throw new AuthError('invalid_operation',400);
 if(item!==null){const [[owned]]=await db.execute('SELECT item_id FROM member_cosmetics WHERE user_id=? AND item_type=? AND item_id=?',[id,type,item]);if(!owned)throw new AuthError('not_owned',409);}
 await db.execute('UPDATE member_cosmetics SET is_equipped=FALSE WHERE user_id=? AND item_type=? AND is_equipped=TRUE',[id,type]);
 if(item!==null)await db.execute('UPDATE member_cosmetics SET is_equipped=TRUE WHERE user_id=? AND item_type=? AND item_id=?',[id,type,item]);
}
export async function purchase(db,id,product,value,now){
 const price=productPrice(product,now);if(value.balance<price)throw new AuthError('insufficient_balance',409);
 const a=value.assets;
 if(product==='exam_ticket'){
  if(value.state.premium)throw new AuthError('premium_unlimited',409);
  if(a.examTickets>=5)throw new AuthError('inventory_full',409);
  await db.execute('UPDATE member_assets SET exam_tickets=exam_tickets+1 WHERE user_id=?',[id]);
 }else if(product==='xp_boost'){
  await db.execute('UPDATE member_assets SET boost_until=? WHERE user_id=?',[extendBoost(a.boostUntil,now),id]);
 }else{
  const [type,item]=product.split(':');
  const [[owned]]=await db.execute('SELECT item_id FROM member_cosmetics WHERE user_id=? AND item_type=? AND item_id=?',[id,type,item]);
  if(owned)throw new AuthError('already_owned',409);
  await db.execute("INSERT INTO member_cosmetics(user_id,item_type,item_id,acquired_via) VALUES (?,?,?,'purchase')",[id,type,item]);
  await equip(db,id,type,item);
 }
 return -price;
}
export async function startExam(db,id,payload,value,now){
 if(typeof payload.startId!=='string'||!/^[0-9a-f-]{36}$/.test(payload.startId)||typeof payload.certId!=='string')throw new AuthError('invalid_operation',400);
 // 작업 UUID와 별개인 시작 ID도 중복 소비를 차단한다.
 const [[started]]=await db.execute("SELECT id FROM wallet_operations WHERE user_id=? AND action='exam_start' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.startId'))=? LIMIT 1",[id,payload.startId]);
 if(started)throw new AuthError('exam_already_started',409);
 const [[cert]]=await db.execute('SELECT id FROM certificates WHERE id=? AND is_active=1',[payload.certId]);if(!cert)throw new AuthError('unknown_certificate',400);
 if(value.state.premium)return;
 const a=value.assets,today=kstDay(now);
 if(a.examUsageDate!==today||a.examFreeUsed<1){await db.execute('UPDATE member_assets SET exam_usage_date=?,exam_free_used=1 WHERE user_id=?',[today,id]);return;}
 if(a.examTickets<1)throw new AuthError('exam_ticket_required',409);
 await db.execute('UPDATE member_assets SET exam_tickets=exam_tickets-1 WHERE user_id=?',[id]);
}
