import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {connect,useSharedPool,closeSharedPool} from '../server/db.mjs';
import {createProgressService} from './progress-service.mjs';
import {createAuth} from '../server/auth.mjs';
import {createMemberService} from './member-service.mjs';
import {createRecordService} from './record-service.mjs';
import {createSpeedService} from './speed-service.mjs';
import {databaseStore} from './question-service.mjs';
import {boostMultiplier} from './purchase-policy.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
const json=v=>typeof v==='string'?JSON.parse(v):v;
test('회원 구매·사용과 보상은 실제 MySQL 트랜잭션으로 처리',async t=>{
 const db=await connect(),auth=createAuth({secret:randomBytes(48).toString('base64url')}),users=[];
 const signup=async()=>{const s=await auth.signup({email:randomUUID()+'@example.com',password:'Password!123'});users.push(s.user.id);return s;};
 const a=await signup(),b=await signup(),h='Bearer '+a.accessToken,hb='Bearer '+b.accessToken;
 let clock=new Date();const members=createMemberService({auth,now:()=>new Date(clock)});
 const op=(action,payload={},requestId=randomUUID(),header=h)=>members.operate(header,{action,payload,requestId});
 const wallet=()=>members.wallet(h);
 const funds=async n=>{await wallet();await db.execute('UPDATE wallets SET balance=? WHERE user_id=?',[n,a.user.id]);};
 t.after(async()=>{for(const id of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 DAY) WHERE id=?",[id]);await purgeExpiredAccounts({onlyUserIds:users});await db.end();});
 await t.test('인증·기본 자산·계정 격리',async()=>{
  await assert.rejects(members.wallet(''),{code:'unauthorized'});const w=await wallet();assert.equal(w.assets.examTickets,0);assert.deepEqual(w.assets.ownedSkins,['classic']);assert.equal(w.assets.activeSkin,'classic');assert.equal((await members.wallet(hb)).assets.examTickets,0);
 });
 await t.test('V6 기기 진행 보관 값은 V7 이용권·무료 횟수 권한이 아님',async()=>{
  const progress=createProgressService({auth});
  await progress.save(h,'exam',{value:{tickets:999,n:-100,day:'2099-01-01',results:[{pass:true}]}});
  const stored=await progress.list(h);assert.equal(stored.items.exam.value.tickets,999);
  const actual=await wallet();assert.equal(actual.assets.examTickets,0);assert.equal(actual.assets.examFreeUsed,0);
  assert.equal((await progress.list(hb)).items.exam,undefined);
 });
 await t.test('잔액 부족은 차감·지급·이력을 남기지 않음',async()=>{
  await funds(30);const id=randomUUID();await assert.rejects(op('spend',{product:'exam_ticket'},id),{code:'insufficient_balance'});
  const w=await wallet();assert.equal(w.balance,30);assert.equal(w.assets.examTickets,0);const [[r]]=await db.execute('SELECT COUNT(*) AS n FROM wallet_operations WHERE user_id=? AND request_id=?',[a.user.id,id]);assert.equal(Number(r.n),0);
 });
 await funds(10000);
 await t.test('동일 구매 재전송·내용 충돌·동시 구매 상한',async()=>{
  const id=randomUUID(),before=(await wallet()).balance;
  const [x,y]=await Promise.all([op('spend',{product:'exam_ticket'},id),op('spend',{product:'exam_ticket'},id)]);assert.equal(x.assets.examTickets,1);assert.equal(y.assets.examTickets,1);assert.equal((await wallet()).balance,before-40);
  await assert.rejects(op('spend',{product:'xp_boost'},id),{code:'operation_conflict'});
  const results=await Promise.allSettled(Array.from({length:6},()=>op('spend',{product:'exam_ticket'})));assert.equal(results.filter(x=>x.status==='fulfilled').length,4);assert.equal((await wallet()).assets.examTickets,5);
 });
 await t.test('구매·장착·중복 소유·다른 계정 권한',async()=>{
  const before=(await wallet()).balance;const w=await op('spend',{product:'skin:sunset'});assert.equal(w.balance,before-900);assert.equal(w.assets.activeSkin,'sunset');assert(w.assets.ownedSkins.includes('sunset'));
  await assert.rejects(op('spend',{product:'skin:sunset'}),{code:'already_owned'});assert.equal((await wallet()).balance,before-900);
  await assert.rejects(op('equip_cosmetic',{type:'skin',itemId:'sunset'},randomUUID(),hb),{code:'not_owned'});
  await op('equip_cosmetic',{type:'skin',itemId:'classic'});assert.equal((await wallet()).assets.activeSkin,'classic');
  await assert.rejects(op('spend',{product:'skin:sprout'}),{code:'product_not_available'});
  await assert.rejects(op('spend',{product:'skin:cherry'}),{code:'product_not_available'});
  await assert.rejects(op('spend',{product:'title:t-autumn'}),{code:'product_not_available'});await op('equip_cosmetic',{type:'title',itemId:null});assert.equal((await wallet()).assets.activeTitle,null);
 });
 await t.test('원장 저장 뒤 오류가 나도 차감과 지급을 모두 롤백',async()=>{
  const before=await wallet();
  const broken=createMemberService({auth,connectionFactory:async()=>{const c=await connect(),execute=c.execute.bind(c);c.execute=async(sql,args)=>{if(sql.startsWith('INSERT INTO wallet_operations'))throw new Error('injected');return execute(sql,args);};return c;}});
  await assert.rejects(broken.operate(h,{requestId:randomUUID(),action:'spend',payload:{product:'skin:aurora'}}),/injected/);
  const after=await wallet();assert.equal(after.balance,before.balance);assert(!after.assets.ownedSkins.includes('aurora'));
 });
 await t.test('무료 우선·구매권 소비·재전송·다음 한국 날짜 초기화·프리미엄',async()=>{
  const [[cert]]=await db.execute('SELECT id FROM certificates WHERE is_active=1 LIMIT 1');assert(cert);
  const startId=randomUUID(),payload={startId,certId:cert.id};await op('exam_start',payload,startId);assert.equal((await wallet()).assets.examTickets,5);await op('exam_start',payload,startId);assert.equal((await wallet()).assets.examTickets,5);
  await assert.rejects(op('exam_start',payload),{code:'exam_already_started'});
  await op('exam_start',{startId:randomUUID(),certId:cert.id});assert.equal((await wallet()).assets.examTickets,4);
  clock=new Date('2026-11-15T15:00:00Z');await op('exam_start',{startId:randomUUID(),certId:cert.id});assert.equal((await wallet()).assets.examTickets,4);
  const current=await wallet(),state={...current.state,premium:true};await db.execute("INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,'admin_grant',JSON_OBJECT(),?)",[a.user.id,randomUUID(),Buffer.alloc(32),JSON.stringify({state})]);
  await op('exam_start',{startId:randomUUID(),certId:cert.id});assert.equal((await wallet()).assets.examTickets,4);await assert.rejects(op('spend',{product:'exam_ticket'}),{code:'premium_unlimited'});
 });
 await t.test('부스터 구매 연장·120분 상한·서버 영수증 시각',async()=>{
  clock=new Date();const before=(await wallet()).balance;for(let i=0;i<4;i++)await op('spend',{product:'xp_boost'});
  assert.equal(Date.parse((await wallet()).assets.boostUntil)-clock.getTime(),7200000);await assert.rejects(op('spend',{product:'xp_boost'}),{code:'inventory_full'});assert.equal((await wallet()).balance,before-160);
  assert.equal(await boostMultiplier(db,a.user.id,new Date(clock.getTime()+1000)),2);assert.equal(await boostMultiplier(db,a.user.id,new Date(clock.getTime()-86400000)),1);assert.equal(await boostMultiplier(db,a.user.id,new Date(clock.getTime()+7200001)),1);
 });
 await t.test('일반 기본 문제 XP는 서버가 2배 계산·재전송 중복 지급 없음',async()=>{
  const bank=await databaseStore(db).questions('ds-01'),items=bank.slice(0,7).map(q=>({question:{...q,src:'bank'},answer:q.answer}));
  const records=createRecordService({auth,now:()=>new Date(Date.now()+1000)});const p={id:randomUUID(),topicId:'ds-01',memo:'검사',studySec:900,score:7,total:7,studiedAt:new Date().toISOString(),items};
  const result=await records.upload(h,{records:[p]});assert.equal(result.saved,1);const xp=result.results[0].record;assert(xp.xpParts.some(p=>p.label==='부스터 2배'));assert.equal((await records.upload(h,{records:[p]})).results[0].record.rp,xp.rp);
  const unverified={...p,id:randomUUID(),studiedAt:new Date().toISOString(),items:items.map(i=>({...i,question:{...i.question,src:'offline'}}))};const res=await records.upload(h,{records:[unverified]});assert(!res.results[0].record.xpParts.some(p=>p.label==='부스터 2배'));assert.equal(res.results[0].record.rp,0);
  const ai={...unverified,id:randomUUID(),items:items.map(i=>({...i,question:{...i.question,src:'ai'}}))};const ar=await records.upload(h,{records:[ai]});assert.equal(ar.results[0].record.rp,0);assert.equal(ar.results[0].record.rewardStatus,'ineligible');
 });
 await t.test('스피드도 2배·150 상한·결과 재요청 중복 없음',async()=>{
  const speed=createSpeedService({auth});const run=await speed.start(h,{requestId:randomUUID()});const [[row]]=await db.execute('SELECT questions FROM speed_runs WHERE id=?',[run.runId]);const qs=json(row.questions);
  for(let p=0;p<7;p++)await speed.answer(h,run.runId,{position:p,answer:qs[p].q.answer});const result=await speed.finish(h,run.runId);assert.equal(result.xp,42);assert.equal((await speed.finish(h,run.runId)).xp,42);
  await db.execute('UPDATE speed_runs SET awarded_xp=140 WHERE id=?',[run.runId]);const next=await speed.start(h,{requestId:randomUUID()});const [[r]]=await db.execute('SELECT questions FROM speed_runs WHERE id=?',[next.runId]);for(let p=0;p<7;p++)await speed.answer(h,next.runId,{position:p,answer:json(r.questions)[p].q.answer});assert.equal((await speed.finish(h,next.runId)).xp,10);
 });
 await t.test('최신 회원 연결 풀에서도 구매 재전송·동시 조회·연결 반환 유지',async()=>{
  await funds(2000);useSharedPool();
  try{
   const id=randomUUID(),before=(await wallet()).balance;
   const result=await Promise.all([op('spend',{product:'skin:honey'},id),op('spend',{product:'skin:honey'},id)]);
   assert(result.every(x=>x.assets.ownedSkins.includes('honey')));assert.equal((await wallet()).balance,before-1200);
   await Promise.all(Array.from({length:12},()=>wallet()));
   await assert.rejects(op('spend',{product:'skin:honey'}),{code:'already_owned'});
   assert.equal((await wallet()).balance,before-1200);
  }finally{await closeSharedPool();}
 });

});
