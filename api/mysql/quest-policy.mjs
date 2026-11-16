import {rewardSql} from './reward-eligibility.mjs';
import {validateSpecialReward,premiumQuests} from './reward-evidence.mjs';
import {walletState} from './wallet-state.mjs';
import {AuthError} from '../server/auth.mjs';
import {questsFor,questKey,PERIODS} from './policy/quests.mjs';
// All reward periods are evaluated in Korea time, consistently with the service policy.
export async function validateQuest(db,id,key,now){
 if(typeof key!=='string'||key.length>100)throw new AuthError('invalid_quest',400);
 const [rows]=await db.execute(`SELECT r.topic_id AS topicId,r.score,r.quiz_total AS total,
 CASE WHEN ${rewardSql('time')} THEN r.study_sec ELSE 0 END AS studySec,r.rp,r.memo,
 r.studied_at AS studiedAt,r.difficulty FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id
 WHERE r.user_id=? AND ${rewardSql('quest')}`,[id]);
 const records=rows.map(r=>({...r,studiedAt:r.studiedAt.replace(' ','T')+'Z',level:['','기초','중급','심화'][r.difficulty]}));
 const special=await validateSpecialReward(db,id,key,now);if(special!==null)return special;
 const premium=await premiumQuests(db,id,now);
 if(premium.some(q=>questKey('premium',q.id,now)===key)||key===questKey('premium','bonus',now)){
  if(!(await walletState(db,id,now)).state.premium)throw new AuthError('premium_required',409);
  if(key===questKey('premium','bonus',now)&&premium.every(q=>q.done))return PERIODS.premium.bonus;
  const q=premium.find(q=>questKey('premium',q.id,now)===key);if(q?.done)return q.reward;
  throw new AuthError('quest_not_complete',409);
 }
 for(const period of ['day','week','month']){
  if(key===questKey('day','attend',now))return 2;
  const qs=questsFor(period,records,now);
  if(key===questKey(period,'bonus',now)&&qs.every(q=>q.done))return PERIODS[period].bonus;
  const q=qs.find(q=>questKey(period,q.id,now)===key);
  if(q?.done)return q.reward;
 }
 throw new AuthError('quest_not_complete',409);
}
