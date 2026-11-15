import {rewardSql,sourceAttemptSql} from './reward-eligibility.mjs';
import {AuthError} from '../server/auth.mjs';
import {loadTopics} from '../shared/question-store.mjs';
import {walletState} from './wallet-state.mjs';
import {instant} from './purchase-policy.mjs';
import {questDateKey,questPeriodStart,questPeriodEnd} from './policy/quest-time.mjs';
import {questsFor,questKey} from './policy/quests.mjs';
import {bestStudyStreak,recallDue,selectDailyTopic,gradeIssuedExam,MILESTONES} from './special-reward-policy.mjs';
export const parse=v=>typeof v==='string'?JSON.parse(v):v;
const topics=loadTopics(),order=new Map(Object.keys(topics).map((t,i)=>[t,i]));
export async function dailyAssignment(db,id,now){
 const date=questDateKey(now);
 const [[old]]=await db.execute(`SELECT a.*,t.is_active,c.is_active AS category_active,d.is_active AS domain_active FROM daily_topic_assignments a JOIN topics t ON t.id=a.topic_id JOIN categories c ON c.id=t.category_id JOIN domains d ON d.id=c.domain_id WHERE a.user_id=? AND a.assignment_date=?`,[id,date]);
 if(old){
  if(Number(old.is_active)&&Number(old.category_active)&&Number(old.domain_active))return old.topic_id;
  const [[started]]=await db.execute(`SELECT id FROM quiz_attempts WHERE user_id=? AND topic_id=? AND purpose='study' AND started_at>=? AND started_at<? LIMIT 1`,[id,old.topic_id,questPeriodStart('day',now),questPeriodEnd('day',now)]);
  const [[claimed]]=await db.execute('SELECT id FROM wallet_transactions WHERE user_id=? AND request_id=?',[id,`daily-topic:${date}`]);
  if(started||claimed)return old.topic_id;
 }
 const [[profile]]=await db.execute('SELECT interests FROM profiles WHERE user_id=?',[id]);
 const interests=JSON.stringify(profile?parse(profile.interests):[]);
 const [rows]=await db.execute(`SELECT t.id FROM topics t JOIN categories c ON c.id=t.category_id JOIN domains d ON d.id=c.domain_id WHERE t.is_active=1 AND c.is_active=1 AND d.is_active=1 AND
 (JSON_CONTAINS(?,JSON_QUOTE(c.id)) OR JSON_CONTAINS(?,JSON_QUOTE(d.id)) OR EXISTS(SELECT 1 FROM certificate_subject_items i JOIN certificate_subjects s ON s.id=i.subject_id JOIN certificates cert ON cert.id=s.certificate_id WHERE cert.is_active=1 AND JSON_CONTAINS(?,JSON_QUOTE(cert.id)) AND (i.category_id=c.id OR i.topic_id=t.id)))`,[interests,interests,interests]);
 const candidate=selectDailyTopic(id,date,rows.map(x=>x.id).sort((a,b)=>(order.get(a)??1e9)-(order.get(b)??1e9)||a.localeCompare(b)));
 if(candidate)await db.execute('INSERT INTO daily_topic_assignments(user_id,assignment_date,topic_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE topic_id=VALUES(topic_id)',[id,date,candidate]);
 // 후보가 사라진 기존 배정은 보존하되 신규 학습을 제공하지 않는다.
 return candidate;
}
export async function dailyComplete(db,id,topicId,now){
 if(!topicId)return false;
 const [[r]]=await db.execute(`SELECT r.id FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id WHERE r.user_id=? AND r.topic_id=? AND r.study_type='study' AND r.score>=4 AND ${rewardSql('quest')} AND r.received_at>=? AND r.received_at<? AND a.started_at>=? LIMIT 1`,[id,topicId,questPeriodStart('day',now),questPeriodEnd('day',now),questPeriodStart('day',now)]);
 return !!r;
}
export async function milestoneBest(db,id,keptDays){
 const [rows]=await db.execute(`SELECT DISTINCT r.study_date FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id WHERE r.user_id=? AND r.study_date IS NOT NULL AND ${rewardSql('day')}`,[id]);
 return bestStudyStreak(rows.map(r=>r.study_date),keptDays);
}
export async function recallTargets(db,id,now){
 const [rows]=await db.execute(`SELECT topic_id AS topicId,MAX(at) AS last FROM (
 SELECT r.topic_id,r.studied_at AS at FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id WHERE r.user_id=? AND r.study_date IS NOT NULL AND ${rewardSql('day')}
 UNION ALL SELECT i.topic_id,a.completed_at AS at FROM quiz_attempts a JOIN quiz_attempt_items i ON i.attempt_id=a.id WHERE a.user_id=? AND a.purpose='recall' AND a.status='completed' AND a.rule_version='special-v1'
 ) x GROUP BY topic_id`,[id,id]);
 return recallDue(rows.map(r=>({...r,last:instant(r.last).toISOString()})),now);
}
export async function issuedItems(db,attemptId){
 const [rows]=await db.execute('SELECT * FROM quiz_attempt_items WHERE attempt_id=? ORDER BY position',[attemptId]);
 return rows.map(r=>({...r,question:parse(r.question_snapshot),topicId:r.topic_id,subject:r.subject_position===null?undefined:Number(r.subject_position),subjectName:parse(r.question_snapshot).subjectName}));
}
export async function premiumQuests(db,id,now){
 const start=questPeriodStart('week',now),end=questPeriodEnd('week',now);
 const [studies]=await db.execute(`SELECT r.topic_id AS topicId,r.score,r.quiz_total AS total,r.study_sec AS studySec,r.rp,r.memo,r.received_at AS studiedAt,r.study_type AS studyType,r.difficulty,a.rule_version FROM study_records r JOIN quiz_attempts a ON a.id=r.attempt_id
 WHERE r.user_id=? AND r.study_type='study' AND ${rewardSql('quest')} AND r.received_at>=? AND r.received_at<?`,[id,start,end]);
 const records=studies.map(r=>({...r,studiedAt:instant(r.studiedAt).toISOString(),studySec:r.rule_version==='special-v1'?Number(r.studySec):0,level:['','기초','중급','심화'][r.difficulty]}));
 const [battles]=await db.execute(`SELECT r.topic_id AS topicId,r.received_at AS studiedAt FROM study_records r JOIN battles b ON b.id=r.battle_id WHERE r.user_id=? AND r.study_type='battle' AND r.study_date IS NOT NULL AND b.status='finished' AND JSON_UNQUOTE(JSON_EXTRACT(b.state_json,'$.reason')) IN ('score','overtime','draw') AND b.finished_at>=? AND b.finished_at<?`,[id,start,end]);
 records.push(...battles.map(r=>({...r,studiedAt:instant(r.studiedAt).toISOString(),studyType:'battle',memo:'',score:0,total:5,studySec:0,rp:0})));
 const [attempts]=await db.execute("SELECT id,completed_at,certificate_id FROM quiz_attempts WHERE user_id=? AND purpose='exam' AND status='completed' AND rule_version='special-v1' AND completed_at>=? AND completed_at<?",[id,start,end]);
 const exams=[];for(const a of attempts){const items=await issuedItems(db,a.id);const result=gradeIssuedExam(items,items.map(i=>parse(i.submitted_answer)));exams.push({...result,certId:a.certificate_id,at:instant(a.completed_at).toISOString()});}
 const [solved]=await db.execute(`SELECT MIN(i.resolved_at) AS resolved_at FROM quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id WHERE a.user_id=? AND ${sourceAttemptSql()} AND i.resolved_at>=? AND i.resolved_at<? GROUP BY i.topic_id,COALESCE(i.question_id,SHA2(JSON_EXTRACT(i.question_snapshot,'$.q'),256)),i.resolved_at`,[id,start,end]);
 return questsFor('premium',records,now,{exams,solvedAt:solved.map(r=>instant(r.resolved_at).toISOString())});
}
export async function rewardStatus(db,id,now){
 const wallet=await walletState(db,id,now),topicId=await dailyAssignment(db,id,now);
 return {day:questDateKey(now),daily:{topicId,done:await dailyComplete(db,id,topicId,now)},bestStreak:await milestoneBest(db,id,wallet.state.keptDays),milestones:MILESTONES,
 recall:(await recallTargets(db,id,now)).map(r=>({...r,last:r.last.toISOString()})),premiumQuests:(await premiumQuests(db,id,now)).map(q=>({...q,claimKey:questKey('premium',q.id,now)})),premiumBonusKey:questKey('premium','bonus',now),wallet};
}
export async function validateSpecialReward(db,id,key,now){
 if(key.startsWith('daily-topic:')){
  if(key!==`daily-topic:${questDateKey(now)}`||!await dailyComplete(db,id,await dailyAssignment(db,id,now),now))throw new AuthError('quest_not_complete',409);return 10;
 }
 if(key.startsWith('streak-milestone:')){
  const m=MILESTONES.find(m=>key===`streak-milestone:${m.days}`),wallet=await walletState(db,id,now);
  if(!m||await milestoneBest(db,id,wallet.state.keptDays)<m.days)throw new AuthError('quest_not_complete',409);
  for(const [type,item] of [['skin',m.skin],['title',m.title]])await db.execute("INSERT IGNORE INTO member_cosmetics(user_id,item_type,item_id,acquired_via) VALUES (?,?,?,'streak')",[id,type,item]);
  return m.gears;
 }
 return null;
}
