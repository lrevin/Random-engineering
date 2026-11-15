import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(name,deps={}){const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('exports','require',code)(exports,k=>{assert(Object.hasOwn(deps,k),k);return deps[k];});return exports;}
const clock=load('quest-time'),stats=load('stats',{'./quest-time':clock}),rank=load('rank',{'./quiz':{QUIZ_LENGTH:7}}),quests=load('quests',{'./quest-time':clock});
const at=new Date('2026-11-15T01:00:00Z'),guest={id:'g',topicId:'ds-01',domain:'cs',memo:'',score:7,total:7,rp:10,studySec:900,studiedAt:at.toISOString(),synced:false};
test('회원 미전송·미검증 기록은 개인 이력만 보존하고 게스트 계산은 유지',()=>{
 const pending={...guest,rewardStatus:'held',countsAsStudy:false};
 assert.equal(rank.domainMastery('cs',[pending]).index,-1);assert.equal(stats.studiedToday([pending],at),false);
 assert.equal(quests.questsFor('day',[pending],at).find(q=>q.id==='finish1').done,false);
 assert.equal(quests.questsFor('day',[guest],at).find(q=>q.id==='finish1').done,true);
 const stale={...guest,synced:true};assert.equal(rank.domainMastery('cs',[stale]).index,-1);
});
test('서버 용도별 자격은 과거 랭크·새 보상·학습일을 나눠 적용',()=>{
 const legacy={...guest,synced:true,eligibility:{rankEligible:true,questEligible:false,studyDayEligible:false,timeQuestEligible:false}};
 assert.equal(rank.domainMastery('cs',[legacy]).points,7);assert.equal(stats.studyDays([legacy]).size,0);
 assert.equal(quests.questsFor('day',[legacy],at).find(q=>q.id==='finish1').done,false);
 const eligible={...legacy,studyDate:'2026-11-15',eligibility:{rankEligible:true,questEligible:true,studyDayEligible:true,timeQuestEligible:false}};
 assert.equal(stats.studiedToday([eligible],at),true);
 for(let n=0;n<40;n++){const date=new Date(+at+n*86400000),r={...eligible,studiedAt:date.toISOString()};const list=quests.questsFor('day',[r],date),time=list.find(q=>q.id==='study15');if(time){assert.equal(time.done,false);assert.equal(quests.questsFor('day',[{...r,eligibility:{...r.eligibility,timeQuestEligible:true}}],date).find(q=>q.id==='study15').done,true);return;}}
 assert.fail('시간 퀘스트 검사 날짜 없음');
});

test('리포트·달력도 공통 자격을 사용하고 한국 날짜 경계가 기기 시간대에 흔들리지 않음',()=>{
 const report=load('report',{'./stats':stats,'@/data':{domainById:()=>({name:'시험 분야'})}}),old=process.env.TZ;
 const good={...guest,studiedAt:'2026-11-15T15:01:00Z',studyDate:'2026-11-16',synced:true,eligibility:{studyDayEligible:true,timeQuestEligible:true}},bad={...good,eligibility:{studyDayEligible:false,timeQuestEligible:false}};
 try{for(const zone of ['UTC','Asia/Seoul','America/New_York']){process.env.TZ=zone;
  const now=new Date('2026-11-15T16:00:00Z'),week=report.weekReport([good,bad],now);
  assert.equal(week.start.toISOString(),'2026-11-15T15:00:00.000Z');assert.equal(week.sessions,1);assert.equal(week.minutes,15);assert.deepEqual(week.perDay,[1,0,0,0,0,0,0]);
  const day=report.monthCalendar([good,bad],[],2026,10,now).cells.find(c=>c?.key==='2026-11-16');assert.equal(day.count,1);assert.equal(day.today,true);
 }}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
