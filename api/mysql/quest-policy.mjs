import {AuthError} from '../server/auth.mjs';
import {questsFor,questKey,PERIODS} from './policy/quests.mjs';
// All reward periods are evaluated in Korea time, consistently with the service policy.
export async function validateQuest(db,id,key,now){
 if(typeof key!=='string'||key.length>100)throw new AuthError('invalid_quest',400);
 const [rows]=await db.execute(`SELECT topic_id AS topicId,score,quiz_total AS total,study_sec AS studySec,rp,memo,
 studied_at AS studiedAt,difficulty FROM study_records WHERE user_id=? AND time_validation_status='accepted' AND study_type='study'`,[id]);
 const records=rows.map(r=>({...r,studiedAt:r.studiedAt.replace(' ','T')+'Z',level:['','기초','중급','심화'][r.difficulty]}));
 // Premium, review and milestone evidence is not yet persisted in this service.
 for(const period of ['day','week','month']){
  if(key===questKey('day','attend',now))return 2;
  const qs=questsFor(period,records,now);
  if(key===questKey(period,'bonus',now)&&qs.every(q=>q.done))return PERIODS[period].bonus;
  const q=qs.find(q=>questKey(period,q.id,now)===key);
  if(q?.done)return q.reward;
 }
 throw new AuthError('quest_not_complete',409);
}
