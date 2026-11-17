// 오답 보스전 (규칙 숫자는 boss-policy.mjs)
// - 문제: 내 관심 분야를 고른 사람들이 최근 60일 동안 그 분야 주제에서 많이 틀린 문제 50개 (모자라면 그 분야 문제 은행에서 채움)
// - 한 주(월~일, 한국 시간)에 한 판. 30번 맞히면 클리어, 20번 틀리면 실패. 정답은 서버만 앎
// - 보상: 클리어하면 남은 체력이 많을수록 톱니바퀴 · XP가 많고, 0.01% 확률로 전용 테마
import {randomUUID,randomInt} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {AuthError} from '../server/auth.mjs';
import {walletState} from './wallet-state.mjs';
import {weekStartKst} from './team-policy.mjs';
import {BOSS_QUESTIONS,CLEAR_HITS,BOSS_HIT,PLAYER_HP,POOL_DAYS,BOSS_THEME,BOSS_THEME_ODDS,bossReward,rollBossTheme,buildBoss,applyBossAnswer} from './boss-policy.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const json=v=>typeof v==='string'?JSON.parse(v):v;

/** 주제 t가 관심 분야(? = JSON 배열, 두 번 넣음)에 드는지: 세부 분야 id 또는 자격증 id */
const TOPIC_IN=`(JSON_CONTAINS(?,JSON_QUOTE(t.category_id)) OR EXISTS(SELECT 1 FROM certificate_subject_items ci JOIN certificate_subjects cs ON cs.id=ci.subject_id
 WHERE JSON_CONTAINS(?,JSON_QUOTE(cs.certificate_id)) AND (ci.category_id=t.category_id OR ci.topic_id=t.id)))`;

