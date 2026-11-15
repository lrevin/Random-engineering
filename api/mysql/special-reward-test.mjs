import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {connect} from '../server/db.mjs';
import {createAuth} from '../server/auth.mjs';
import {createActivityService,reproducePractice} from './activity-service.mjs';
import {createRecordService} from './record-service.mjs';
import {createMemberService} from './member-service.mjs';
import {createProgressService} from './progress-service.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
import {hash} from '../shared/question-store.mjs';
import {questKey,questsFor} from './policy/quests.mjs';
import {questPeriodEnd} from './policy/quest-time.mjs';
import {createBattleService} from './battle-service.mjs';
const parse=v=>typeof v==='string'?JSON.parse(v):v;
test('특수 보상·출제 증거·학습 단계·숨김 실제 MySQL 통합',async t=>{
 const db=await connect(),auth=createAuth({secret:randomBytes(48).toString('base64url')}),users=[];
 const signup=async()=>{const x=await auth.signup({email:randomUUID()+'@example.com',password:'Password!123'});users.push(x.user.id);return x;};
 const a=await signup(),b=await signup(),h='Bearer '+a.accessToken,hb='Bearer '+b.accessToken;
 let clock=new Date('2026-11-15T00:00:00Z');const now=()=>new Date(clock),activity=createActivityService({auth,now}),records=createRecordService({auth,now}),members=createMemberService({auth,now});
 const op=(key,requestId=randomUUID())=>members.operate(h,{requestId,action:'quest',payload:{key}});
 const event=(a,event,id=randomUUID())=>activity.event(h,a.id,{event,requestId:id});
 const issue=(purpose,patch={})=>activity.issue(h,{requestId:randomUUID(),purpose,...patch});
 const answers=x=>x.items.map(i=>i.question.answer);
 const finishStudy=async(x,correct=7)=>{
  const qs=x.studyEndedAt?x:await event(x,'quiz');
  const body={id:qs.id,attemptId:qs.id,topicId:qs.topicId,memo:'',studySec:999999,score:0,total:7,studiedAt:clock.toISOString(),items:qs.items.map((i,n)=>({question:{...i.question,answer:i.question.type==='mc'?0:true},answer:n<correct?i.question.answer:i.question.type==='mc'?(i.question.answer+1)%4:!i.question.answer}))};
  const response=await records.upload(h,{records:[body]});assert.equal(response.results[0].ok,true,JSON.stringify(response));return {record:response.results[0].record,body};
 };
 const premium=async()=>{const w=await members.wallet(h);w.state.premium=true;await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',[a.user.id,randomUUID(),Buffer.from(hash({premium:true}),'hex'),'admin_grant','{}',JSON.stringify(w)]);};
 t.after(async()=>{for(const id of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 8 DAY) WHERE id=?",[id]);await purgeExpiredAccounts({onlyUserIds:users});await db.end();});
 let topicId,firstRecord,firstBody;
 await t.test('인증·후보 없음·프로필 설정 후 최초 배정',async()=>{
  await assert.rejects(activity.status(''),{code:'unauthorized'});assert.equal((await activity.status(h)).daily.topicId,null);
  await db.execute("INSERT INTO profiles(user_id,nickname,interests) VALUES (?,'시험회원',JSON_ARRAY('ds'))",[a.user.id]);
  topicId=(await activity.status(h)).daily.topicId;assert(topicId);
  await db.execute("UPDATE profiles SET interests=JSON_ARRAY('net') WHERE user_id=?",[a.user.id]);assert.equal((await activity.status(h)).daily.topicId,topicId);
 });
 await t.test('시작 재전송·동시 요청·내용 충돌·소유권',async()=>{
  const body={requestId:randomUUID(),purpose:'study',topicId,studySec:60};
  const [x,y]=await Promise.all([activity.issue(h,body),activity.issue(h,body)]);assert.equal(x.id,y.id);
  await assert.rejects(activity.issue(h,{...body,studySec:120}),{code:'operation_conflict'});
  await assert.rejects(activity.get(hb,x.id),{code:'not_found'});
  await assert.rejects(issue('study',{topicId,studySec:1800}),{code:'invalid_study_time'});
 });
 await t.test('서버 출제·학습 타이머·정지·재개·상한·퀴즈 경과',async()=>{
  const x=await issue('study',{topicId,studySec:60});clock=new Date(+clock+20000);const pauseId=randomUUID();await event(x,'pause',pauseId);clock=new Date(+clock+40000);await event(x,'pause',pauseId);await event(x,'resume');clock=new Date(+clock+20000);
  assert.equal((await activity.get(h,x.id)).studySec,40);const q=await event(x,'quiz');assert.equal(q.studySec,40);assert.equal(q.items.length,7);assert.equal((await event(x,'quiz')).items[0].question.q,q.items[0].question.q);
  clock=new Date(+clock+10000);const saved=await finishStudy(q,6);firstRecord=saved.record;firstBody=saved.body;
  assert.equal(firstRecord.score,6);assert.equal(firstRecord.studySec,40);assert.equal(firstRecord.verificationStatus,'server_verified');assert.equal((await activity.get(h,x.id)).quizSec,10);
  assert.equal((await records.upload(h,{records:[firstBody]})).results[0].record.id,firstRecord.id);
 });
 await t.test('서버 점수로 정정·잘못된 보기 거절·다른 답안 재전송 충돌',async()=>{
  const changed=structuredClone(firstBody);changed.items[0].answer=typeof changed.items[0].answer==='boolean'?!changed.items[0].answer:(changed.items[0].answer+1)%4;
  assert.equal((await records.upload(h,{records:[changed]})).results[0].error,'record_conflict');
  const x=await issue('study',{topicId,studySec:0}),q=await event(x,'quiz');
  const bad={...firstBody,id:x.id,attemptId:x.id,items:q.items.map(i=>({question:i.question,answer:'bad'}))};
  assert.equal((await records.upload(h,{records:[bad]})).results[0].error,'invalid_answers');
 });
 await t.test('오늘의 주제 10개는 서버 검증·날짜·하루 한 번 지급',async()=>{
  const status=await activity.status(h);assert.equal(status.daily.done,true);
  const key='daily-topic:'+status.day,before=(await members.wallet(h)).balance,request=randomUUID();
  await op(key,request);await op(key,request);assert.equal((await members.wallet(h)).balance,before+10);
  await assert.rejects(op(key),{code:'already_claimed'});clock=new Date(+clock+86400000);await assert.rejects(op(key),{code:'quest_not_complete'});
 });
 await t.test('숨김·복원은 XP·특수 보상 증거·스냅샷을 유지',async()=>{
  const before=await records.stats(h);await records.remove(h,firstRecord.id);assert((await records.snapshot(h)).records.find(r=>r.id===firstRecord.id).hiddenAt);
  assert.deepEqual(await records.stats(h),before);assert(!(await records.list(h,new URLSearchParams())).records.some(r=>r.id===firstRecord.id));
  await records.visibility(h,firstRecord.id,{hidden:false});assert.equal((await records.get(h,firstRecord.id)).record.hiddenAt,null);
  await assert.rejects(records.visibility(hb,firstRecord.id,{hidden:false}),{code:'not_found'});
 });
 await t.test('V6의 완료·합격·오답 해결 표시는 프리미엄 증거가 아님',async()=>{
  await createProgressService({auth}).save(h,'exam',{value:{results:[{pass:true,at:clock.toISOString()}]}});
  const state=await activity.status(h);assert(state.premiumQuests.every(q=>q.value===0));
 });
 await t.test('서버 증거 없는 복습 보상 요청은 차단',async()=>{await assert.rejects(op('recall:2026-11-16'),{code:'quest_not_complete'});});
 let recall;
 await t.test('복습 달력 이틀·15문항 상한·중도 포기는 완료 아님',async()=>{
  assert.equal((await activity.status(h)).recall.length,0);clock=new Date(+clock+86400000);const due=(await activity.status(h)).recall;assert(due.some(t=>t.topicId===topicId));
  recall=await issue('recall');assert(recall.items.length<=15);assert.equal(recall.items.length%3,0);
  await assert.rejects(activity.complete(h,recall.id,{answers:[]}),{code:'invalid_answers'});
  const quit=await issue('recall');await activity.abandon(h,quit.id);await assert.rejects(activity.complete(h,quit.id,{answers:answers(quit)}),{code:'activity_closed'});
 });
 await t.test('복습 완료·5개 자동 지급 원자성·동시 재전송 중복 없음',async()=>{
  const before=(await members.wallet(h)).balance;
  const [x,y]=await Promise.all([activity.complete(h,recall.id,{answers:answers(recall)}),activity.complete(h,recall.id,{answers:answers(recall)})]);assert.equal(x.completedAt,y.completedAt);assert.equal((await members.wallet(h)).balance,before+5);assert.equal((await activity.status(h)).recall.length,0);
  const different=answers(recall);different[0]=recall.items[0].question.type==='mc'?(Number(different[0])+1)%4:!different[0];await assert.rejects(activity.complete(h,recall.id,{answers:different}),{code:'answer_conflict'});
 });
 await t.test('복습 보상 원장 오류는 완료·지급 모두 롤백',async()=>{
  clock=new Date(+clock+2*86400000);const x=await issue('recall'),before=(await members.wallet(h)).balance;
  const broken=createActivityService({auth,now,connectionFactory:async()=>{const c=await connect(),execute=c.execute.bind(c);c.execute=async(sql,args)=>{if(sql.startsWith('INSERT INTO wallet_transactions'))throw new Error('injected');return execute(sql,args);};return c;}});
  await assert.rejects(broken.complete(h,x.id,{answers:answers(x)}),/injected/);assert.equal((await activity.get(h,x.id)).status,'issued');assert.equal((await members.wallet(h)).balance,before);
 });
 await t.test('모의고사 시작·권 소비·문항 수·서버 합격·재전송',async()=>{
  const [[cert]]=await db.execute('SELECT id FROM certificates WHERE is_active=1 ORDER BY id LIMIT 1');
  const x=await issue('exam',{certId:cert.id});assert(x.items.length>=10);assert.equal(x.items.length%10,0);
  const body={requestId:x.id,purpose:'exam',certId:cert.id};assert.equal((await activity.issue(h,body)).id,x.id);assert.equal((await members.wallet(h)).assets.examFreeUsed,1);
  const done=await activity.complete(h,x.id,{answers:answers(x)});assert.equal(done.result.pass,true);assert.equal((await activity.complete(h,x.id,{answers:answers(x)})).completedAt,done.completedAt);
  await assert.rejects(issue('exam',{certId:cert.id}),{code:'exam_ticket_required'});
 });
 await t.test('오답 해결은 문항별 최초 정답만 집계·중도 포기에도 유지',async()=>{
  await assert.rejects(issue('review'),{code:'premium_required'});await premium();
  const x=await issue('review');assert(x.items.length>0&&x.items.length<=10);
  await activity.answer(h,x.id,{position:1,answer:x.items[0].question.answer});await activity.answer(h,x.id,{position:1,answer:x.items[0].question.answer});
  const [[count]]=await db.execute('SELECT COUNT(*) AS n FROM quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id WHERE a.user_id=? AND i.resolved_at IS NOT NULL',[a.user.id]);assert.equal(Number(count.n),1);await activity.abandon(h,x.id);
  await assert.rejects(issue('review'),{code:'review_not_due'});
 });
 await t.test('30분 조건은 서버 학습 단계만 인정·연장 중복 차감 방지',async()=>{
  const x=await issue('study',{topicId,studySec:1800});clock=new Date(+clock+1800000);const q=await event(x,'quiz');assert.equal(q.studySec,1800);await finishStudy(q);
  const ex=await issue('study',{topicId,studySec:60});clock=new Date(+clock+120000);const eid=randomUUID(),before=(await members.wallet(h)).balance;
  await event(ex,'extend',eid);await event(ex,'extend',eid);assert.equal((await members.wallet(h)).balance,before-10);clock=new Date(+clock+30000);const eq=await event(ex,'quiz');assert.equal(eq.studySec,90);
 });
 await t.test('배정 주제 비활성화는 시작 전에만 재배정',async()=>{
  const status=await activity.status(h),tid=status.daily.topicId;
  if(tid){await issue('study',{topicId:tid,studySec:0});await db.execute('UPDATE topics SET is_active=0 WHERE id=?',[tid]);try{assert.equal((await activity.status(h)).daily.topicId,tid);}finally{await db.execute('UPDATE topics SET is_active=1 WHERE id=?',[tid]);}}
 });
 await t.test('프리미엄 퀘스트는 실제 모의고사 완료를 주간 1회 보상',async()=>{
  const status=await activity.status(h),q=status.premiumQuests.find(q=>q.id==='exam1');assert.equal(q.done,true);
  const key=questKey('premium','exam1',clock),before=(await members.wallet(h)).balance,request=randomUUID();
  await op(key,request);await op(key,request);assert.equal((await members.wallet(h)).balance,before+12);await assert.rejects(op(key),{code:'already_claimed'});
 });
 await t.test('은행에 없는 대체 문제도 재현·서버 채점하며 영구 문제 은행을 늘리지 않음',async()=>{
  const [[t]]=await db.execute("SELECT t.id FROM topics t WHERE t.is_active=1 AND NOT EXISTS(SELECT 1 FROM questions q WHERE q.topic_id=t.id) LIMIT 1");assert(t);
  const [[before]]=await db.execute('SELECT COUNT(*) AS n FROM questions');
  const a=await issue('study',{topicId:t.id,studySec:0}),q=await event(a,'quiz');assert(q.items.every(i=>i.question.src==='offline'));
  for(const [index,item]of q.items.entries())assert.deepEqual(item.question,{...reproducePractice(item.question.material,item.question.seed,index+1),topicId:t.id});
  assert.equal((await finishStudy(q)).record.verificationStatus,'server_verified');
  const [[after]]=await db.execute('SELECT COUNT(*) AS n FROM questions');assert.equal(after.n,before.n);
 });
 await t.test('최고 연속일 마일스톤은 재화·스킨·칭호 원자 지급·자동 장착 없음',async()=>{
  const end=new Date(clock);
  for(let i=6;i>=0;i--){clock=new Date(+end-i*86400000);const x=await issue('study',{topicId,studySec:0});await finishStudy(x);}
  const status=await activity.status(h);assert(status.bestStreak>=7);await assert.rejects(op('streak-milestone:30'),{code:'quest_not_complete'});
  const key='streak-milestone:7',before=await members.wallet(h);
  const broken=createMemberService({auth,now,connectionFactory:async()=>{const c=await connect(),execute=c.execute.bind(c);c.execute=async(sql,args)=>{if(sql.startsWith('INSERT INTO wallet_operations'))throw new Error('injected');return execute(sql,args);};return c;}});
  await assert.rejects(broken.operate(h,{requestId:randomUUID(),action:'quest',payload:{key}}),/injected/);
  let after=await members.wallet(h);assert.equal(after.balance,before.balance);assert(!after.assets.ownedSkins.includes('sprout'));
  const request=randomUUID();await op(key,request);await op(key,request);after=await members.wallet(h);assert.equal(after.balance,before.balance+30);assert(after.assets.ownedSkins.includes('sprout'));assert(after.assets.ownedTitles.includes('t-streak7'));assert.equal(after.assets.activeSkin,before.assets.activeSkin);assert.equal(after.assets.activeTitle,before.assets.activeTitle);
  await assert.rejects(op(key),{code:'already_claimed'});
 });

 await t.test('미검증 기기 기록은 특수 보상 연속일·복습 근거로 사용하지 않음',async()=>{
  const before=(await activity.status(h)).bestStreak,unverifiedTopic=topicId==='ds-01'?'ds-02':'ds-01';
  for(let i=20;i>=18;i--){const p={id:randomUUID(),topicId:unverifiedTopic,memo:'',studySec:100,score:7,total:7,studiedAt:new Date(+clock-i*86400000).toISOString(),items:Array.from({length:7},(_,n)=>({question:{type:'ox',q:`기기 주장 ${n}`,answer:true,explain:'기기 해설',src:'offline'},answer:true}))};assert.equal((await records.upload(h,{records:[p]})).results[0].record.verificationStatus,'client_reported');}
  const status=await activity.status(h);assert.equal(status.bestStreak,before);assert(!status.recall.some(x=>x.topicId===unverifiedTopic));
 });
 await t.test('같은 미해결 원본은 한 번 집계하고 해결 후 새 오답은 옛 풀이로 닫지 않음',async()=>{
  const [[source]]=await db.execute('SELECT question_snapshot,question_id FROM quiz_attempt_items WHERE attempt_id=? AND is_correct=0 LIMIT 1',[firstRecord.attemptId]);assert(source);
  const wrongAgain=async()=>{const a=await issue('study',{topicId,studySec:0});await event(a,'quiz');await db.execute('UPDATE quiz_attempt_items SET question_snapshot=?,question_id=? WHERE attempt_id=? AND position=7',[JSON.stringify(parse(source.question_snapshot)),source.question_id,a.id]);const q=await activity.get(h,a.id);return finishStudy(q,6);};
  await wrongAgain();await wrongAgain();
  const x=await issue('review'),y=await issue('review');assert.equal(x.items.length,1);assert.equal(y.items.length,1);
  await activity.answer(h,x.id,{position:1,answer:x.items[0].question.answer});
  const [resolved]=await db.execute("SELECT i.resolved_at FROM quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id WHERE a.user_id=? AND i.resolved_at IS NOT NULL",[a.user.id]);assert.equal(resolved.length,3);assert.equal(new Set(resolved.map(i=>i.resolved_at)).size,2);
  clock=new Date(+clock+1000);await wrongAgain();
  await activity.answer(h,y.id,{position:1,answer:y.items[0].question.answer});
  const z=await issue('review');assert.equal(z.items.length,1);
 });

 await t.test('프리미엄 30분·정상 배틀 5회·권한·개별 미수령 상자20·주간 만료',async()=>{
  let week=new Date('2027-01-04T00:00:00Z');
  for(let n=0;n<100;n++,week=new Date(+week+7*86400000)){const ids=questsFor('premium',[],week).map(q=>q.id);if(ids.includes('long2')&&ids.includes('battle5'))break;}
  assert(questsFor('premium',[],week).some(q=>q.id==='battle5'));clock=week;
  const [[cert]]=await db.execute('SELECT id FROM certificates WHERE is_active=1 ORDER BY id LIMIT 1');const exam=await issue('exam',{certId:cert.id});await activity.complete(h,exam.id,{answers:answers(exam)});
  for(let i=0;i<2;i++){const a=await issue('study',{topicId,studySec:1800});clock=new Date(+clock+1800000);await finishStudy(a);}
  await db.execute("UPDATE profiles SET interests=JSON_ARRAY('ds') WHERE user_id=?",[a.user.id]);await db.execute("INSERT INTO profiles(user_id,nickname,interests) VALUES (?,'대전 회원',JSON_ARRAY('ds'))",[b.user.id]);
  const wb=await members.wallet(hb);wb.state.premium=true;await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',[b.user.id,randomUUID(),Buffer.alloc(32),'admin_grant','{}',JSON.stringify(wb)]);
  const engine=createBattleService({auth,now,studySec:1,quizSec:10,startDelaySec:1,maxGapMs:Infinity});
  for(let n=0;n<6;n++){
    await engine.join(h,{requestId:randomUUID()});const joined=await engine.join(hb,{requestId:randomUUID()}),battle=joined.battle;assert(battle);
    if(n===5){await engine.forfeit(hb,battle.id);continue;}
    clock=new Date(+clock+3000);await engine.sweep();const [[row]]=await db.execute('SELECT state_json FROM battles WHERE id=?',[battle.id]),state=parse(row.state_json);
    for(let i=0;i<5;i++)await engine.answer(h,battle.id,{position:i+1,answer:state.questions[i].answer});
    for(let i=0;i<5;i++){const q=state.questions[i];await engine.answer(hb,battle.id,{position:i+1,answer:q.type==='mc'?(q.answer+1)%4:!q.answer});}
  }
  const qs=(await activity.status(h)).premiumQuests;assert.equal(qs.find(q=>q.id==='long2').value,2);assert.equal(qs.find(q=>q.id==='battle5').value,5);assert(qs.every(q=>q.done));
  const locked=await members.wallet(h);locked.state.premium=false;await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',[a.user.id,randomUUID(),Buffer.alloc(32),'admin_grant','{}',JSON.stringify(locked)]);
  await assert.rejects(op(questKey('premium','exam1',clock)),{code:'premium_required'});await premium();
  const bonus=questKey('premium','bonus',clock),before=(await members.wallet(h)).balance;await op(bonus);assert.equal((await members.wallet(h)).balance,before+20);await assert.rejects(op(bonus),{code:'already_claimed'});
  for(const q of qs)await op(questKey('premium',q.id,clock));assert.equal((await members.wallet(h)).balance,before+62);
  clock=new Date(+questPeriodEnd('premium',clock)+1);await assert.rejects(op(bonus),{code:'quest_not_complete'});
 });

});
