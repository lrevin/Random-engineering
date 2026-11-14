import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../package.json',import.meta.url))('typescript');
function load(name,deps={}){const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};new Function('exports','require',code)(exports,k=>{assert(Object.hasOwn(deps,k),k);return deps[k];});return exports;}
const clock=load('quest-time'),quests=load('quests',{'./quest-time':clock});
test('quest day and reward IDs stay in Asia/Seoul across device time zones',()=>{
 const previous=process.env.TZ;
 try{for(const zone of ['UTC','Asia/Seoul','America/New_York','Pacific/Honolulu']){process.env.TZ=zone;
  const before=new Date('2026-11-13T14:59:59Z'),after=new Date('2026-11-13T15:00:00Z');
  assert.equal(clock.questDateKey(before),'2026-11-13');assert.equal(clock.questDateKey(after),'2026-11-14');assert.equal(quests.questKey('day','attend',after),'quest:2026-11-14:attend');
  assert.equal(quests.periodStart('day',after).toISOString(),'2026-11-13T15:00:00.000Z');assert.equal(quests.periodEnd('day',after).toISOString(),'2026-11-14T15:00:00.000Z');
 }}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('Korean week/month rollover and premium period do not depend on device date',()=>{
 const week=new Date('2026-11-15T15:00:00Z'),year=new Date('2026-12-31T15:00:00Z');
 assert.equal(quests.periodKey('week',week),'w2026-11-16');assert.equal(quests.periodKey('premium',week),'p2026-11-16');assert.equal(quests.periodEnd('week',week).toISOString(),'2026-11-22T15:00:00.000Z');
 assert.equal(quests.periodKey('month',year),'m2027-01');assert.equal(quests.periodStart('month',year).toISOString(),'2026-12-31T15:00:00.000Z');assert.equal(quests.periodEnd('month',year).toISOString(),'2027-01-31T15:00:00.000Z');
 assert.equal(quests.periodEnd('month',new Date('2028-02-15T00:00:00Z')).toISOString(),'2028-02-29T15:00:00.000Z');
});
test('quest choice, progress and reset countdown match for GMT and Korea devices',()=>{
 const now=new Date('2026-11-13T18:10:00Z'),records=[{topicId:'x',score:5,total:7,studySec:600,rp:40,memo:'',level:'기초',studiedAt:'2026-11-13T15:01:00.000Z',studyType:'study'}];
 const previous=process.env.TZ;let first;
 try{for(const zone of ['UTC','Asia/Seoul','America/New_York']){process.env.TZ=zone;const result={quests:quests.questsFor('day',records,now),key:quests.questKey('day','attend',now),remaining:quests.untilEnd('day',now)};if(!first)first=result;else assert.deepEqual(result,first);}}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
 assert.equal(quests.periodEnd('day',now).getTime()-now.getTime(),(20*60+50)*60000);
});