export function createBossService({auth,connectionFactory=connect,now=()=>new Date(),rand=randomInt}={}){
 async function member(header,action){
  const claims=await auth.verifyAccess(header),db=await connectionFactory();
  try{return await transaction(db,async()=>{const [[user]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[claims.sub]);if(!user||user.status!=='active'||user.auth_version!==claims.av)throw new AuthError('unauthorized',401);return action(db,user.id);});}finally{await db.end();}
 }
 const week=()=>weekStartKst(now());
 async function interests(db,id){const [[p]]=await db.execute('SELECT interests FROM profiles WHERE user_id=?',[id]);const v=p?json(p.interests):[];return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}
 /** 관심 분야가 겹치는 사람들이 많이 틀린 문제 (문제 id, 없으면 문제 글로 묶음) */
 async function hot(db,mine){
  const list=JSON.stringify(mine),since=new Date(now().getTime()-POOL_DAYS*864e5);
  const [rows]=await db.execute(`SELECT ANY_VALUE(i.question_snapshot) AS snap,ANY_VALUE(t.name_ko) AS topic,SUM(i.is_correct=0) AS wrong,COUNT(*) AS total
   FROM quiz_attempt_items i JOIN quiz_attempts a ON a.id=i.attempt_id JOIN topics t ON t.id=COALESCE(i.topic_id,a.topic_id) JOIN profiles p ON p.user_id=a.user_id
   WHERE i.is_correct IS NOT NULL AND COALESCE(i.answered_at,a.completed_at)>=? AND JSON_OVERLAPS(p.interests,?) AND ${TOPIC_IN}
   GROUP BY COALESCE(i.question_id,SHA2(JSON_UNQUOTE(JSON_EXTRACT(i.question_snapshot,'$.q')),256))
   HAVING wrong>0 ORDER BY wrong DESC,wrong/total DESC LIMIT 200`,[since,list,list,list]);
  return rows.map(r=>({snapshot:json(r.snap),topic:r.topic,wrong:Number(r.wrong)}));
 }
 /** 모자란 만큼 채울 그 분야 문제 은행 문제 */
 async function fill(db,mine){
  const list=JSON.stringify(mine);
  const [rows]=await db.execute(`SELECT d.type,d.body,d.choices,d.answer,d.explanation,t.name_ko AS topic FROM questions q JOIN question_details d ON d.question_id=q.id JOIN topics t ON t.id=q.topic_id
   WHERE q.status='published' AND d.type IN ('mc','ox') AND ${TOPIC_IN} ORDER BY RAND() LIMIT 150`,[list,list]);
  return rows.map(r=>({topic:r.topic,snapshot:{type:r.type,q:r.body,choices:r.choices==null?undefined:json(r.choices),answer:json(r.answer),explain:r.explanation}}));
 }
 async function thisWeek(db,id){const [[r]]=await db.execute('SELECT * FROM boss_runs WHERE user_id=? AND week_start=?',[id,week()]);return r??null;}
 const runView=run=>{
  const qs=json(run.questions),item=run.status==='issued'?qs[run.next_position]:null;
  return {runId:run.id,status:run.status,bossHp:Number(run.boss_hp),bossMaxHp:Number(run.boss_max_hp),playerHp:Number(run.player_hp),
   position:Number(run.next_position),total:qs.length,
   question:item?{position:Number(run.next_position),q:item.q,choices:item.choices,topic:item.topic??null,wrong:item.wrong??0}:null,
   reward:run.status==='issued'?null:{gears:Number(run.reward_gears),xp:Number(run.reward_xp),theme:Number(run.rare_drop)?BOSS_THEME:null}};
 };
 async function status(db,id){
  const start=week(),end=new Date(start+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);
  const run=await thisWeek(db,id),[[theme]]=await db.execute("SELECT 1 AS ok FROM member_cosmetics WHERE user_id=? AND item_type='skin' AND item_id=?",[id,BOSS_THEME]);
  const mine=await interests(db,id);
  return {week:{start,end:end.toISOString().slice(0,10)},interests:mine,run:run?{runId:run.id,status:run.status}:null,ownsTheme:!!theme,
   rules:{questions:BOSS_QUESTIONS,clearHits:CLEAR_HITS,playerHp:PLAYER_HP,themeOdds:BOSS_THEME_ODDS}};
 }
 /** 끝난 판 정산: 클리어면 보상 + 0.01% 테마 추첨 */
 async function settle(db,id,run,state){
  let reward={gears:0,xp:0},drop=false;
  if(state.status==='cleared'){
   reward=bossReward(state.playerHp);
   await walletState(db,id,now());
   await db.execute('UPDATE wallets SET balance=balance+? WHERE user_id=?',[reward.gears,id]);
   await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,'boss_reward',?)",[id,reward.gears,'boss:'+run.id]);
   if(rollBossTheme(rand)){
    const [res]=await db.execute("INSERT IGNORE INTO member_cosmetics(user_id,item_type,item_id,is_equipped,acquired_via) VALUES (?,'skin',?,FALSE,'boss')",[id,BOSS_THEME]);
    drop=res.affectedRows>0;
   }
  }
  await db.execute('UPDATE boss_runs SET status=?,reward_gears=?,reward_xp=?,rare_drop=?,finished_at=? WHERE id=?',[state.status,reward.gears,reward.xp,drop,now(),run.id]);
 }
 return {
  status:header=>member(header,(db,id)=>status(db,id)),
  /** 이번 주 판 시작 (같은 requestId · 이번 주에 이미 시작한 판이면 그 판을 돌려줌) */
  start:(header,body)=>member(header,async(db,id)=>{
   if(!UUID.test(body?.requestId??''))throw new AuthError('invalid_request',400);
   const old=await thisWeek(db,id);
   if(old){if(old.status!=='issued'&&old.request_id!==body.requestId)throw new AuthError('boss_week_used',409);return runView(old);}
   const mine=await interests(db,id);if(!mine.length)throw new AuthError('boss_no_interest',409);
   const questions=buildBoss(await hot(db,mine),await fill(db,mine),rand);
   if(questions.length<CLEAR_HITS)throw new AuthError('boss_not_ready',409);
   const hp=CLEAR_HITS*BOSS_HIT;
   const run={id:randomUUID(),status:'issued',boss_hp:hp,boss_max_hp:hp,player_hp:PLAYER_HP,next_position:0,questions};
   await db.execute('INSERT INTO boss_runs(id,user_id,request_id,week_start,questions,boss_hp,boss_max_hp,player_hp,started_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [run.id,id,body.requestId,week(),JSON.stringify(questions),hp,hp,PLAYER_HP,now()]);
   return runView(run);
  }),
  /** 답 하나: 같은 자리에 같은 답을 다시 보내면 같은 결과 */
  answer:(header,runId,body)=>member(header,async(db,id)=>{
   if(!UUID.test(runId)||!Number.isInteger(body?.position)||!Number.isInteger(body?.answer)||body.answer<0||body.answer>3)throw new AuthError('invalid_answer',400);
   const [[run]]=await db.execute('SELECT * FROM boss_runs WHERE id=? AND user_id=? FOR UPDATE',[runId,id]);if(!run)throw new AuthError('not_found',404);
   const [[old]]=await db.execute('SELECT submitted_answer,response_json FROM boss_answers WHERE run_id=? AND position=?',[runId,body.position]);
   if(old){if(Number(old.submitted_answer)!==body.answer)throw new AuthError('answer_conflict',409);return json(old.response_json);}
   if(run.status!=='issued')throw new AuthError('boss_finished',409);
   const qs=json(run.questions),item=qs[run.next_position];
   if(!item||Number(run.next_position)!==body.position||body.answer>=item.choices.length)throw new AuthError('invalid_position',409);
   const correct=body.answer===item.answer;
   const state=applyBossAnswer({position:Number(run.next_position),total:qs.length,bossHp:Number(run.boss_hp),playerHp:Number(run.player_hp)},correct);
   await db.execute('UPDATE boss_runs SET next_position=?,boss_hp=?,player_hp=? WHERE id=?',[state.next,state.bossHp,state.playerHp,runId]);
   if(state.status!=='issued')await settle(db,id,run,state);
   const [[fresh]]=await db.execute('SELECT * FROM boss_runs WHERE id=?',[runId]);
   const result={correct,answer:item.answer,explain:item.explain,...runView(fresh)};
   await db.execute('INSERT INTO boss_answers(run_id,position,submitted_answer,is_correct,response_json,received_at) VALUES (?,?,?,?,?,?)',[runId,body.position,body.answer,correct,JSON.stringify(result),now()]);
   return result;
  }),
  /** 진행 중인 판 다시 보기 (앱을 껐다 켰을 때) */
  run:(header,runId)=>member(header,async(db,id)=>{if(!UUID.test(runId))throw new AuthError('not_found',404);const [[run]]=await db.execute('SELECT * FROM boss_runs WHERE id=? AND user_id=?',[runId,id]);if(!run)throw new AuthError('not_found',404);return runView(run);}),
 };
}
