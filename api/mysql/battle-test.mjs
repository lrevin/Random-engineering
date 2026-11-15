import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {connect} from '../server/db.mjs';
import {createAuth} from '../server/auth.mjs';
import {createBattleService} from './battle-service.mjs';
import {createMemberService} from './member-service.mjs';
import {createRecordService} from './record-service.mjs';
import {createServer} from '../server/server.mjs';
import {databaseStore} from './question-service.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
const json=v=>typeof v==='string'?JSON.parse(v):v;
test('durable battle matching, clocks, shared records, tickets and XP on real MySQL',async t=>{
 const db=await connect(),auth=createAuth({secret:randomBytes(48).toString('hex')}),users=[];let clock=new Date();
 const config={auth,now:()=>new Date(clock),studySec:2,quizSec:3,startDelaySec:1,roundSec:2,maxGapMs:Infinity};
 const engine=createBattleService(config),members=createMemberService({auth,now:()=>new Date(clock)}),records=createRecordService({auth,now:()=>new Date(clock)});
 const server=createServer({store:databaseStore(db),auth,battleService:engine,battleSweep:false});server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));for(const u of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=?",[u.id]);await purgeExpiredAccounts({onlyUserIds:users.map(u=>u.id)});await db.end();});
 async function account(interests=['ds']){const s=await auth.signup({email:'battle-'+randomUUID()+'@example.com',password:'Password!123'}),u={id:s.user.id,header:'Bearer '+s.accessToken};users.push(u);await db.execute('INSERT INTO profiles(user_id,nickname,interests) VALUES (?,?,?)',[u.id,'배틀회원',JSON.stringify(interests)]);await members.me(u.header);return u;}
 const a=await account(),b=await account(),c=await account(['ee-nonexistent']);
 const bank=await databaseStore(db).questions('ds-01');
 async function seed(u){const rec={id:randomUUID(),topicId:'ds-01',memo:'학습',studySec:600,score:7,total:7,studiedAt:new Date().toISOString(),items:bank.slice(0,7).map(q=>({question:{...q,src:'bank'},answer:q.answer}))};assert.equal((await records.upload(u.header,{records:[rec]})).saved,1);await db.execute('UPDATE study_records SET rp=1000 WHERE id=?',[rec.id]);await db.execute('UPDATE xp_ledger SET amount=1000 WHERE source_record_id=?',[rec.id]);}
 for(const u of [a,b]){await seed(u);await seed(u);await seed(u);}
 const join=(u,id=randomUUID())=>engine.join(u.header,{requestId:id,candidates:['forged'],interests:['forged']});
 async function battle(x=a,y=b){const q=await join(x);assert.equal(q.status,'waiting');const matched=await join(y);assert.equal(matched.status,'matched');return matched.battle;}
 async function snapshot(id){const [[r]]=await db.execute('SELECT state_json FROM battles WHERE id=?',[id]);return json(r.state_json);}
 const advance=async ms=>{clock=new Date(clock.getTime()+ms);await engine.sweep();};
 async function refill(u){const w=await members.wallet(u.header);await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,\'test_refill\',JSON_OBJECT(),?)',[u.id,randomUUID(),Buffer.alloc(32),JSON.stringify({balance:w.balance,state:{...w.state,freeTickets:2}})]);}
 await t.test('one waiting member persists across service instances; idempotent reserve, cancel and expiry',async()=>{
  const id=randomUUID(),q=await join(a,id);assert.equal(q.status,'waiting');assert.equal((await members.wallet(a.header)).state.freeTickets,1);
  assert.equal((await join(a,id)).id,q.id);assert.equal((await createBattleService(config).match(a.header)).id,q.id);
  await engine.leave(a.header,{entryId:q.id});await engine.leave(a.header,{entryId:q.id});assert.equal((await members.wallet(a.header)).state.freeTickets,2);
  const newer=await join(a);await engine.leave(a.header,{entryId:q.id});assert.equal((await engine.match(a.header)).id,newer.id);
  await advance(180001);assert.equal((await engine.match(a.header)).status,'none');assert.equal((await members.wallet(a.header)).state.freeTickets,2);
 });
 await t.test('server profile drives eligibility; client candidates do not unlock other topics',async()=>{
  await assert.rejects(join(c),{code:'no_match_topics'});assert.equal((await members.wallet(c.header)).state.freeTickets,2);
 });
 let main;
 await t.test('same match for both members, persisted countdown and authorization',async()=>{
  main=await battle();assert.equal((await engine.match(a.header)).battle.id,main.id);assert.equal((await engine.match(b.header)).battle.id,main.id);
  assert.equal(main.topicId,null);assert.equal(main.questions,null);await assert.rejects(engine.get(c.header,main.id),{code:'not_found'});
  await assert.rejects(engine.answer(a.header,main.id,{position:1,answer:(await snapshot(main.id)).questions[0].answer}),{code:'not_answering'});
  await advance(3000);const reopened=await createBattleService(config).get(a.header,main.id);assert.equal(reopened.phase,'quiz');assert(reopened.questions.every(q=>q.explain===''&&((q.type==='mc'&&q.answer===-1)||q.type==='ox')));
 });
 await t.test('per-question server answers survive reconnect and retries; two shared records settle once',async()=>{
  const state=await snapshot(main.id),q=state.questions[0];
  await engine.answer(a.header,main.id,{position:1,answer:q.answer,score:999});assert.equal((await createBattleService(config).get(a.header,main.id)).myAnswers[0],q.answer);
  await engine.answer(a.header,main.id,{position:1,answer:q.answer});await assert.rejects(engine.answer(a.header,main.id,{position:1,answer:q.type==='mc'?(q.answer+1)%4:!q.answer}),{code:'answer_conflict'});
  for(let i=1;i<5;i++)await engine.answer(a.header,main.id,{position:i+1,answer:state.questions[i].answer});
  for(let i=0;i<5;i++){const q=state.questions[i];await engine.answer(b.header,main.id,{position:i+1,answer:i===0?q.answer:q.type==='mc'?(q.answer+1)%4:!q.answer});}
  const done=await engine.get(a.header,main.id);assert.equal(done.status,'finished');assert.equal(done.outcome.winner,state.from.id===a.id?state.from.uid:state.to.uid);assert.equal(done.outcome.xp,100);
  const [rows]=await db.execute('SELECT * FROM study_records WHERE battle_id=? ORDER BY user_id',[main.id]);assert.equal(rows.length,2);assert(rows.every(r=>r.study_type==='battle'&&r.quiz_total===5));assert.equal(rows.reduce((n,r)=>n+r.rp,0),0);
  const mine=rows.find(r=>r.user_id===a.id);assert.equal(mine.rank_score,5);assert.equal(mine.rp,100);assert.equal((await records.get(a.header,mine.id)).record.items.length,5);
  await assert.rejects(records.remove(a.header,mine.id),{code:'battle_record_locked'});
  await Promise.all([engine.submit(a.header,main.id),engine.forfeit(b.header,main.id),engine.get(a.header,main.id)]);
  const [[n]]=await db.execute("SELECT COUNT(*) AS n,SUM(amount) AS amount FROM xp_ledger WHERE source_type='battle'");assert.equal(Number(n.n),2);assert.equal(Number(n.amount),0);
 });
 await t.test('draw goes through at most five overtime rounds and stores ten common items',async()=>{
  await refill(a);await refill(b);const game=await battle();await advance(3000);const s=await snapshot(game.id);
  for(let i=0;i<5;i++){await engine.answer(a.header,game.id,{position:i+1,answer:s.questions[i].answer});await engine.answer(b.header,game.id,{position:i+1,answer:s.questions[i].answer});}
  for(let round=0;round<5;round++){await advance(3000);const q=s.questions[5+round];await engine.overtime(a.header,game.id,{round,answer:q.answer});await engine.overtime(b.header,game.id,{round,answer:q.answer});}
  const done=await engine.get(a.header,game.id);assert.equal(done.status,'finished');assert.equal(done.outcome.winner,null);assert.equal(done.outcome.xp,0);
  const [rows]=await db.execute('SELECT id,quiz_total,score,rank_score FROM study_records WHERE battle_id=?',[game.id]);assert(rows.every(r=>r.quiz_total===10&&r.score===10&&r.rank_score===5));
  assert.equal((await records.get(a.header,done.recordId)).record.items.filter(i=>i.stage==='overtime').length,5);
 });
 await t.test('explicit forfeit loses once; temporary disconnect does not reset clocks',async()=>{
  await refill(a);await refill(b);const game=await battle(),before=await engine.get(a.header,game.id);await advance(1000);
  assert.equal((await createBattleService(config).get(a.header,game.id)).startAt,before.startAt);
  const done=await engine.forfeit(a.header,game.id);assert.equal(done.reason,'forfeit');assert.equal(done.outcome.xp,100);assert.equal((await members.wallet(a.header)).state.freeTickets,1);
  await engine.forfeit(a.header,game.id);const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM study_records WHERE battle_id=?',[game.id]);assert.equal(Number(n.n),2);
 });
 await t.test('no submissions finish as draw, no ticket refund or learning rank credit',async()=>{
  await refill(a);await refill(b);const game=await battle();await advance(6001);const done=await engine.get(a.header,game.id);assert.equal(done.status,'finished');assert.equal(done.reason,'no_submissions');assert.equal(done.outcome.xp,0);
  const [rows]=await db.execute('SELECT rank_score,study_date FROM study_records WHERE battle_id=?',[game.id]);assert(rows.every(r=>r.rank_score===0&&r.study_date===null));assert.equal((await members.wallet(a.header)).state.freeTickets,1);
 });
 await t.test('server interruption voids match and refunds each reservation once',async()=>{
  await refill(a);await refill(b);const game=await battle();await advance(3000);clock=new Date(clock.getTime()+31000);
  const strict=createBattleService({...config,maxGapMs:30000});const done=await strict.get(a.header,game.id);assert.equal(done.status,'void');assert.equal(done.reason,'server_interruption');assert.equal((await members.wallet(a.header)).state.freeTickets,2);
  await strict.get(b.header,game.id);assert.equal((await members.wallet(b.header)).state.freeTickets,2);const [[n]]=await db.execute('SELECT COUNT(*) AS n FROM study_records WHERE battle_id=?',[game.id]);assert.equal(Number(n.n),0);
 });
 await t.test('simultaneous matching cannot put one user in two battles',async()=>{
  const d=await account(),e=await account();await refill(a);await refill(b);
  const result=await Promise.all([join(a),join(b),join(d),join(e)]);const ids=new Set();for(const u of [a,b,d,e]){const m=await engine.match(u.header);assert.equal(m.status,'matched');ids.add(m.battle.id);}assert.equal(ids.size,2);
  for(const id of ids){const s=await snapshot(id);await engine.forfeit(users.find(u=>u.id===s.from.id).header,id);}assert.equal(result.length,4);
 });
 await t.test('HTTP uses real auth and ignores forged client scores',async()=>{
  assert.equal((await fetch(base+'/match')).status,401);await refill(a);await refill(b);
  const post=async(u,path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{authorization:u.header,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
  await post(a,'/match',{requestId:randomUUID()});const m=await post(b,'/match',{requestId:randomUUID()});await advance(3000);
  await post(a,'/battles/'+m.battle.id+'/result',{score:5,xp:999999});await post(b,'/battles/'+m.battle.id+'/result',{score:5});assert.equal((await engine.get(a.header,m.battle.id)).reason,'no_submissions');
 });
 await t.test('mutual friend requests become one durable accepted relationship',async()=>{
  const ac=(await members.me(a.header)).uid,bc=(await members.me(b.header)).uid;
  await members.friend(a.header,bc,'request');const result=await members.friend(b.header,ac,'request');assert(result.friends.some(f=>f.uid===ac));
  assert((await createMemberService({auth}).friends(a.header)).friends.some(f=>f.uid===bc));
 });
 await t.test('settlement failure rolls back both records, XP, queue completion and sync sequence',async()=>{
  await refill(a);await refill(b);const game=await battle();
  const [[before]]=await db.execute('SELECT last_change_seq FROM user_sync_states WHERE user_id=?',[a.id]);
  const failing=createBattleService({...config,connectionFactory:async()=>{
   const connection=await connect(),execute=connection.execute.bind(connection);connection.execute=(sql,args)=>sql.startsWith('INSERT INTO xp_ledger')?Promise.reject(new Error('injected ledger failure')):execute(sql,args);return connection;
  }});
  await assert.rejects(failing.forfeit(a.header,game.id),/injected ledger/);
  const [[count]]=await db.execute('SELECT COUNT(*) AS n FROM study_records WHERE battle_id=?',[game.id]);assert.equal(Number(count.n),0);
  const [[after]]=await db.execute('SELECT last_change_seq FROM user_sync_states WHERE user_id=?',[a.id]);assert.equal(String(after.last_change_seq),String(before.last_change_seq));assert.equal((await engine.get(a.header,game.id)).status,'accepted');
  await engine.forfeit(a.header,game.id);
 });
 await t.test('one correct overtime answer wins; overtime never increases field-rank points',async()=>{
  await refill(a);await refill(b);const game=await battle();await advance(3000);const s=await snapshot(game.id);
  for(let i=0;i<5;i++)for(const u of [a,b])await engine.answer(u.header,game.id,{position:i+1,answer:s.questions[i].answer});
  await advance(3000);const q=s.questions[5];await engine.overtime(a.header,game.id,{round:0,answer:q.answer});const done=await engine.overtime(b.header,game.id,{round:0,answer:q.type==='mc'?(q.answer+1)%4:!q.answer});
  assert.equal(done.status,'finished');assert.equal(done.reason,'overtime');const [rows]=await db.execute('SELECT quiz_total,rank_score FROM study_records WHERE battle_id=?',[game.id]);assert(rows.every(r=>r.quiz_total===6&&r.rank_score===5));
 });
 await t.test('study skip votes persist, cancel and retry safely; mutual consent starts the same full quiz immediately',async()=>{
  await refill(a);await refill(b);const game=await battle();
  await assert.rejects(engine.studySkip(a.header,game.id,{agree:true}),{code:'not_studying'});
  await advance(1000);const original=await engine.get(a.header,game.id);assert.equal(original.phase,'study');assert.equal(original.studySkip.count,0);assert.equal(original.questions,null);
  const first=await engine.studySkip(a.header,game.id,{agree:true});assert.equal(first.studySkip.count,1);assert.equal(first.studySkip.myAgreed,true);assert.equal(first.phase,'study');
  const restored=await createBattleService(config).get(b.header,game.id);assert.equal(restored.studySkip.count,1);assert.equal(restored.studySkip.myAgreed,false);
  assert.equal((await engine.studySkip(a.header,game.id,{agree:true})).studySkip.count,1);
  assert.equal((await engine.studySkip(a.header,game.id,{agree:false})).studySkip.count,0);
  await engine.studySkip(a.header,game.id,{agree:true});await advance(1000);
  await Promise.all([engine.studySkip(a.header,game.id,{agree:true}),engine.studySkip(b.header,game.id,{agree:true})]);
  const [one,two]=await Promise.all([engine.get(a.header,game.id),engine.get(b.header,game.id)]);
  assert.equal(one.phase,'quiz');assert.equal(two.phase,'quiz');assert.equal(one.studySkip.count,2);assert.equal(one.startAt,original.startAt);assert.equal(one.quizStartAt,two.quizStartAt);assert(Date.parse(one.quizStartAt)<Date.parse(original.quizStartAt));assert.equal(Date.parse(one.quizEndAt)-Date.parse(one.quizStartAt),config.quizSec*1000);
  assert.deepEqual(one.questions,two.questions);assert(one.questions.every(q=>q.explain===''));
  await advance(500);const late=await engine.studySkip(a.header,game.id,{agree:false});assert.equal(late.phase,'quiz');assert.equal(late.studySkip.count,2);assert.equal(late.quizEndAt,one.quizEndAt);
  await advance(3000);const [rows]=await db.execute('SELECT study_sec FROM study_records WHERE battle_id=?',[game.id]);assert.equal(rows.length,2);assert(rows.every(r=>r.study_sec===1));
 });
 await t.test('study skip HTTP checks authentication, ownership and boolean consent',async()=>{
  await refill(a);await refill(b);const game=await battle(),path='/battles/'+game.id+'/study-skip';
  const post=async(u,body)=>fetch(base+path,{method:'POST',headers:{...(u?{authorization:u.header}:{}),'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post(null,{agree:true})).status,401);assert.equal((await post(c,{agree:true})).status,404);
  await advance(1000);assert.equal((await post(a,{agree:'true'})).status,400);
  const first=await post(a,{agree:true});assert.equal(first.status,200);assert.equal((await first.json()).studySkip.count,1);
  const second=await post(b,{agree:true});assert.equal(second.status,200);assert.equal((await second.json()).phase,'quiz');await engine.forfeit(a.header,game.id);
 });
 await t.test('common study upload accepts 5 and 10 items but never lets a client create battle records',async()=>{
  for(const total of [5,10]){const p={id:randomUUID(),topicId:'ds-01',memo:'일반',studySec:10,total,score:total,studiedAt:new Date().toISOString(),items:Array.from({length:total},(_,i)=>({question:{type:'ox',q:'일반 '+i,answer:true,explain:'연습',src:'offline'},answer:true}))};assert.equal((await records.upload(a.header,{records:[p]})).saved,1);assert.equal((await records.upload(a.header,{records:[{...p,id:randomUUID(),studyType:'battle'}]})).saved,0);}
 });
});
