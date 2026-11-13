import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {connect} from '../server/db.mjs';
import {createAuth} from '../server/auth.mjs';
import {createSpeedService} from './speed-service.mjs';
import {createRecordService} from './record-service.mjs';
import {createServer} from '../server/server.mjs';
import {databaseStore} from './question-service.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
const json=v=>typeof v==='string'?JSON.parse(v):v;
test('speed quiz issuance, authoritative answers, durable XP and account isolation on MySQL',async t=>{
 const db=await connect(),auth=createAuth({secret:randomBytes(48).toString('base64url')}),users=[];
 const signup=async()=>{const s=await auth.signup({email:'speed-'+randomUUID()+'@example.com',password:'Password!123'});users.push(s.user.id);return s;};
 const a=await signup(),b=await signup(),ha='Bearer '+a.accessToken,hb='Bearer '+b.accessToken;
 let clock=new Date();const speed=createSpeedService({auth,now:()=>new Date(clock)}),records=createRecordService({auth});
 const server=createServer({store:databaseStore(db),auth});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));for(const id of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=?",[id]);await purgeExpiredAccounts({onlyUserIds:users});await db.end();});
 const bank=await databaseStore(db).questions('ds-01');
 const seed={id:randomUUID(),topicId:'ds-01',memo:'학습',studySec:900,score:7,total:7,studiedAt:new Date().toISOString(),items:bank.slice(0,7).map(q=>({question:{...q,src:'bank'},answer:q.answer}))};
 assert.equal((await records.upload(ha,{records:[seed]})).saved,1);
 async function solve(run,count){const [[r]]=await db.execute('SELECT questions FROM speed_runs WHERE id=?',[run.runId]);const qs=json(r.questions);for(let p=0;p<Math.min(count,qs.length);p++)await speed.answer(ha,run.runId,{position:p,answer:qs[p].q.answer,score:999});return Math.min(count,qs.length);}
 await t.test('HTTP endpoints require authentication and accounts need server study history',async()=>{
  assert.equal((await fetch(base+'/me/speed/stats')).status,401);
  await assert.rejects(speed.start(hb,{requestId:randomUUID()}),{code:'speed_no_questions'});
 });
 let first;
 await t.test('one active run, same start request resumes, answer/explanation are withheld',async()=>{
  const requestId=randomUUID();first=await speed.start(ha,{requestId});assert(first.question);assert.equal('answer' in first.question.q,false);assert.equal('explain' in first.question.q,false);
  assert.equal((await speed.start(ha,{requestId})).runId,first.runId);assert.equal((await speed.start(ha,{requestId:randomUUID()})).runId,first.runId);
  assert.equal(Date.parse(first.deadlineAt)-Date.parse(first.serverNow),60000);
  await assert.rejects(speed.answer(hb,first.runId,{position:0,answer:0}),{code:'not_found'});
  await assert.rejects(speed.finish(hb,first.runId),{code:'not_found'});
 });
 await t.test('ordered answer receipts survive retry, changed answer conflicts, forged score ignored',async()=>{
  await assert.rejects(speed.answer(ha,first.runId,{position:1,answer:0}),{code:'invalid_position'});
  const [[r]]=await db.execute('SELECT questions FROM speed_runs WHERE id=?',[first.runId]),answer=json(r.questions)[0].q.answer;
  const receipt=await speed.answer(ha,first.runId,{position:0,answer,correct:false,score:999});assert.equal(receipt.correct,true);
  assert.deepEqual(await speed.answer(ha,first.runId,{position:0,answer}),receipt);
  await assert.rejects(speed.answer(ha,first.runId,{position:0,answer:(answer+1)%4}),{code:'answer_conflict'});
  const [one,two]=await Promise.all([speed.finish(ha,first.runId),speed.finish(ha,first.runId)]);assert.equal(one.xp,3);assert.equal(two.xp,3);assert.equal(one.store.totalXp,3);
  const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM speed_answers WHERE run_id=?',[first.runId]);assert.equal(Number(n.n),1);
 });
 await t.test('daily 150 XP cap persists across runs and service instances',async()=>{
  for(let i=0;i<10&&(await speed.stats(ha)).xpToday<150;i++){const run=await speed.start(ha,{requestId:randomUUID()});await solve(run,100);await speed.finish(ha,run.runId);}
  const reopened=createSpeedService({auth,now:()=>new Date(clock)});assert.equal((await reopened.stats(ha)).xpToday,150);
  const run=await speed.start(ha,{requestId:randomUUID()});await solve(run,1);assert.equal((await speed.finish(ha,run.runId)).xp,0);
  assert.equal((await speed.stats(hb)).totalXp,0);
 });
 await t.test('deadline uses server time and expired runs settle without client-reported score',async()=>{
  const run=await speed.start(ha,{requestId:randomUUID()});clock=new Date(clock.getTime()+60001);
  await assert.rejects(speed.answer(ha,run.runId,{position:0,answer:0,completedAt:'2000-01-01'}),{code:'speed_expired'});
  await speed.stats(ha);assert.equal((await speed.finish(ha,run.runId)).xp,0);
 });
 await t.test('next Korean reward day renews quota, combined XP includes speed but ranks exclude it',async()=>{
  clock=new Date(clock.getTime()+86400000);const run=await speed.start(ha,{requestId:randomUUID()});await solve(run,2);assert.equal((await speed.finish(ha,run.runId)).xp,6);assert.equal((await speed.stats(ha)).xpToday,6);
  const value=await records.stats(ha);assert.equal(value.speedXp,156);assert.equal(value.totalXp,value.studyXp+156);assert.equal(value.topics[0].attempts,1);assert.equal(value.topics[0].correct,7);
 });
 await t.test('HTTP start/answer/finish route preserves ownership and canonical score',async()=>{
  const requestId=randomUUID();const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{authorization:ha,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
  const run=await post('/me/speed/runs',{requestId});const [[r]]=await db.execute('SELECT questions FROM speed_runs WHERE id=?',[run.runId]);const answer=json(r.questions)[0].q.answer;
  assert.equal((await post('/me/speed/runs/'+run.runId+'/answers',{position:0,answer,score:100})).correct,true);
  const result=await post('/me/speed/runs/'+run.runId+'/finish',{score:100});assert.equal(result.xp,0);assert.equal(result.correct,1);
 });
});
