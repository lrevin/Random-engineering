// 문제·시각·활동 증거를 용도별로 판정한다. 과거 표시 실적과 신규 보상 자격을 분리한다.
export const REWARD_POLICY_VERSION='general-v1';
export function rewardEligibility(r){
 const battle=r.study_type==='battle',legacy=r.reward_status==='legacy_granted';
 const verified=r.verification_status==='server_verified'&&r.time_validation_status==='accepted';
 const dated=verified&&r.study_date!=null;
 const settled=r.reward_status==='eligible'||legacy;
 const normal=!battle&&verified&&settled;
 const rank=battle?r.study_date!=null:legacy||normal;
 return {recordAccepted:true,xpEligible:!battle&&verified&&r.study_date!=null&&r.reward_status==='eligible',
  questEligible:normal,timeQuestEligible:normal&&r.rule_version==='special-v1',
  rankEligible:rank,leaderboardEligible:battle||legacy||normal,
  studyDayEligible:dated&&(battle||settled),repeatEligible:!battle&&dated&&settled,
  boostEligible:normal,policyVersion:r.reward_policy_version??REWARD_POLICY_VERSION};
}
// SQL과 응답의 조건을 같은 모듈에 두고 용도별 과거 실적 보존을 명시한다.
export function rewardSql(use,r='r',a='a'){
 if(!['r','s','history'].includes(r)||a!=='a')throw new Error('invalid_eligibility_alias');
 const proof=`${a}.verification_status='server_verified' AND ${r}.time_validation_status='accepted'`;
 const settled=`${r}.reward_status IN ('eligible','legacy_granted')`;
 const normal=`(${r}.study_type='study' AND ${proof} AND ${settled})`;
 if(use==='quest')return normal;
 if(use==='time')return `(${normal} AND ${a}.rule_version='special-v1')`;
 if(use==='repeat')return `(${normal} AND ${r}.study_date IS NOT NULL)`;
 if(use==='day')return `(${proof} AND ${settled} AND ${r}.study_date IS NOT NULL)`;
 if(use==='rank')return `((${r}.study_type='battle' AND ${r}.study_date IS NOT NULL) OR (${r}.study_type='study' AND (${r}.reward_status='legacy_granted' OR ${normal})))`;
 if(use==='leaderboard')return `(${r}.study_type='battle' OR ${r}.reward_status='legacy_granted' OR ${normal})`;
 throw new Error('invalid_eligibility_use');
}
export function initialRewardState({verification,timeStatus,studyDate}){
 if(timeStatus!=='accepted')return {status:'held',reason:'time_needs_review'};
 if(!studyDate)return {status:'held',reason:'outside_study_window'};
 if(verification!=='server_verified')return {status:'ineligible',reason:'question_unverified'};
 return {status:'eligible',reason:null};
}

// 오답 해결도 인정된 원본만 증거로 사용한다. 모의고사는 전용 서버 출제 경로다.
export function sourceAttemptSql(){
 return `(a.purpose='exam' AND a.rule_version='special-v1' OR a.purpose='study' AND EXISTS(SELECT 1 FROM study_records r WHERE r.attempt_id=a.id AND ${rewardSql('quest')}))`;
}
