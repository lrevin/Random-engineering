import test from 'node:test';
import assert from 'node:assert/strict';
import {rewardEligibility,initialRewardState,rewardSql} from '../mysql/reward-eligibility.mjs';
const good={study_type:'study',verification_status:'server_verified',time_validation_status:'accepted',study_date:'2026-11-15',reward_status:'eligible',rule_version:'special-v1'};
test('일반 보상: 문제·시간·용도별 공통 자격과 정상 0점 구분',()=>{
 const result=rewardEligibility(good);for(const k of ['xpEligible','questEligible','timeQuestEligible','rankEligible','studyDayEligible','repeatEligible','boostEligible'])assert.equal(result[k],true,k);
 assert.equal(rewardEligibility({...good,rule_version:'legacy'}).timeQuestEligible,false);
 assert.equal(rewardEligibility({...good,rule_version:'legacy'}).xpEligible,true);
});
test('미검증·시각 보류는 기록만 보존하고 신규 지급·실적에서 제외',()=>{
 for(const patch of [{verification_status:'client_reported',reward_status:'ineligible'},{time_validation_status:'needs_review',study_date:null,reward_status:'held'}]){
  const p=rewardEligibility({...good,...patch});assert.equal(p.recordAccepted,true);for(const k of ['xpEligible','questEligible','rankEligible','leaderboardEligible','studyDayEligible','repeatEligible','boostEligible'])assert.equal(p[k],false,k);
 }
 assert.deepEqual(initialRewardState({verification:'server_verified',timeStatus:'needs_review',studyDate:null}),{status:'held',reason:'time_needs_review'});
 assert.equal(initialRewardState({verification:'server_verified',timeStatus:'accepted',studyDate:null}).status,'held');
 assert.equal(initialRewardState({verification:'client_reported',timeStatus:'accepted',studyDate:'2026-11-15'}).status,'ineligible');
});
test('과거 기여 보존은 새 퀘스트·반복 입력을 인정한다는 뜻이 아니다',()=>{
 const p=rewardEligibility({...good,verification_status:'client_reported',reward_status:'legacy_granted'});
 assert.equal(p.rankEligible,true);assert.equal(p.leaderboardEligible,true);assert.equal(p.questEligible,false);assert.equal(p.repeatEligible,false);assert.equal(p.xpEligible,false);
});
test('배틀 정산과 포기 학습일 제외를 유지하고 SQL 필터 용도를 구분',()=>{
 const b={...good,study_type:'battle'};assert.equal(rewardEligibility(b).rankEligible,true);assert.equal(rewardEligibility(b).questEligible,false);
 assert.equal(rewardEligibility({...b,study_date:null}).rankEligible,false);assert.equal(rewardEligibility({...b,study_date:null}).leaderboardEligible,true);
 for(const use of ['rank','leaderboard','quest','time','repeat','day'])assert.equal(typeof rewardSql(use),'string');
 assert.throws(()=>rewardSql('quest','untrusted'));assert.throws(()=>rewardSql('unknown'));
});
