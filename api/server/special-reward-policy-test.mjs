import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeIssued,gradeIssuedExam,bestStudyStreak,recallDue,selectDailyTopic,studyElapsed,MILESTONES} from '../mysql/special-reward-policy.mjs';
const mc={type:'mc',choices:['a','b','c','d'],answer:2};
const ox={type:'ox',answer:false};
test('서버 원본으로 채점하며 정상 오답은 거절하지 않는다',()=>{
 assert.deepEqual(gradeIssued([{question:mc},{question:ox}],[1,false]).items.map(i=>i.correct),[false,true]);
 assert.equal(gradeIssued([{question:mc},{question:ox}],[2,false]).score,2);
});
test('미응답·유효하지 않은 보기·문항 수 불일치를 거절한다',()=>{
 for(const a of [[],[null],[4],[-1],['2']])assert.throws(()=>gradeIssued([{question:mc}],a),e=>e.code==='invalid_answers');
 assert.throws(()=>gradeIssued([{question:ox}],[0]),e=>e.code==='invalid_answers');
});
test('원본 정답이 없는 문제를 검증 완료로 만들지 않는다',()=>{
 assert.throws(()=>gradeIssued([{question:{type:'mc',choices:mc.choices}}],[1]),e=>e.code==='verification_required');
});
test('모의고사는 전체 60%와 모든 과목 40%를 함께 확인한다',()=>{
 const items=Array.from({length:20},(_,i)=>({question:ox,subject:Math.floor(i/10),subjectName:i<10?'과목1':'과목2'}));
 const answers=[...Array(10).fill(false),...Array(2).fill(false),...Array(8).fill(true)];
 assert.equal(gradeIssuedExam(items,answers).pass,false);
 assert.equal(gradeIssuedExam(items,Array.from({length:20},(_,i)=>i%10<6?false:true)).pass,true);
});
test('최고 연속일은 중복 날짜를 제거하고 보호일을 포함한다',()=>{
 assert.equal(bestStudyStreak(['2026-11-01','2026-11-01','2026-11-03','2026-11-10'],['2026-11-02']),3);
 assert.equal(bestStudyStreak([]),0);
 assert.deepEqual(MILESTONES.map(m=>[m.days,m.gears]),[[7,30],[30,100],[100,300]]);
});
test('복습은 48시간이 아닌 한국 달력 날짜로 이틀을 확인한다',()=>{
 const due=recallDue([{topicId:'a',last:'2026-11-12T14:59:00Z'},{topicId:'b',last:'2026-11-12T15:01:00Z'}],new Date('2026-11-13T15:00:00Z'));
 assert.deepEqual(due.map(x=>x.topicId),['a']);
});
test('복습은 가장 오래된 다섯 주제를 안정된 순서로 고른다',()=>{
 const rows=Array.from({length:7},(_,i)=>({topicId:String(i),last:`2026-11-0${i+1}T00:00:00Z`}));
 assert.deepEqual(recallDue(rows.reverse(),new Date('2026-11-15T00:00:00Z')).map(x=>x.topicId),['0','1','2','3','4']);
});
test('오늘의 주제는 기존 회원·날짜 해시로 선정하고 후보 없으면 배정하지 않는다',()=>{
 assert.equal(selectDailyTopic('u','2026-11-15',[]),null);
 assert.equal(selectDailyTopic('u','2026-11-15',['a','b']),selectDailyTopic('u','2026-11-15',['a','b']));
});
test('서버 학습 시간은 일시정지를 빼고 승인 시간을 넘지 않는다',()=>{
 const base={startedAt:'2026-11-15T00:00:00Z',allowedSec:1800};
 assert.equal(studyElapsed(base,new Date('2026-11-15T01:00:00Z')),1800);
 assert.equal(studyElapsed({...base,pausedSec:30,pausedAt:'2026-11-15T00:02:00Z'},new Date('2026-11-15T00:03:00Z')),90);
 assert.equal(studyElapsed({...base,endedAt:'2026-11-15T00:01:00Z'},new Date('2026-11-15T01:00:00Z')),60);
});
