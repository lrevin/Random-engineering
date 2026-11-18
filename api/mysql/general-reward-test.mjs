import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {connect} from '../server/db.mjs';
import {createAuth} from '../server/auth.mjs';
import {createRecordService,calculateXp} from './record-service.mjs';
import {databaseStore} from './question-service.mjs';
import {createActivityService} from './activity-service.mjs';
import {createLeaderboardService} from './leaderboard-service.mjs';
import {validateQuest} from './quest-policy.mjs';
import {questsFor,questKey} from './policy/quests.mjs';
import {purgeExpiredAccounts} from './account-service.mjs';
import {rewardEligibility,rewardSql} from './reward-eligibility.mjs';

test('일반 보상 실제 DB: 자격·증거·중복·과거 지급·숨김',async t=>{
 const db=await connect(),auth=createAuth({secret:randomBytes(48).toString('hex')}),users=[];
 const account=await auth.signup({email:randomUUID()+'@example.com',password:'General!12345'});users.push(account.user.id);
 const id=account.user.id,h='Bearer '+account.accessToken;let clock=new Date('2026-11-15T01:00:00Z');
 // 시간 퀘스트가 선정된 날짜를 찾아 실제 동일 정책으로 수령을 검사한다.
 for(let n=0;n<40&&!questsFor('day',[],clock).some(q=>q.id==='study15');n++)clock=new Date(+clock+86400000);
 assert(questsFor('day',[],clock).some(q=>q.id==='study15'));
 const service=createRecordService({auth,now:()=>new Date(clock)}),activity=createActivityService({auth,now:()=>new Date(clock)});
 const bank=await databaseStore(db).questions('ds-01');
 const make=(patch={})=>({id:randomUUID(),topicId:'ds-01',memo:'일반 보상 검사',studySec:900,score:7,total:7,studiedAt:clock.toISOString(),items:bank.slice(0,7).map(q=>({question:{...q,src:'bank'},answer:q.answer})),...patch});
 const upload=async p=>{const x=(await service.upload(h,{records:[p]})).results[0];assert.equal(x.ok,true,JSON.stringify(x));return x.record;};
 const awards=async record=>Number((await db.execute("SELECT COUNT(*) AS n FROM xp_ledger WHERE source_record_id=? AND event_type='award'",[record.id]))[0][0].n);
 t.after(async()=>{for(const uid of users)await db.execute("UPDATE users SET status='deleting',deletion_requested_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 31 DAY) WHERE id=?",[uid]);await purgeExpiredAccounts({onlyUserIds:users});await db.end();});
 let unverified,verified,legacy,zero;
 await t.test('미검증은 원장 없이 보관·조회·동기화하고 위조 자격은 무시',async()=>{
  const p=make({rewardStatus:'eligible',eligibility:{questEligible:true}});p.items[0].question.src='ai';
  unverified=await upload(p);assert.equal(unverified.rewardStatus,'ineligible');assert.equal(unverified.rp,0);assert.equal(await awards(p),0);
  assert.equal(unverified.eligibility.rankEligible,false);assert.equal(unverified.countsAsStudy,false);
  assert((await service.snapshot(h)).records.some(r=>r.id===p.id));assert.equal((await service.get(h,p.id)).record.id,p.id);
  const replay=await upload(p);assert.equal(replay.rewardStatus,'ineligible');assert.equal(await awards(p),0);
  await assert.rejects(validateQuest(db,id,questKey('day','finish1',clock),clock),{code:'quest_not_complete'});
 });
 await t.test('정상 기본 문제 XP는 이전 미검증 반복에 감점되지 않는다',async()=>{
  const p=make();verified=await upload(p);assert.equal(verified.rewardStatus,'eligible');assert.equal(verified.rp,calculateXp(1,7,0,1).total);
  assert.equal(verified.eligibility.timeQuestEligible,false);assert.equal(verified.eligibility.rankEligible,true);assert.equal(await awards(p),1);
  assert.equal(await validateQuest(db,id,questKey('day','finish1',clock),clock),2);
  await assert.rejects(validateQuest(db,id,questKey('day','study15',clock),clock),{code:'quest_not_complete'});
 });
 await t.test('미래 시각은 보류하고 시간이 흐른 뒤 재전송해도 자동 지급하지 않는다',async()=>{
  const p=make({studiedAt:new Date(+clock+600000).toISOString()});const held=await upload(p);
  assert.equal(held.rewardStatus,'held');assert.equal(held.rewardReason,'time_needs_review');assert.equal(held.countsAsStudy,false);assert.equal(await awards(p),0);
  const before=clock;clock=new Date(+clock+3600000);assert.equal((await upload(p)).rewardStatus,'held');assert.equal(await awards(p),0);clock=before;
 });
 await t.test('30일 밖 업로드는 기록 보류·실적 제외',async()=>{
  const p=make({studiedAt:new Date(+clock-31*86400000).toISOString()});const held=await upload(p);assert.equal(held.rewardReason,'outside_study_window');assert.equal(held.rp,0);assert.equal(await awards(p),0);
 });
 await t.test('원본 불일치·중복·타 회원 ID·변경 재전송을 거절',async()=>{
  const p=make();p.items[0].question.q+=' 위조';const x=(await service.upload(h,{records:[p]})).results[0];assert.equal(x.error,'bank_question_mismatch');
  const repeated=make();repeated.items[1]=structuredClone(repeated.items[0]);assert.equal((await service.upload(h,{records:[repeated]})).results[0].error,'duplicate_question');
  const other=await auth.signup({email:randomUUID()+'@example.com',password:'General!12345'});users.push(other.user.id);
  const forged=make({id:verified.id});assert.equal((await service.upload('Bearer '+other.accessToken,{records:[forged]})).results[0].error,'record_conflict');
 });
 await t.test('실제 0점은 적격 0 XP 원장이고 동시 재전송도 한 번만 정산',async()=>{
  const p=make({score:0});p.items=p.items.map(i=>({...i,answer:i.question.type==='ox'?!i.answer:(i.answer+1)%4}));
  const result=await Promise.all([upload(p),upload(p)]);zero=result[0];assert.equal(zero.rewardStatus,'eligible');assert.equal(zero.rp,0);assert.equal(await awards(p),1);
 });
 await t.test('과거 미검증 지급은 잔액·랭크를 보존하지만 새 퀘스트·반복 증거는 제외',async()=>{
  const p=make();p.items=p.items.map(i=>({...i,question:{...i.question,src:'offline'}}));legacy=await upload(p);
  await db.execute("UPDATE study_records SET reward_status='legacy_granted',reward_policy_version='legacy',rp=77 WHERE id=?",[p.id]);
  await db.execute("INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,rule_version,verification_status,calculation_details,idempotency_key) VALUES (?,?,?,'ds-01','award',77,'rp-v1','client_reported','{}',?)",[randomUUID(),id,p.id,'legacy:'+p.id]);
  legacy=(await service.get(h,p.id)).record;assert.equal(legacy.eligibility.rankEligible,true);assert.equal(legacy.eligibility.questEligible,false);assert.equal(legacy.eligibility.repeatEligible,false);
  const stats=await service.stats(h);assert.equal(stats.totalXp,verified.rp+77);
 });
 await t.test('SQL·응답의 용도별 자격 일치, 순위·통계 미검증 제외',async()=>{
  const [rows]=await db.execute('SELECT r.*,a.verification_status,a.rule_version FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id WHERE r.user_id=?',[id]);
  for(const [use,key]of [['quest','questEligible'],['time','timeQuestEligible'],['day','studyDayEligible'],['repeat','repeatEligible'],['rank','rankEligible'],['leaderboard','leaderboardEligible']]){
   const [selected]=await db.execute(`SELECT r.id FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id WHERE r.user_id=? AND ${rewardSql(use)}`,[id]);
   assert.deepEqual(selected.map(x=>x.id).sort(),rows.filter(r=>rewardEligibility(r)[key]).map(x=>x.id).sort(),use);
  }
  const stats=await service.stats(h);assert.equal(stats.topics[0].attempts,3);
  const ranking=await createLeaderboardService({auth}).top(h,verified.domain,new URLSearchParams());assert.equal(ranking.me.xp,verified.rp+77);
 });
 await t.test('숨김·복원·재전송은 지급과 자격을 변경하지 않는다',async()=>{
  const before=await service.stats(h);await service.visibility(h,verified.id,{hidden:true});await service.visibility(h,unverified.id,{hidden:true});
  assert.deepEqual(await service.stats(h),before);await service.visibility(h,verified.id,{hidden:false});assert.equal((await service.get(h,verified.id)).record.rewardStatus,'eligible');
 });
 await t.test('서버 학습 시간 증거만 시간 퀘스트에 반영한다',async()=>{
  const a=await activity.issue(h,{requestId:randomUUID(),purpose:'study',topicId:'ds-01',studySec:900});clock=new Date(+clock+900000);
  const q=await activity.event(h,a.id,{requestId:randomUUID(),event:'quiz'});
  const p=make({id:a.id,attemptId:a.id,studySec:999999,items:q.items.map(i=>({question:i.question,answer:i.question.answer}))});
  const saved=await upload(p);assert.equal(saved.studySec,900);assert.equal(saved.eligibility.timeQuestEligible,true);
  assert.equal(await validateQuest(db,id,questKey('day','study15',clock),clock),3);
 });
 await t.test('근거 승인 후 보류 재판정은 원본 ID·해시·시각 유지, 동시 요청에도 1회 지급',async()=>{
  const p=make({studiedAt:new Date(+clock+600000).toISOString()});await upload(p);clock=new Date(+clock+3600000);
  assert.equal((await service.reassessHeld(h,p.id)).record.rewardStatus,'held');assert.equal(await awards(p),0);
  // 공개 API가 아닌 신뢰된 서버 검토가 증거 상태를 승인한 상황을 재현한다.
  await db.execute("UPDATE study_records SET time_validation_status='accepted',study_date=DATE(DATE_ADD(studied_at,INTERVAL 9 HOUR)) WHERE id=?",[p.id]);
  const values=await Promise.all([service.reassessHeld(h,p.id),service.reassessHeld(h,p.id)]);assert(values.every(v=>v.record.rewardStatus==='eligible'));
  assert.equal(await awards(p),1);assert(values[0].record.rp>0);assert.equal(values[0].record.studiedAt,p.studiedAt);
  assert.equal((await upload(p)).rp,values[0].record.rp);
  const [[l]]=await db.execute('SELECT calculation_details FROM xp_ledger WHERE source_record_id=?',[p.id]);const details=typeof l.calculation_details==='string'?JSON.parse(l.calculation_details):l.calculation_details;
  assert.equal(details.reassessment.previousReason,'time_needs_review');
 });

});
