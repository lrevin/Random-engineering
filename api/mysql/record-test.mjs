import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../../app/src/lib/',import.meta.url));
const ts=createRequire(fileURLToPath(new URL('../../app/package.json',import.meta.url)))('typescript');
function module(name,dependencies={}){const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(root,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('exports','require',code)(exports,key=>dependencies[key]??require(key));return exports;}
const clientModule=module('auth-client'),{syncMySqlRecords,enqueueRecordOperation}=module('record-sync',{'./auth-client':clientModule});
import {connect} from '../server/db.mjs';
import {createAuth} from '../server/auth.mjs';
import {createServer} from '../server/server.mjs';
import {databaseStore} from './question-service.mjs';
import {createRecordService,calculateXp} from './record-service.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
test('MySQL learning record integration',async t=>{
 const db=await connect(),auth=createAuth({secret:randomBytes(48).toString('hex')}),server=createServer({store:databaseStore(db),auth});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`,users=[];
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));for(const id of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 DAY) WHERE id=?",[id]);await purgeExpiredAccounts({onlyUserIds:users});await db.end();});
 const req=async(path,method='GET',body,token)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.status===204?null:await r.json()};};
 const signup=async()=>{const r=await req('/auth/signup','POST',{email:`records-${randomUUID()}@example.com`,password:'Records-Test-42!'});assert.equal(r.status,201);users.push(r.data.user.id);return r.data;};
 const a=await signup(),b=await signup();const token=a.accessToken,header=`Bearer ${token}`;
 const make=(patch={})=>({id:randomUUID(),topicId:'ds-01',memo:'메모',studySec:900,score:6,total:7,studiedAt:new Date().toISOString(),rp:999,items:Array.from({length:7},(_,i)=>({question:{type:'ox',q:`검증 문제 ${i+1}이다.`,answer:true,explain:'검증 해설입니다.',src:'offline'},answer:i===6?false:true})),...patch});
 const upload=async record=>(await req('/me/records','PUT',{records:[record]},token)).data.results[0];
 const p=make();let saved;
 await t.test('ownership, snapshots, server-derived XP and wrong answers',async()=>{
  assert.equal((await req('/me/records/snapshot')).status,401);
  const r=await upload(p);assert.equal(r.ok,true);saved=r.record;assert.equal(saved.rp,0);assert.equal(saved.rewardStatus,'ineligible');assert.equal(saved.eligibility.questEligible,false);assert.equal(saved.verificationStatus,'client_reported');assert.equal(saved.items.length,7);assert.equal(saved.wrong.length,1);assert.equal(saved.topicKo,'스택');
  assert.equal((await req(`/me/records/${p.id}`,'GET',undefined,b.accessToken)).status,404);
  const [[n]]=await db.execute('SELECT COUNT(*) AS n,SUM(topic_id=?) AS topic_count FROM quiz_attempt_items WHERE attempt_id=?',[p.topicId,p.id]);assert.equal(Number(n.n),7);assert.equal(Number(n.topic_count),7);
 });
 await t.test('retries are idempotent, immutable edits and foreign IDs rejected',async()=>{
  assert.equal((await upload({...p,memo:'다른 메모',rp:1})).record.memo,p.memo);
  assert.equal((await upload({...p,studySec:901})).error,'record_conflict');
  const r=await req('/me/records','PUT',{records:[p]},b.accessToken);assert.equal(r.data.results[0].error,'record_conflict');
  const [[n]]=await db.execute("SELECT COUNT(*) AS n FROM xp_ledger WHERE source_record_id=? AND event_type='award'",[p.id]);assert.equal(Number(n.n),0);
 });
 await t.test('partial batch validation and score tampering',async()=>{
  const r=await req('/me/records','PUT',{records:[make({items:[]}),make({score:7}),make()]},token);assert.equal(r.data.saved,1);assert.deepEqual(r.data.results.map(x=>x.ok),[false,false,true]);
 });
 await t.test('memo compare-and-set and no-op retry',async()=>{
  const r=await req(`/me/records/${p.id}/memo`,'PUT',{memo:'수정',baseChangeSeq:saved.changeSeq},token);assert.equal(r.status,200);const seq=r.data.record.changeSeq;
  const conflict=await req(`/me/records/${p.id}/memo`,'PUT',{memo:'충돌',baseChangeSeq:saved.changeSeq},token);assert.equal(conflict.status,409);assert.equal(conflict.data.record.memo,'수정');
  assert.equal((await req(`/me/records/${p.id}/memo`,'PUT',{memo:'수정',baseChangeSeq:saved.changeSeq},token)).data.record.changeSeq,seq);
  assert.equal((await req(`/me/records/${p.id}/memo`,'PUT',{memo:'침범',baseChangeSeq:seq},b.accessToken)).status,404);
 });
 await t.test('concurrent duplicate awards only once',async()=>{const r=make();const results=await Promise.all([upload(r),upload(r)]);assert.ok(results.every(x=>x.ok));const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM xp_ledger WHERE source_record_id=?',[r.id]);assert.equal(Number(n.n),0);});
 await t.test('숨김은 XP·완료 증거를 유지하고 재전송으로 복원되지 않는다',async()=>{
  const before=(await req('/me/stats','GET',undefined,token)).data.totalXp;
  assert.equal((await req(`/me/records/${p.id}`,'DELETE',undefined,b.accessToken)).status,404);
  assert.equal((await req(`/me/records/${p.id}`,'DELETE',undefined,token)).status,204);assert.equal((await req(`/me/records/${p.id}`,'DELETE',undefined,token)).status,204);
  assert.equal((await req('/me/stats','GET',undefined,token)).data.totalXp,before);
  assert.ok((await upload(p)).record.hiddenAt);assert.equal((await upload({...p,id:randomUUID(),attemptId:p.id})).error,'attempt_conflict');
  const [[a]]=await db.execute('SELECT status FROM quiz_attempts WHERE id=?',[p.id]);assert.equal(a.status,'completed');
  await db.execute('DELETE FROM study_record_tombstones WHERE user_id=? AND record_id=?',[users[0],p.id]);assert.ok((await upload(p)).record.hiddenAt);
 });
 await t.test('snapshot, incremental changes, stable pagination, expired cursors',async()=>{
  const snap=(await req('/me/records/snapshot','GET',undefined,token)).data;assert.equal(snap.records.length,3);assert.ok(snap.records.find(r=>r.id===p.id).hiddenAt);
  const r=await upload(make());const changes=(await req(`/me/records/changes?cursor=${snap.cursor}`,'GET',undefined,token)).data;assert.equal(changes.changes[0].record.id,r.id);
  await req(`/me/records/${r.id}`,'DELETE',undefined,token);const gone=(await req(`/me/records/changes?cursor=${changes.cursor}`,'GET',undefined,token)).data;assert.equal(gone.changes[0].deleted,false);assert.ok(gone.changes[0].record.hiddenAt);
  const page=(await req('/me/records?limit=1','GET',undefined,token)).data;assert.ok(page.nextCursor);const next=(await req('/me/records?limit=1&cursor='+page.nextCursor,'GET',undefined,token)).data;assert.notEqual(page.records[0].id,next.records[0].id);
  await db.execute('UPDATE user_sync_states SET min_available_seq=1 WHERE user_id=?',[users[0]]);assert.equal((await req('/me/records/changes?cursor=0','GET',undefined,token)).data.error,'full_resync_required');
 });
 await t.test('failed award rolls back record, answers and sync sequence',async()=>{
  const bank=await databaseStore(db).questions('ds-01');const record=make({score:7,items:bank.slice(0,7).map(q=>({question:{...q,src:'bank'},answer:q.answer}))}),factory=async()=>{const c=await connect();return new Proxy(c,{get(target,key){if(key==='execute')return(sql,args)=>{if(sql.startsWith('INSERT INTO xp_ledger'))throw new Error('forced award failure');return target.execute(sql,args);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});};
  const service=createRecordService({auth,connectionFactory:factory});await assert.rejects(service.upload(header,{records:[record]}),/forced award failure/);
  const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM quiz_attempts WHERE id=?',[record.id]);assert.equal(Number(n.n),0);
 });
 await t.test('old/future times excluded from streak and XP formula regression',async()=>{
  for(const offset of [-31*86400000,600000]){const p=make({studiedAt:new Date(Date.now()+offset).toISOString()});assert.equal((await upload(p)).ok,true);const [[r]]=await db.execute('SELECT study_date FROM study_records WHERE id=?',[p.id]);assert.equal(r.study_date,null);}
  assert.equal(calculateXp(2,7,0,3).total,102);
 });
 await t.test('actual staged app client synchronizes pending records, offline memo, conflicts and remote deletions',async()=>{
  const c=await signup();const storage={read:async()=>null,write:async()=>{},remove:async()=>{}};
  const client=clientModule.createAuthClient(base,storage);await client.signIn(c.user.email,'Records-Test-42!');
  let local=[{...make(),synced:false}],drafts=[];const run=()=>syncMySqlRecords(client,()=>local,rs=>{local=rs;},()=>true,async r=>{drafts.push(r);});
  await run();assert.equal(local[0].synced,true);assert.equal(local[0].rp,0);
  const first=local[0];local=[{...first,memo:'오프라인 메모',memoPending:{version:'edit1',baseChangeSeq:first.changeSeq}}];await run();assert.equal(local[0].memo,'오프라인 메모');assert.equal(local[0].memoPending,undefined);
  const before=local[0];await client.saveRecordMemo(before.id,'다른 기기',before.changeSeq);local=[{...before,memo:'내 초안',memoPending:{version:'edit2',baseChangeSeq:before.changeSeq}}];
  await run();assert.equal(local[0].memo,'내 초안');assert.equal(local[0].memoConflict.memo,'다른 기기');
  local=[{...local[0],memoConflict:undefined,memoPending:{version:'retry',baseChangeSeq:local[0].memoConflict.changeSeq}}];await run();assert.equal(local[0].memoPending,undefined);assert.equal(local[0].memo,'내 초안');
  const old=local[0];await client.deleteRecord(old.id);local=[{...old,memo:'삭제 전 초안',memoPending:{version:'edit3',baseChangeSeq:old.changeSeq}}];await run();assert.equal(local.length,1);assert.ok(local[0].hiddenAt);assert.equal(local[0].memo,'삭제 전 초안');
  const incomplete={...make(),synced:false,items:undefined};local=[incomplete];await run();const pending=local.find(r=>r.id===incomplete.id);assert.equal(pending.synced,false);assert.equal(pending.syncError,'incomplete_record');
  let release;const waiting=new Promise(r=>{release=r;});let active=true,writes=0;
  const inFlight=syncMySqlRecords({...client,recordSnapshot:async()=>{await waiting;return {records:[first],cursor:'1'};}},()=>[],()=>{writes++;},()=>active,async()=>{});
  active=false;release();await inFlight;assert.equal(writes,0);
 });
 await t.test('deletion waits for in-flight snapshots and new memo drafts survive asynchronous archiving',async()=>{
  const c=await signup(),client=clientModule.createAuthClient(base,{read:async()=>null,write:async()=>{},remove:async()=>{}});await client.signIn(c.user.email,'Records-Test-42!');
  let local=[{...make(),synced:false}],release,started;
  const gate=new Promise(r=>{release=r;}),ready=new Promise(r=>{started=r;}),queue={current:Promise.resolve()};
  const delayed={...client,recordSnapshot:async()=>{const result=await client.recordSnapshot();started();await gate;return result;}};
  const sync=enqueueRecordOperation(queue,()=>syncMySqlRecords(delayed,()=>local,rs=>{local=rs;},()=>true,async()=>{}));
  await ready;const id=local[0].id;
  const remove=enqueueRecordOperation(queue,async()=>{const {record}=await client.recordVisibility(id,true);local=local.map(r=>r.id===id?record:r);});
  release();await Promise.all([sync,remove]);assert.equal(local.length,1);assert.ok(local[0].hiddenAt);assert.equal((await req('/me/records/'+id,'GET',undefined,(await client.ensure()).accessToken)).status,200);
  const keep={...make(),synced:true,changeSeq:'1'},gone={...make(),synced:true,memoPending:{version:'gone',baseChangeSeq:'1'}};
  local=[keep,gone];
  await syncMySqlRecords({...client,recordSnapshot:async()=>({records:[keep],cursor:'1'})},()=>local,rs=>{local=rs;},()=>true,async()=>{
   local=local.map(r=>r.id===keep.id?{...r,memo:'동기화 중 새 초안',memoPending:{version:'new',baseChangeSeq:'1'},memoConflict:{memo:'서버',changeSeq:'2'}}:r);
  });
  assert.equal(local.length,1);assert.equal(local[0].memo,'동기화 중 새 초안');assert.equal(local[0].memoPending.version,'new');
 });
 await t.test('partial-bundle MySQL basic bank API and conditional cache',async()=>{
  const r=await fetch(base+'/quiz-bank/ds-01');assert.equal(r.status,200);const data=await r.json();assert.ok(data.questions.length>=7);assert.equal((await fetch(base+'/quiz-bank/ds-01',{headers:{'If-None-Match':r.headers.get('etag')}})).status,304);assert.equal((await fetch(base+'/quiz-bank/unknown-topic')).status,404);
  let calls=0;const cache=new Map();
  const {bankQuestions}=module('quiz',{
   '@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async key=>cache.get(key)??null,setItem:async(key,value)=>{cache.set(key,value);}}},
   '@/data':{TOPICS:[]},'@/data/quizbank':{BANK_BUNDLED_FULL:false,QUIZ_BANK:{'ds-01':[{type:'ox',q:'내장 캐시 테스트',answer:true,explain:'내장 설명'}]}},
   './api':{fetchBankQuestions:async id=>{calls++;return (await (await fetch(base+'/quiz-bank/'+id)).json()).questions;}},
  });
  assert.deepEqual(await bankQuestions('ds-01'),data.questions);assert.deepEqual(await bankQuestions('ds-01'),data.questions);assert.equal(calls,1);
 });
});
