import {AuthError} from '../server/auth.mjs';
import {questDateKey} from './policy/quest-time.mjs';

// 서버가 발급·보존한 문항에만 적용한다. 기기가 제출한 정답은 사용하지 않는다.
export const SPECIAL_RULE_VERSION='special-v1';
export const MILESTONES=[
 {days:7,gears:30,skin:'sprout',title:'t-streak7'},
 {days:30,gears:100,skin:'blaze',title:'t-streak30'},
 {days:100,gears:300,skin:'diamond',title:'t-streak100'},
];
const invalid=()=>{throw new AuthError('invalid_answers',400);};
export function gradeIssued(items,answers){
 if(!Array.isArray(items)||!items.length||!Array.isArray(answers)||answers.length!==items.length)invalid();
 const graded=items.map((item,i)=>{
  const q=item.question,answer=answers[i];
  if(!q||(q.type!=='mc'&&q.type!=='ox'))throw new AuthError('verification_required',409);
  if(q.type==='mc'){
   if(!Array.isArray(q.choices)||q.choices.length!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)throw new AuthError('verification_required',409);
   if(!Number.isInteger(answer)||answer<0||answer>=q.choices.length)invalid();
  }else{
   if(typeof q.answer!=='boolean')throw new AuthError('verification_required',409);
   if(typeof answer!=='boolean')invalid();
  }
  return {...item,answer,correct:answer===q.answer};
 });
 return {items:graded,score:graded.filter(i=>i.correct).length,total:graded.length};
}
export function gradeIssuedExam(items,answers){
 const result=gradeIssued(items,answers),bySubject=new Map();
 const grading=items[0].question.grading??{version:'exam-v1',subjectMin:.4,totalMin:.6};
 if(grading.version!=='exam-v1'||grading.subjectMin!==.4||grading.totalMin!==.6||items.some(i=>i.question.grading&&JSON.stringify(i.question.grading)!==JSON.stringify(grading)))throw new AuthError('verification_required',409);
 for(const item of result.items){
  if(!Number.isInteger(item.subject)||item.subject<0||typeof item.subjectName!=='string')throw new AuthError('verification_required',409);
  const s=bySubject.get(item.subject)??{position:item.subject,name:item.subjectName,total:0,score:0};
  if(s.name!==item.subjectName)throw new AuthError('verification_required',409);
  s.total++;if(item.correct)s.score++;bySubject.set(item.subject,s);
 }
 const subjects=[...bySubject.values()].sort((a,b)=>a.position-b.position);
 return {...result,subjects,pass:result.score/result.total>=grading.totalMin&&subjects.every(s=>s.score/s.total>=grading.subjectMin)};
}
export function bestStudyStreak(studyDates,keptDays=[]){
 const dates=[...new Set([...studyDates,...keptDays].filter(d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d))].sort();
 let best=0,current=0,previous=null;
 for(const d of dates){const t=Date.parse(d+'T00:00:00Z');current=previous!==null&&t-previous===86400000?current+1:1;best=Math.max(best,current);previous=t;}
 return best;
}
export function recallDue(lastTouches,now=new Date()){
 const today=Date.parse(questDateKey(now)+'T00:00:00Z');
 return lastTouches.map(x=>({...x,last:new Date(x.last)}))
  .filter(x=>Number.isFinite(x.last.getTime())&&today-Date.parse(questDateKey(x.last)+'T00:00:00Z')>=2*86400000)
  .sort((a,b)=>a.last-b.last||a.topicId.localeCompare(b.topicId)).slice(0,5);
}
export function selectDailyTopic(uid,date,topicIds){
 if(!topicIds.length)return null;
 let h=2166136261;for(const ch of `daily:${uid}:${date}`)h=Math.imul(h^ch.charCodeAt(0),16777619);
 return topicIds[(h>>>0)%topicIds.length];
}
// 학습 단계만 측정한다. 정지 구간을 빼고 승인된 시간으로 상한을 둔다.
export function studyElapsed({startedAt,endedAt,pausedSec=0,pausedAt=null,allowedSec},now=new Date()){
 const start=new Date(startedAt),end=new Date(endedAt??now),pause=pausedAt?Math.max(0,(end-new Date(pausedAt))/1000):0;
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||!Number.isInteger(allowedSec)||allowedSec<0||!Number.isFinite(pausedSec)||pausedSec<0)throw new AuthError('invalid_study_time',400);
 return Math.max(0,Math.min(allowedSec,Math.floor((end-start)/1000-pausedSec-pause)));
}
