import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {connect} from '../server/db.mjs';
import {createAuth} from '../server/auth.mjs';
import {createMemberService} from './member-service.mjs';
import {createServer} from '../server/server.mjs';
import {databaseStore} from './question-service.mjs';
import {verifyBankItems} from './verify-bank.mjs';
import {question} from '../shared/question-store.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
test('authenticated friends, authoritative wallet, catalog and original-question verification',async t=>{
 const db=await connect(),auth=createAuth({secret:randomBytes(48).toString('base64url')}),members=createMemberService({auth});
 const server=createServer({store:databaseStore(db),auth});server.listen(0,'127.0.0.1');await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port,users=[];
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));for(const u of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=?",[u.user.id]);await purgeExpiredAccounts({onlyUserIds:users.map(u=>u.user.id)});await db.end();});
 const signup=async()=>{const u=await auth.signup({email:'feature-'+randomUUID()+'@example.com',password:'Password!123'});users.push(u);return u;};
 const a=await signup(),b=await signup(),ha='Bearer '+a.accessToken,hb='Bearer '+b.accessToken;
 await t.test('no trusted x-pg headers; bearer token is required',async()=>{
  const r=await fetch(url+'/social/me',{method:'POST',headers:{'x-pg-uid':'FAKECODE','content-type':'application/json'},body:'{}'});assert.equal(r.status,401);
 });
 const ma=await members.me(ha),mb=await members.me(hb);
 await t.test('stable server-issued friend codes and persisted request ownership',async()=>{
  assert.equal((await members.me(ha)).uid,ma.uid);
  await members.friend(ha,mb.uid,'request');assert.equal((await members.friends(hb)).incoming[0].uid,ma.uid);
  await assert.rejects(members.friend(ha,mb.uid,'accept'),{code:'not_pending'});
  await members.friend(hb,ma.uid,'accept');assert.equal((await members.friends(ha)).friends[0].uid,mb.uid);
  await members.friend(hb,ma.uid,'remove');assert.equal((await members.friends(ha)).friends.length,0);
 });
 await t.test('starter grant once, per-user isolation, safe retries, conflict and nonnegative balance',async()=>{
  assert.equal((await members.wallet(ha)).balance,30);assert.equal((await members.wallet(ha)).balance,30);
  const body={requestId:randomUUID(),action:'buy_freeze'};
  const values=await Promise.all([members.operate(ha,body),members.operate(ha,body)]);
  assert(values.every(v=>v.balance===0&&v.state.freezes===1));
  await assert.rejects(members.operate(ha,{...body,action:'buy_battle_ticket'}),{code:'operation_conflict'});
  await assert.rejects(members.operate(ha,{requestId:randomUUID(),action:'buy_freeze'}),{code:'insufficient_balance'});
  assert.equal((await members.wallet(hb)).balance,30);
  const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM wallet_transactions WHERE user_id=?',[a.user.id]);assert.equal(Number(n.n),2);
 });
 await t.test('server chooses quest amount and blocks forged ad/premium and incomplete quest',async()=>{
  const {questKey}=await import('./policy/quests.mjs');
  const key=questKey('day','attend');
  assert.equal((await members.operate(ha,{requestId:randomUUID(),action:'quest',payload:{key,reward:999999}})).balance,2);
  await assert.rejects(members.operate(ha,{requestId:randomUUID(),action:'quest',payload:{key}}),{code:'already_claimed'});
  for(const action of ['ad_reward','premium'])await assert.rejects(members.operate(ha,{requestId:randomUUID(),action}),{code:'verification_required'});
  await assert.rejects(members.operate(ha,{requestId:randomUUID(),action:'quest',payload:{key:'quest:2000-01-01:attend'}}),{code:'quest_not_complete'});
 });
 await t.test('Korean attendance works under a GMT server and cannot be claimed twice',async()=>{
  const u=await signup(),h='Bearer '+u.accessToken,previous=process.env.TZ;process.env.TZ='UTC';
  try{
   const service=createMemberService({auth,now:()=>new Date('2026-11-13T18:10:00Z')}),key='quest:2026-11-14:attend',requestId=randomUUID();
   const before=await service.wallet(h),after=await service.operate(h,{requestId,action:'quest',payload:{key}});assert.equal(after.balance,before.balance+2);
   assert.equal((await service.operate(h,{requestId,action:'quest',payload:{key}})).balance,after.balance);
   await assert.rejects(service.operate(h,{requestId:randomUUID(),action:'quest',payload:{key}}),{code:'already_claimed'});
   await assert.rejects(service.operate(h,{requestId:randomUUID(),action:'quest',payload:{key:'quest:2026-11-13:attend'}}),{code:'quest_not_complete'});
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
 });
 await t.test('catalog version/304 and removed download route',async()=>{
  const res=await fetch(url+'/catalog'),cat=await res.json();assert.equal(res.status,200);assert.equal(cat.topics.length,1054);
  assert.equal((await fetch(url+'/catalog',{headers:{'if-none-match':res.headers.get('etag')}})).status,304);
  assert.equal((await fetch(url+'/quiz-downloads/it')).status,404);
  assert.equal((await fetch(url+'/quiz-downloads/unknown')).status,404);
 });
 await t.test('bank answer validation handles shuffled choices and rejects changed answers/duplicates',async()=>{
  const [topics]=await db.query("SELECT topic_id FROM questions GROUP BY topic_id HAVING COUNT(*)>=7 LIMIT 1"),id=topics[0].topic_id;
  const bank=await databaseStore(db).questions(id),items=bank.slice(0,7).map(q=>({question:{...q,src:'bank'},answer:q.answer}));
  assert.equal(await verifyBankItems(db,id,items),'server_verified');
  const mc=items.find(i=>i.question.type==='mc');if(mc){const old=mc.question;mc.question={...old,choices:[...old.choices].reverse(),answer:3-old.answer};assert.equal(await verifyBankItems(db,id,items),'server_verified');mc.question.answer=(mc.question.answer+1)%4;await assert.rejects(verifyBankItems(db,id,items),{code:'bank_question_mismatch'});}
  await assert.rejects(verifyBankItems(db,id,[{question:{...bank[0],src:'bank'}},{question:{...bank[0],src:'bank'}}]),{code:'duplicate_question'});
  assert.equal(await verifyBankItems(db,id,[{question:{...question(bank[0]),src:'offline'}}]),'client_reported');
 });
 await t.test('HTTP record upload persists canonical question IDs and verified ledger; tampering is refused',async()=>{
  const bank=await databaseStore(db).questions('ds-01'),qs=bank.slice(0,7);
  const record={id:randomUUID(),topicId:'ds-01',memo:'원본 검증',studySec:900,score:7,total:7,studiedAt:new Date().toISOString(),items:qs.map(q=>({question:{...q,src:'bank'},answer:q.answer}))};
  const upload=async r=>(await(await fetch(url+'/me/records',{method:'PUT',headers:{authorization:ha,'content-type':'application/json'},body:JSON.stringify({records:[r]})})).json()).results[0];
  const result=await upload(record);assert.equal(result.ok,true);assert.equal(result.record.verificationStatus,'server_verified');
  const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM quiz_attempt_items WHERE attempt_id=? AND question_id IS NOT NULL',[record.id]);assert.equal(Number(n.n),7);
  const bad=structuredClone(record);bad.id=randomUUID();const item=bad.items[0];item.question.answer=item.question.type==='ox'?!item.question.answer:(item.question.answer+1)%4;item.answer=item.question.answer;
  assert.equal((await upload(bad)).error,'bank_question_mismatch');
  assert.equal((await upload(record)).ok,true);
 });
 await t.test('blocked products and failed purchases preserve wallet and operation history',async()=>{
  const before=await members.wallet(hb);
  await assert.rejects(members.operate(hb,{requestId:randomUUID(),action:'spend',payload:{product:'forged',amount:-999999}}),{code:'product_not_available'});
  assert.deepEqual(await members.wallet(hb),before);
  const body={requestId:randomUUID(),action:'buy_freeze'},r=await members.operate(hb,body);assert.equal(r.balance,0);
  const reopened=createMemberService({auth});assert.equal((await reopened.wallet(hb)).state.freezes,1);assert.equal((await reopened.operate(hb,body)).balance,0);
 });

});
