import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TEAM_MIN,TEAM_MAX,TEAM_GOAL_PER_MEMBER,TEAM_REWARD,TEAM_MIN_CONTRIBUTION,teamGoal,teamProgress,canClaimTeam,pickTeam,weekStartKst} from '../mysql/team-policy.mjs';
import {BOSS_QUESTIONS,CLEAR_HITS,BOSS_HIT,PLAYER_HP,PLAYER_HIT,BOSS_THEME,BOSS_THEME_ODDS,bossReward,rollBossTheme,bossQuestion,buildBoss,applyBossAnswer} from '../mysql/boss-policy.mjs';

const mc=(q,answer=0)=>({type:'mc',q,choices:['a','b','c','d'],answer,explain:'e'});

test('팀은 2~4명, 주간 목표는 인원 × 150 XP (1명일 땐 2명 기준)',()=>{
 assert.equal(TEAM_MIN,2);assert.equal(TEAM_MAX,4);
 assert.equal(teamGoal(1),2*TEAM_GOAL_PER_MEMBER);assert.equal(teamGoal(3),3*TEAM_GOAL_PER_MEMBER);
 const solo=teamProgress([{weekXp:999}]);assert.equal(solo.active,false);assert.equal(solo.done,false);
 const p=teamProgress([{weekXp:200},{weekXp:100}]);assert.deepEqual(p,{count:2,total:300,goal:300,active:true,done:true});
 assert.equal(teamProgress([{weekXp:200},{weekXp:99}]).done,false);
});
test('보상은 목표 달성 · 들어온 뒤 XP 50 이상 · 아직 안 받은 팀원만',()=>{
 assert.equal(TEAM_MIN_CONTRIBUTION,50);
 const done=teamProgress([{weekXp:300},{weekXp:0}]);
 assert.equal(canClaimTeam(done,{weekXp:300},false),true);
 assert.equal(canClaimTeam(done,{weekXp:0},false),false);
 assert.equal(canClaimTeam(done,{weekXp:49},false),false);assert.equal(canClaimTeam(done,{weekXp:50},false),true);
 assert.equal(canClaimTeam(done,{weekXp:300},true),false);
 assert.ok(TEAM_REWARD.gears<=100&&TEAM_REWARD.xp<=200);
});
test('빈자리 채우기: 우리 인원이 다 들어가는 팀만, 없으면 새 팀',()=>{
 const open=[{id:'a',member_count:3},{id:'b',member_count:2},{id:'c',member_count:1}];
 assert.equal(pickTeam(open,2,n=>n-1).id,'c');assert.equal(pickTeam(open,2,()=>0).id,'b');
 assert.equal(pickTeam(open,4,()=>0),null);assert.equal(pickTeam([{id:'x',member_count:TEAM_MAX}],1,()=>0),null);
});
test('주 시작은 한국 시간 월요일',()=>{
 assert.equal(weekStartKst(new Date('2026-11-15T15:00:00Z')),'2026-11-16');
 assert.equal(weekStartKst(new Date('2026-11-15T14:59:59Z')),'2026-11-09');
 assert.equal(weekStartKst(new Date('2026-11-22T14:00:00Z')),'2026-11-16');
});

test('보스: 50문제 · 30번 맞히면 클리어 · 20번 틀리면 실패',()=>{
 assert.equal(BOSS_QUESTIONS,50);assert.equal(CLEAR_HITS*BOSS_HIT,300);assert.equal(PLAYER_HP/PLAYER_HIT,20);
 let run={position:0,total:50,bossHp:300,playerHp:100};
 for(let i=0;i<29;i++){const s=applyBossAnswer(run,true);run={...run,position:s.next,bossHp:s.bossHp};assert.equal(s.status,'issued');}
 assert.equal(applyBossAnswer(run,true).status,'cleared');
 run={position:0,total:50,bossHp:300,playerHp:100};
 for(let i=0;i<19;i++){const s=applyBossAnswer(run,false);run={...run,position:s.next,playerHp:s.playerHp};assert.equal(s.status,'issued');}
 assert.equal(applyBossAnswer(run,false).status,'failed');
 assert.equal(applyBossAnswer({position:29,total:30,bossHp:100,playerHp:50},true).status,'failed');
});
test('보스 문제: 많이 틀린 문제 먼저, 같은 문제는 한 번, 모자라면 문제 은행으로 50개까지',()=>{
 const hot=[{snapshot:mc('A'),topic:'T',wrong:9},{snapshot:mc('A'),wrong:3},{snapshot:{type:'short',q:'S'},wrong:5},{snapshot:mc('B'),wrong:2}];
 const fill=Array.from({length:80},(_,i)=>({snapshot:i%2?mc('F'+i):{type:'ox',q:'O'+i,answer:true}}));
 const list=buildBoss(hot,fill,()=>0);
 assert.equal(list.length,BOSS_QUESTIONS);assert.equal(new Set(list.map(q=>q.q)).size,BOSS_QUESTIONS);
 assert.equal(list.find(q=>q.q==='A').wrong,9);assert.ok(list.some(q=>q.q==='B'));assert.ok(!list.some(q=>q.q==='S'));
 assert.equal(list.filter(q=>q.wrong===0).length,48);
 assert.deepEqual(bossQuestion({type:'ox',q:'x',answer:false}).choices.length,2);
 assert.equal(bossQuestion({type:'mc',q:'x',choices:['a','b'],answer:0}),null);
});
test('클리어 보상: 남은 체력이 많을수록 큼, 0.01% 전용 테마',()=>{
 assert.deepEqual(bossReward(100),{gears:100,xp:200});assert.deepEqual(bossReward(50),{gears:70,xp:140});assert.deepEqual(bossReward(0),{gears:0,xp:0});
 assert.ok(bossReward(5).gears<bossReward(10).gears);
 assert.equal(BOSS_THEME,'eclipse');assert.equal(BOSS_THEME_ODDS,10000);
 let asked=0;assert.equal(rollBossTheme(n=>{asked=n;return 0;}),true);assert.equal(asked,10000);assert.equal(rollBossTheme(()=>1),false);
});

test('앱 규칙 숫자가 서버와 같음',()=>{
 const team=readFileSync(new URL('../../app/src/lib/team.ts',import.meta.url),'utf8'),boss=readFileSync(new URL('../../app/src/lib/boss.ts',import.meta.url),'utf8');
 const num=(src,k)=>Number(new RegExp(`export const ${k} = (\\d+);`).exec(src)?.[1]);
 assert.equal(num(team,'TEAM_MIN'),TEAM_MIN);assert.equal(num(team,'TEAM_MAX'),TEAM_MAX);assert.equal(num(team,'TEAM_GOAL_PER_MEMBER'),TEAM_GOAL_PER_MEMBER);assert.equal(num(team,'TEAM_MIN_CONTRIBUTION'),TEAM_MIN_CONTRIBUTION);
 assert.match(team,new RegExp(`TEAM_REWARD = \\{ gears: ${TEAM_REWARD.gears}, xp: ${TEAM_REWARD.xp} \\}`));
 for(const [k,v] of Object.entries({BOSS_QUESTIONS,CLEAR_HITS,BOSS_HIT,PLAYER_HP,PLAYER_HIT,BOSS_THEME_ODDS}))assert.equal(num(boss,k),v,k);
 assert.match(boss,new RegExp(`BOSS_THEME = "${BOSS_THEME}"`));
 const migration=readFileSync(new URL('../mysql/migrations/V9__study_teams.sql',import.meta.url),'utf8');
 assert.match(migration,/UNIQUE KEY boss_week\(user_id,week_start\)/);assert.match(migration,/'boss'\)\);/);
});
