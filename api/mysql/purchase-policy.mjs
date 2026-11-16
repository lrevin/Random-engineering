import {AuthError} from '../server/auth.mjs';
export const kstDay=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const instant=v=>v instanceof Date?v:new Date(v.includes('T')?v:v.replace(' ','T')+'Z');
// 화면과 동일한 상품 ID·가격. 보상 상품은 구매 목록에 넣지 않는다.
export const COSMETICS={
 'skin:cherry':{price:150},'skin:mint':{price:150},'skin:galaxy':{price:250},'skin:gold':{price:400},
 'skin:maple':{price:300,months:[9,10,11]},'skin:snow':{price:300,months:[12,1,2]},'skin:owl':{price:300,months:[4,6,10,12]},
 'title:t-autumn':{price:120,months:[9,10,11]},'title:t-winter':{price:120,months:[12,1,2]},'title:t-exam':{price:120,months:[4,6,10,12]}
};
export function productPrice(product,now){
 if(product==='exam_ticket'||product==='xp_boost')return 40;
 const p=typeof product==='string'&&Object.hasOwn(COSMETICS,product)?COSMETICS[product]:null;if(!p)throw new AuthError('product_not_available',409);
 const month=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',month:'numeric'}).format(now));
 if(p.months&&!p.months.includes(month))throw new AuthError('not_in_season',409);
 return p.price;
}
export function extendBoost(until,now){const next=new Date(Math.max(until?instant(until).getTime():0,now.getTime())+1800000);if(next-now>7200000)throw new AuthError('inventory_full',409);return next;}
export async function boostMultiplier(db,id,completedAt){
 // 만료 후 재구매가 과거 풀이에 적용되지 않도록 실제 구매 영수증의 시각·만료를 확인한다.
 const [rows]=await db.execute("SELECT created_at,result_json FROM wallet_operations WHERE user_id=? AND action='spend' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.product'))='xp_boost' AND created_at<=? ORDER BY id DESC LIMIT 1",[id,completedAt]);
 const row=rows[0];if(!row)return 1;const receipt=typeof row.result_json==='string'?JSON.parse(row.result_json):row.result_json;
 const until=receipt.assets?.boostUntil;return until&&instant(until)>completedAt?2:1;
}
