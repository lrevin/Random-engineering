import {AuthError} from '../server/auth.mjs';
export const kstDay=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const instant=v=>v instanceof Date?v:new Date(v.includes('T')?v:v.replace(' ','T')+'Z');
// 화면(app/src/lib/skins.ts THEMES)과 동일한 상품 ID·가격. 앱 전체 색 테마를 예전 '스킨' 칸(item_type='skin')에 저장한다.
// 칭호는 연속 기록·업적 보상으로만 주고 팔지 않는다.
// 유료 프로필 캐릭터(av-)·배경(bg-)도 같은 'skin' 칸에 보관만 하고 장착하지 않는다(테마 장착과 무관, 고른 그림은 앱이 기억). 화면: app/src/lib/profile-look.ts LOOK_PRICES
export const COSMETICS={
 'skin:sunset':{price:900},'skin:aurora':{price:900},'skin:honey':{price:1200},'skin:midnight':{price:1200},'skin:matcha':{price:2000},'skin:obsidian':{price:2000},
 'skin:av-astro':{price:900},'skin:av-dragon':{price:1000},'skin:av-slime':{price:800},'skin:av-bunny':{price:800},'skin:av-panda':{price:900},'skin:av-phoenix':{price:1200},'skin:av-whale':{price:900},'skin:av-hamster':{price:800},'skin:av-unicorn':{price:1100},
 'skin:bg-galaxy':{price:1400},'skin:bg-sakura':{price:1100},'skin:bg-aurora':{price:1300},'skin:bg-neon':{price:1400},'skin:bg-library':{price:1000}
};
/** 프리미엄 멤버십 전용 테마: 팔지 않고, 프리미엄인 동안 장착할 수 있음 (화면: app/src/lib/skins.ts THEMES의 premium) */
export const PREMIUM_THEMES=['prism'];
/** 장착하지 않고 보관만 하는 프로필 그림 */
export const isProfileLook=item=>typeof item==='string'&&/^(av|bg)-[a-z]+$/.test(item);
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
