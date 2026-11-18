import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { connect } from '../server/db.mjs';
import { createAuth } from '../server/auth.mjs';
import { createServer } from '../server/server.mjs';
import { databaseStore } from '../server/db-store.mjs';
import { ROOT } from '../shared/question-store.mjs';
import { purgeExpiredAccounts } from './account-service.mjs';

function clientModule(){
 const ts=createRequire(path.join(ROOT,'app/package.json'))('typescript');
 const active=path.join(ROOT,'app/src/lib/auth-client.ts');
 const file=active;
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports',code)(exports);return exports;
}
test('MySQL profiles and seven-day account deletion',async t=>{
 const db=await connect(),prefix=`account-test-${randomUUID()}`,password='Account-Test-42!';
 const auth=createAuth({secret:randomBytes(48).toString('hex')});
 const server=createServer({store:databaseStore(db),auth,authLimits:{signup:100,login:100,refresh:100,logout:100,me:100}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const [users]=await db.execute("SELECT user_id FROM auth_identities WHERE provider='email' AND provider_subject LIKE ?",[`${prefix}%`]);
  for(const u of users){await db.execute('DELETE FROM study_records WHERE user_id=?',[u.user_id]);await db.execute('DELETE FROM users WHERE id=?',[u.user_id]);}
  await db.end();
 });
 const request=async(route,{method='GET',body,token}={})=>{
  const r=await fetch(`${base}${route}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,data:r.status===204?null:await r.json()};
 };
 const signup=async name=>{const r=await request('/auth/signup',{method:'POST',body:{email:`${prefix}-${name}@example.com`,password}});assert.equal(r.status,201);return r.data;};
 const profile={nickname:'프로필검증',interests:['ds'],level:2,studyMinutes:15,reminderEnabled:true,reminderTime:'21:00'};
 const a=await signup('a'),b=await signup('b');
 await t.test('profile requires auth and missing own profile returns 404',async()=>{
  assert.equal((await request('/me/profile')).status,401);
  assert.equal((await request('/me/profile',{token:a.accessToken})).status,404);
 });
 await t.test('profile create/update roundtrip, JSON fields and token ownership',async()=>{
  let r=await request('/me/profile',{method:'PUT',token:a.accessToken,body:{...profile,user_id:b.user.id}});assert.equal(r.status,200);assert.deepEqual(r.data.profile,profile);
  assert.deepEqual((await request('/me/profile',{token:a.accessToken})).data.profile,profile);
  assert.equal((await request('/me/profile',{token:b.accessToken})).status,404);
  r=await request('/me/profile',{method:'PUT',token:a.accessToken,body:{...profile,nickname:' 수정 이름 ',reminderEnabled:false}});
  assert.equal(r.status,200);assert.equal(r.data.profile.nickname,'수정 이름');assert.equal(r.data.profile.reminderEnabled,false);
  assert.equal(r.data.nicknameCharged,0,'첫 닉네임 변경은 무료');
  // 새 닉네임은 2~5자
  assert.equal((await request('/me/profile',{method:'PUT',token:a.accessToken,body:{...profile,nickname:'가나다라마바'}})).data.error,'nickname_length');
  // 두 번째 변경부터 톱니바퀴 50개: 시작 톱니바퀴 30개라 부족
  r=await request('/me/profile',{method:'PUT',token:a.accessToken,body:{...profile,nickname:'두번째'}});
  assert.equal(r.status,409);assert.equal(r.data.error,'insufficient_balance');
  // 같은 닉네임으로 다른 설정만 바꾸는 건 무료
  r=await request('/me/profile',{method:'PUT',token:a.accessToken,body:{...profile,nickname:'수정 이름',reminderEnabled:false,level:3}});
  assert.equal(r.status,200);assert.equal(r.data.nicknameCharged,0);
 });
 await t.test('테마 구매 후 닉네임 변경해도 지갑 상태·자산을 보존하고 최신 revision을 반환한다',async()=>{
  const c=await signup('wallet'),token=c.accessToken;
  assert.equal((await request('/me/profile',{method:'PUT',token,body:{...profile,nickname:'변경전'}})).status,200);
  await request('/me/wallet',{token});
  await db.execute('UPDATE wallets SET balance=3000 WHERE user_id=?',[c.user.id]);
  for(const body of [{action:'buy_freeze'},{action:'buy_battle_ticket'},{action:'spend',payload:{product:'skin:honey'}}]){
   assert.equal((await request('/me/wallet/operations',{method:'POST',token,body:{requestId:randomUUID(),...body}})).status,200);
  }
  const before=(await request('/me/wallet',{token})).data;
  const changed=await request('/me/profile',{method:'PUT',token,body:{...profile,nickname:'변경후'}});
  assert.equal(changed.status,200);assert.equal(changed.data.nicknameCharged,0);
  const result=await request('/me/wallet',{token});assert.equal(result.status,200);
  assert.deepEqual(result.data.state,before.state);assert.deepEqual(result.data.assets,before.assets);assert.equal(result.data.balance,before.balance);
  assert(BigInt(result.data.revision)>BigInt(before.revision));
  const paid=await request('/me/profile',{method:'PUT',token,body:{...profile,nickname:'재변경'}});assert.equal(paid.status,200);assert.equal(paid.data.nicknameCharged,50);
  const after=(await request('/me/wallet',{token})).data;assert.equal(after.balance,before.balance-50);assert.deepEqual(after.state,before.state);assert.deepEqual(after.assets,before.assets);
 });
 await t.test('지갑 상태 이력이 없는 최초 닉네임 변경 후에도 지갑을 조회한다',async()=>{
  const c=await signup('empty-wallet'),token=c.accessToken;
  for(const nickname of ['첫이름','새이름'])assert.equal((await request('/me/profile',{method:'PUT',token,body:{...profile,nickname}})).status,200);
  const result=await request('/me/wallet',{token});assert.equal(result.status,200);assert.equal(result.data.balance,30);assert.equal(result.data.state.freeTickets,2);assert.equal(result.data.state.freezes,0);assert(BigInt(result.data.revision)>0n);
 });
 await t.test('invalid profile rejected and existing profile remains unchanged',async()=>{
  for(const change of [{nickname:'  '},{nickname:'가'.repeat(21)},{interests:['ds','ds']},{interests:['missing-category']},{level:4},{level:1.5},{studyMinutes:0},{studyMinutes:121},{reminderEnabled:1},{reminderTime:'25:00'}]){
   assert.equal((await request('/me/profile',{method:'PUT',token:a.accessToken,body:{...profile,...change}})).status,400);
  }
  assert.equal((await request('/me/profile',{token:a.accessToken})).data.profile.nickname,'수정 이름');
 });
 let pending;
 await t.test('deletion marks only caller, revokes sessions and blocks old access immediately',async()=>{
  const second=await request('/auth/login',{method:'POST',body:{email:a.user.email,password}});
  pending=await request('/me',{method:'DELETE',token:a.accessToken,body:{userId:b.user.id}});assert.equal(pending.status,202);
  assert.equal(pending.data.status,'deleting');assert.equal(new Date(pending.data.deleteAfter)-new Date(pending.data.deletionRequestedAt),30*86400000);
  const [[user]]=await db.execute('SELECT status,auth_version FROM users WHERE id=?',[a.user.id]);assert.equal(user.status,'deleting');assert.equal(user.auth_version,2);
  for(const token of [a.accessToken,second.data.accessToken])assert.equal((await request('/auth/me',{token})).status,401);
  assert.equal((await request('/auth/refresh',{method:'POST',body:{refreshToken:second.data.refreshToken}})).status,401);
  assert.equal((await request('/me/profile',{token:a.accessToken})).status,401);
  assert.equal((await request('/auth/me',{token:b.accessToken})).status,200);
 });
 await t.test('30일 안에 다시 로그인하면 탈퇴 철회 (비밀번호 필요, 예전 토큰은 살아나지 않음)',async()=>{
  assert.equal((await request('/auth/cancel-deletion',{method:'POST',body:{email:a.user.email,password:'Wrong-Test-42!'}})).status,401);
  assert.equal((await request('/auth/login',{method:'POST',body:{email:a.user.email,password:'Wrong-Test-42!'}})).status,401);
  const login=await request('/auth/login',{method:'POST',body:{email:a.user.email,password}});assert.equal(login.status,200);assert.equal(login.data.restored,true);
  assert.equal((await request('/auth/me',{token:a.accessToken})).status,401);
  assert.equal((await request('/me/profile',{token:login.data.accessToken})).data.profile.nickname,'수정 이름');
  const [[user]]=await db.execute('SELECT deletion_requested_at FROM users WHERE id=?',[a.user.id]);assert.equal(user.deletion_requested_at,null);
 });
 const expiring=await signup('purge');
 await t.test('cleanup keeps accounts before deadline; expired cancellation is refused',async()=>{
  await request('/me',{method:'DELETE',token:expiring.accessToken});
  assert.equal((await purgeExpiredAccounts({onlyUserIds:[expiring.user.id]})).deleted,0);
  await db.execute('UPDATE users SET deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 DAY) WHERE id=?',[expiring.user.id]);
  assert.equal((await request('/auth/cancel-deletion',{method:'POST',body:{email:expiring.user.email,password}})).status,409);
  assert.equal((await request('/auth/login',{method:'POST',body:{email:expiring.user.email,password}})).data.error,'deletion_period_expired');
 });
 const attempt=randomUUID(),record=randomUUID();
 await t.test('cleanup rolls back on failure, then deletes dependent data in FK order',async()=>{
  await db.execute("INSERT INTO profiles(user_id,nickname,interests) VALUES (?,'정리 검증',JSON_ARRAY('ds'))",[expiring.user.id]);
  await db.execute("INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,completed_at) VALUES (?,?,'ds-01','completed','client_reported',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[attempt,expiring.user.id]);
  await db.execute('INSERT INTO quiz_attempt_items(attempt_id,position,question_snapshot) VALUES (?,1,JSON_OBJECT())',[attempt]);
  await db.execute(`INSERT INTO study_records(id,user_id,attempt_id,topic_id,topic_ko,domain,category,difficulty,memo,score,rp,studied_at,time_validation_status,submission_hash,change_seq,received_at)
   VALUES (?,?,?,'ds-01','스택','it','ds',1,'메모',1,6,UTC_TIMESTAMP(3),'accepted',?,1,UTC_TIMESTAMP(3))`,[record,expiring.user.id,attempt,Buffer.alloc(32,1)]);
  await db.execute("INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,rule_version,verification_status,calculation_details,idempotency_key) VALUES (?,?,?,'ds-01','award',6,'test','client_reported',JSON_OBJECT(),?)",[randomUUID(),expiring.user.id,record,`test:${record}`]);
  const connectionFactory=async()=>{
   const real=await connect();return new Proxy(real,{get(target,key){
    if(key==='execute')return (sql,args)=>{if(sql==='DELETE FROM xp_ledger WHERE user_id=?')throw new Error('forced cleanup failure');return target.execute(sql,args);};
    const value=target[key];return typeof value==='function'?value.bind(target):value;
   }});
  };
  await assert.rejects(purgeExpiredAccounts({connectionFactory,onlyUserIds:[expiring.user.id]}),/forced cleanup failure/);
  const [[kept]]=await db.execute('SELECT COUNT(*) AS n FROM study_records WHERE id=?',[record]);assert.equal(Number(kept.n),1);
  assert.equal((await purgeExpiredAccounts({onlyUserIds:[expiring.user.id]})).deleted,1);
  for(const table of ['users','profiles','auth_identities','auth_sessions','study_records','quiz_attempts','xp_ledger','user_sync_states']){
   const [[r]]=await db.execute(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table==='users'?'id':'user_id'}=?`,[expiring.user.id]);assert.equal(Number(r.n),0,table);
  }
  assert.equal((await purgeExpiredAccounts({onlyUserIds:[expiring.user.id]})).deleted,0);
  assert.equal((await request('/auth/me',{token:b.accessToken})).status,200);
 });
 await t.test('actual staged app client uses profile/deletion/cancellation APIs',async()=>{
  const {createAuthClient}=clientModule();let raw=null;
  const store={read:async()=>raw,write:async value=>{raw=value;},remove:async()=>{raw=null;}};
  const client=createAuthClient(base,store),email=`${prefix}-client@example.com`;
  await client.signUp(email,password);assert.equal(await client.getProfile(),null);
  assert.deepEqual(await client.saveProfile(profile),profile);
  assert.deepEqual(await client.getProfile(),profile);
  assert.equal((await client.deleteAccount()).status,'deleting');assert.equal(raw,null);
  await client.cancelDeletion(email,password);assert.notEqual(raw,null);assert.deepEqual(await client.getProfile(),profile);
  await client.signOut();assert.equal(raw,null);
 });
});
