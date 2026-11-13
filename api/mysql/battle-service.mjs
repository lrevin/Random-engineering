import {randomUUID,randomBytes,randomInt} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {AuthError} from '../server/auth.mjs';
import {hash} from '../shared/question-store.mjs';
import {walletState} from './wallet-state.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const json=v=>typeof v==='string'?JSON.parse(v):v;
const date=v=>new Date(v instanceof Date?v:v.includes('T')?v:v.replace(' ','T')+'Z');
const own=(o,k)=>Object.hasOwn(o,k);
const kday=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const players=b=>[b.from.id,b.to.id];
const score=(b,id)=>b.questions.slice(0,5).filter((q,i)=>own(b.answers[id],i)&&b.answers[id][i]===q.answer).length;
const answered=(b,id)=>Object.keys(b.answers[id]).length;
const right=(q,value)=>value!==null&&value!==undefined&&q.answer===value;

export function createBattleService({auth,connectionFactory=connect,now=()=>new Date(),studySec=600,quizSec=300,startDelaySec=8,roundSec=45,maxGapMs=30000}={}){
 async function totalXp(db,id){const [[r]]=await db.execute('SELECT (SELECT COALESCE(SUM(amount),0) FROM xp_ledger WHERE user_id=?)+(SELECT COALESCE(SUM(awarded_xp),0) FROM speed_runs WHERE user_id=?) AS xp',[id,id]);return Math.max(0,Number(r.xp));}
 async function person(db,id){
  const [[old]]=await db.execute('SELECT friend_code FROM social_members WHERE user_id=?',[id]);
  if(!old){for(let n=0;n<8;n++){try{const code=Array.from(randomBytes(8),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');await db.execute('INSERT INTO social_members(user_id,friend_code) VALUES (?,?)',[id,code]);break;}catch(e){if(e.code!=='ER_DUP_ENTRY'||n===7)throw e;}}}
  const [[r]]=await db.execute('SELECT m.friend_code,p.nickname FROM social_members m LEFT JOIN profiles p ON p.user_id=m.user_id WHERE m.user_id=?',[id]);
  return {id,uid:r.friend_code,nickname:r.nickname??'학습자',xpAtStart:await totalXp(db,id)};
 }
 async function ticket(db,entry,refund=false){
  const key=(refund?'match-refund:':'match-reserve:')+entry.id;
  const [[done]]=await db.execute('SELECT id FROM wallet_operations WHERE user_id=? AND request_id=?',[entry.user_id,key]);if(done)return;
  const value=await walletState(db,entry.user_id,now()),s=value.state;
  if(refund){if(entry.ticket_kind==='bought')s.boughtTickets++;else if(entry.ticket_kind==='free'&&entry.ticket_month===s.month)s.freeTickets=Math.min(2,s.freeTickets+1);}
  else{
   entry.ticket_kind=s.premium?'premium':s.freeTickets>0?'free':s.boughtTickets>0?'bought':null;
   if(!entry.ticket_kind)throw new AuthError('no_tickets',409);
   entry.ticket_month=s.month;if(entry.ticket_kind==='free')s.freeTickets--;if(entry.ticket_kind==='bought')s.boughtTickets--;
  }
  const payload={entryId:entry.id,kind:entry.ticket_kind,month:entry.ticket_month},action=refund?'match_refund':'match_reserve';
  await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',[entry.user_id,key,Buffer.from(hash({action,payload}),'hex'),action,JSON.stringify(payload),JSON.stringify({balance:value.balance,state:s})]);
 }
 async function eligible(db,id){
  const [[p]]=await db.execute('SELECT interests FROM profiles WHERE user_id=?',[id]);if(!p)return [];
  const interests=json(p.interests);if(!Array.isArray(interests)||!interests.length)return [];
  const [rows]=await db.execute(`SELECT t.id FROM topics t JOIN categories c ON c.id=t.category_id JOIN domains d ON d.id=c.domain_id
   WHERE t.is_active=1 AND c.is_active=1 AND d.is_active=1 AND
   (JSON_CONTAINS(?,JSON_QUOTE(c.id)) OR EXISTS(SELECT 1 FROM certificate_subject_items i JOIN certificate_subjects s ON s.id=i.subject_id JOIN certificates cert ON cert.id=s.certificate_id
     WHERE cert.is_active=1 AND JSON_CONTAINS(?,JSON_QUOTE(cert.id)) AND (i.category_id=c.id OR i.topic_id=t.id)))
   AND (SELECT COUNT(*) FROM questions q WHERE q.topic_id=t.id AND q.source='bank' AND q.status='published'
    AND EXISTS(SELECT 1 FROM question_file_items qi JOIN question_files f ON f.id=qi.file_id WHERE qi.question_id=q.id AND f.status='published'))>=10 ORDER BY t.id`,[JSON.stringify(interests),JSON.stringify(interests)]);
  return rows.map(r=>r.id);
 }
 async function questions(db,topicId){
  const [rows]=await db.execute(`SELECT q.id,d.type,d.body,d.choices,d.answer,d.explanation FROM questions q JOIN question_details d ON d.question_id=q.id
   WHERE q.topic_id=? AND q.source='bank' AND q.status='published' AND EXISTS(SELECT 1 FROM question_file_items i JOIN question_files f ON f.id=i.file_id WHERE i.question_id=q.id AND f.status='published') ORDER BY RAND() LIMIT 10`,[topicId]);
  return rows.map(r=>{const q={questionId:r.id,type:r.type,q:r.body,answer:json(r.answer),explain:r.explanation,src:'bank'};if(r.type==='mc'){const cs=json(r.choices),order=[0,1,2,3];for(let i=3;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}q.choices=order.map(i=>cs[i]);q.answer=order.indexOf(q.answer);}return q;});
 }
 async function save(db,b){b.revision=(b.revision??0)+1;await db.execute('UPDATE battles SET status=?,state_json=?,finished_at=? WHERE id=?',[b.status,JSON.stringify(b),b.status==='accepted'?null:now(),b.id]);}
 async function queueEnd(db,e,status,refund){if(refund)await ticket(db,e,true);await db.execute('UPDATE match_entries SET status=? WHERE id=?',[status,e.id]);}
 async function writeRecord(db,b,id,delta,forfeiter){
  const [[old]]=await db.execute('SELECT id FROM study_records WHERE battle_id=? AND user_id=?',[b.id,id]);if(old)return old.id;
  const [[t]]=await db.execute('SELECT t.*,c.domain_id FROM topics t JOIN categories c ON c.id=t.category_id WHERE t.id=?',[b.topicId]);
  const [[state]]=await db.execute('SELECT last_change_seq FROM user_sync_states WHERE user_id=? FOR UPDATE',[id]);if(!state)throw new Error('missing_sync_state');
  const seq=(BigInt(state.last_change_seq)+1n).toString(),recordId=randomUUID(),attempt=randomUUID(),at=now();
  const count=5+b.rounds.length,base=score(b,id),isStudy=id!==forfeiter&&answered(b,id)>0;
  let totalCorrect=base;
  const details={parts:[{label:'배틀 XP 정산',value:delta}],streak:0,battleId:b.id,baseScore:base,reason:b.reason};
  await db.execute('UPDATE user_sync_states SET last_change_seq=? WHERE user_id=?',[seq,id]);
  await db.execute("INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,completed_at) VALUES (?,?,?,'completed','server_verified',?,?)",[attempt,id,b.topicId,date(b.startAt),at]);
  for(let i=0;i<count;i++){
   const q=b.questions[i],value=i<5?(b.answers[id][i]??null):(b.rounds[i-5].answers[id]??null),correct=right(q,value);
   if(i>=5&&correct)totalCorrect++;
   const {questionId,...snapshot}=q;
   await db.execute('INSERT INTO quiz_attempt_items(attempt_id,position,question_id,question_snapshot,submitted_answer,is_correct,answered_at) VALUES (?,?,?,?,?,?,?)',[attempt,i+1,questionId,JSON.stringify({...snapshot,stage:i<5?'main':'overtime',topicId:b.topicId}),value===null?null:JSON.stringify(value),correct,at]);
  }
  const opponent=b.from.id===id?b.to:b.from;
  await db.execute(`INSERT INTO study_records(id,user_id,attempt_id,topic_id,topic_ko,domain,category,difficulty,memo,score,quiz_total,rp,study_sec,studied_at,study_date,time_validation_status,submission_hash,change_seq,received_at,study_type,battle_id,rank_score)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'battle',?,?)`,[recordId,id,attempt,b.topicId,t.name_ko,t.domain_id,t.category_id,t.difficulty,opponent.nickname+'님과 배틀',totalCorrect,count,delta,Math.min(b.studySec,Math.max(0,Math.floor((Math.min(at.getTime(),Date.parse(b.quizStartAt))-Date.parse(b.startAt))/1000))),at,isStudy?kday(at):null,'accepted',Buffer.from(hash({battleId:b.id,id}),'hex'),seq,at,b.id,isStudy?base:0]);
  await db.execute("INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,rule_version,verification_status,calculation_details,idempotency_key,source_type) VALUES (?,?,?,?,'award',?,'battle-v1','server_verified',?,?,'battle')",[randomUUID(),id,recordId,b.topicId,delta,JSON.stringify(details),'battle:'+b.id+':'+id]);
  return recordId;
 }
 async function finish(db,b,winner,reason,forfeiter=null){
  if(b.status!=='accepted')return;
  b.status='finished';b.reason=reason;b.finishedAt=now().toISOString();b.outcome={winner:winner?(b.from.id===winner?b.from.uid:b.to.uid):null,xp:0};b.records={};
  if(winner){const loser=b.from.id===winner?b.to:b.from;const current=await totalXp(db,loser.id);b.outcome.xp=Math.min(100,Math.floor(loser.xpAtStart*.05),current);}
  for(const id of players(b))b.records[id]=await writeRecord(db,b,id,winner?(winner===id?b.outcome.xp:-b.outcome.xp):0,forfeiter);
  await db.execute("UPDATE match_entries SET status='completed' WHERE battle_id=? AND status='matched'",[b.id]);await save(db,b);
 }
 async function invalidate(db,b,reason,users){
  if(b.status!=='accepted')return;b.status='void';b.reason=reason;b.finishedAt=now().toISOString();b.outcome={winner:null,xp:0};
  const [entries]=await db.execute("SELECT * FROM match_entries WHERE battle_id=? AND status='matched'",[b.id]);
  for(const e of entries){if(users.has(e.user_id))await ticket(db,e,true);await queueEnd(db,e,'invalid',false);}await save(db,b);
 }
 async function settle(db,b,users){
  const time=now().getTime();if(b.status!=='accepted')return;
  if(players(b).some(id=>users.get(id)?.status!=='active'))return invalidate(db,b,'account_unavailable',users);
  if(!Array.isArray(b.questions)||b.questions.length!==10)return invalidate(db,b,'questions_unavailable',users);
  if(time>Date.parse(b.quizStartAt)&&time-b.lastTick>maxGapMs)return invalidate(db,b,'server_interruption',users);
  b.lastTick=time;
  if(!b.mainClosed&&(time>=Date.parse(b.quizEndAt)||players(b).every(id=>b.submitted[id]))){
   b.mainClosed=true;
   const [a,c]=players(b),sa=score(b,a),sc=score(b,c);
   if(!answered(b,a)&&!answered(b,c))return finish(db,b,null,'no_submissions');
   if(!answered(b,a)||!answered(b,c)){const absent=!answered(b,a)?a:c;return finish(db,b,absent===a?c:a,'absence',absent);}
   if(sa!==sc)return finish(db,b,sa>sc?a:c,'score');
   b.rounds.push({startAt:new Date(time+3000).toISOString(),answers:{}});
  }
  if(b.mainClosed&&b.status==='accepted'){
   // Advance expired rounds using their persisted deadlines; reconnecting never extends the clock.
   while(b.rounds.length){
    const r=b.rounds.at(-1),index=b.rounds.length-1,end=Date.parse(r.startAt)+roundSec*1000;
    if(!players(b).every(id=>own(r.answers,id))&&time<end)break;
    const [a,c]=players(b),q=b.questions[5+index],ra=right(q,r.answers[a]),rc=right(q,r.answers[c]);r.closed=true;
    if(ra!==rc)return finish(db,b,ra?a:c,'overtime');
    if(b.rounds.length===5)return finish(db,b,null,'draw');
    r.answers[a]??=null;r.answers[c]??=null;
    b.rounds.push({startAt:new Date((time>=end?end:time)+3000).toISOString(),answers:{}});
   }
  }
  await save(db,b);
 }
 async function locked(header,action){
  const claims=header===null?null:await auth.verifyAccess(header),db=await connectionFactory();let acquired=false;
  try{
   const [[lock]]=await db.query("SELECT GET_LOCK(SHA2(CONCAT(DATABASE(),':battle_lifecycle'),256),10) AS ok");if(Number(lock.ok)!==1)throw new AuthError('busy_retry',503);acquired=true;
   await db.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
   return await transaction(db,async()=>{
    const [active]=await db.execute("SELECT state_json FROM battles WHERE status='accepted'");const battles=active.map(r=>json(r.state_json));
    const [waiting]=await db.execute("SELECT * FROM match_entries WHERE status='waiting'");
    const ids=[...new Set([...(claims?[claims.sub]:[]),...waiting.map(e=>e.user_id),...battles.flatMap(players)])].sort(),users=new Map();
    for(const id of ids){const [[u]]=await db.execute('SELECT id,status,auth_version FROM users WHERE id=? FOR UPDATE',[id]);if(u)users.set(id,u);}
    if(claims){const u=users.get(claims.sub);if(!u||u.status!=='active'||u.auth_version!==claims.av)throw new AuthError('unauthorized',401);}
    for(const e of waiting){if(date(e.expires_at)<=now()||users.get(e.user_id)?.status!=='active'){if(users.has(e.user_id))await queueEnd(db,e,'expired',true);}}
    for(const b of battles)await settle(db,b,users);
    return action(db,claims?.sub,users);
   });
  }finally{if(acquired)await db.query("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(),':battle_lifecycle'),256))").catch(()=>{});await db.end();}
 }
 function view(b,id){
  const time=now().getTime(),mine=b.from.id===id?b.from:b.to,other=b.from.id===id?b.to:b.from;
  const publicQ=(q,reveal)=>{const {questionId,...s}=q;return reveal?s:{...s,answer:q.type==='mc'?-1:false,explain:''};};
  const finished=b.status!=='accepted',round=b.rounds?.at(-1),quiz=time>=Date.parse(b.quizStartAt);
  const phase=finished?b.status:time<Date.parse(b.startAt)?'countdown':!quiz?'study':b.mainClosed?'overtime':b.submitted[id]?'submitted':'quiz';
  const results={};for(const p of [b.from,b.to])if(finished||b.mainClosed||b.submitted[p.id])results[p.uid]={score:score(b,p.id),total:5,submittedAt:b.submitted[p.id]??null};
  return {id:b.id,revision:b.revision??0,studySkip:{count:players(b).filter(p=>b.studySkipVotes?.[p]===true).length,required:2,myAgreed:b.studySkipVotes?.[id]===true},kind:'random',status:b.status,phase,from:{uid:b.from.uid,nickname:b.from.nickname},to:{uid:b.to.uid,nickname:b.to.nickname},domain:b.domain,
   topicId:time>=Date.parse(b.startAt)||finished?b.topicId:null,studySec:b.studySec,quizSec:b.quizSec,quizCount:5,createdAt:b.createdAt,startAt:b.startAt,quizStartAt:b.quizStartAt,quizEndAt:b.quizEndAt,
   questions:quiz||finished?b.questions.slice(0,5).map(q=>publicQ(q,finished)):null,questionsReady:true,myAnswers:Array.from({length:5},(_,i)=>b.answers[id][i]??null),mySubmitted:!!b.submitted[id],
   overtime:round?{round:b.rounds.length-1,question:time>=Date.parse(round.startAt)?publicQ(b.questions[4+b.rounds.length],finished):null,roundStartAt:round.startAt,roundSec,available:5,batches:0,
    mySubmitted:own(round.answers,id),myAnswer:round.answers[id]??null,past:b.rounds.filter(r=>r.closed).map((r,i)=>publicQ(b.questions[5+i],true))}:null,
   results,outcome:b.outcome??null,reason:b.reason??null,recordId:b.records?.[id]??null,opponent:other.uid,serverNow:now().toISOString()};
 }
 async function current(db,id){const [[r]]=await db.execute("SELECT state_json FROM battles WHERE (user_a=? OR user_b=?) AND status='accepted' ORDER BY created_at LIMIT 1",[id,id]);return r?json(r.state_json):null;}
 async function matchView(db,e,id){if(e.status==='matched'){const [[r]]=await db.execute('SELECT state_json FROM battles WHERE id=?',[e.battle_id]);if(r){const b=json(r.state_json);if(b.status==='accepted')return {status:'matched',battle:view(b,id)};}}return e.status==='waiting'?{status:'waiting',id:e.id,joinedAt:date(e.joined_at).toISOString(),expiresAt:date(e.expires_at).toISOString()}:{status:'none'};}
 async function findBattle(db,id,battleId){if(!UUID.test(battleId??''))throw new AuthError('not_found',404);const [[r]]=await db.execute('SELECT state_json FROM battles WHERE id=? AND (user_a=? OR user_b=?)',[battleId,id,id]);if(!r)throw new AuthError('not_found',404);return json(r.state_json);}
 return {
  sweep:()=>locked(null,async()=>{}),
  join:(header,body)=>locked(header,async(db,id)=>{
   if(!UUID.test(body?.requestId??''))throw new AuthError('invalid_request',400);
   const [[prior]]=await db.execute('SELECT * FROM match_entries WHERE user_id=? AND request_id=?',[id,body.requestId]);if(prior)return matchView(db,prior,id);
   const active=await current(db,id);if(active)return {status:'matched',battle:view(active,id)};
   const [[existing]]=await db.execute("SELECT * FROM match_entries WHERE user_id=? AND status='waiting'",[id]);if(existing)return matchView(db,existing,id);
   const candidates=await eligible(db,id);if(!candidates.length)throw new AuthError('no_match_topics',409);
   const entry={id:randomUUID(),user_id:id,request_id:body.requestId,candidates,status:'waiting',joined_at:now(),last_seen_at:now(),expires_at:new Date(now().getTime()+180000)};
   await ticket(db,entry);
   await db.execute('INSERT INTO match_entries(id,user_id,request_id,candidates,ticket_kind,ticket_month,joined_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)',[entry.id,id,entry.request_id,JSON.stringify(candidates),entry.ticket_kind,entry.ticket_month,entry.joined_at,entry.last_seen_at,entry.expires_at]);
   const [waiting]=await db.execute("SELECT * FROM match_entries WHERE status='waiting' AND user_id<>? AND last_seen_at>=? ORDER BY joined_at,id",[id,new Date(now().getTime()-15000)]);
   for(const other of waiting){
    const valid=await eligible(db,other.user_id),common=valid.filter(t=>candidates.includes(t));if(!valid.length){await queueEnd(db,other,'invalid',true);continue;}if(!common.length)continue;
    const topicId=common[randomInt(common.length)],qs=await questions(db,topicId);if(qs.length!==10)continue;
    const [[t]]=await db.execute('SELECT c.domain_id FROM topics t JOIN categories c ON c.id=t.category_id WHERE t.id=?',[topicId]);
    const at=now().getTime(),startAt=new Date(at+startDelaySec*1000).toISOString(),quizStartAt=new Date(at+(startDelaySec+studySec)*1000).toISOString();
    const from=await person(db,other.user_id),to=await person(db,id),b={id:randomUUID(),from,to,domain:t.domain_id,topicId,questions:qs,status:'accepted',studySec,quizSec,createdAt:now().toISOString(),startAt,quizStartAt,quizEndAt:new Date(Date.parse(quizStartAt)+quizSec*1000).toISOString(),answers:{[from.id]:{},[to.id]:{}},submitted:{},rounds:[],mainClosed:false,lastTick:at};
    await db.execute('INSERT INTO battles(id,user_a,user_b,topic_id,state_json) VALUES (?,?,?,?,?)',[b.id,from.id,to.id,topicId,JSON.stringify(b)]);
    await db.execute("UPDATE match_entries SET status='matched',battle_id=? WHERE id IN (?,?)",[b.id,other.id,entry.id]);return {status:'matched',battle:view(b,id)};
   }
   return matchView(db,entry,id);
  }),
  match:header=>locked(header,async(db,id)=>{const b=await current(db,id);if(b)return {status:'matched',battle:view(b,id)};const [[e]]=await db.execute("SELECT * FROM match_entries WHERE user_id=? AND status='waiting'",[id]);if(!e)return {status:'none'};await db.execute('UPDATE match_entries SET last_seen_at=? WHERE id=?',[now(),e.id]);return matchView(db,e,id);}),
  leave:(header,body)=>locked(header,async(db,id)=>{if(!UUID.test(body?.entryId??''))throw new AuthError('invalid_request',400);const [[e]]=await db.execute('SELECT * FROM match_entries WHERE id=? AND user_id=?',[body.entryId,id]);if(!e)throw new AuthError('not_found',404);if(e.status==='matched')return matchView(db,e,id);if(e.status==='waiting')await queueEnd(db,e,'canceled',true);return {status:'none'};}),
  inbox:header=>locked(header,async(db,id)=>{const b=await current(db,id);return {incoming:[],current:b?view(b,id):null};}),
  history:header=>locked(header,async(db,id)=>{const [rows]=await db.execute("SELECT state_json FROM battles WHERE (user_a=? OR user_b=?) AND status<>'accepted' ORDER BY created_at DESC,id DESC LIMIT 50",[id,id]);return {battles:rows.map(r=>view(json(r.state_json),id))};}),
  get:(header,battleId)=>locked(header,async(db,id)=>view(await findBattle(db,id,battleId),id)),
  studySkip:(header,battleId,body)=>locked(header,async(db,id)=>{
   const b=await findBattle(db,id,battleId);
   if(typeof body?.agree!=='boolean')throw new AuthError('invalid_request',400);
   // Explicit desired state makes retries safe. A started quiz never returns to study.
   if(b.status!=='accepted'||now()>=date(b.quizStartAt))return view(b,id);
   if(now()<date(b.startAt))throw new AuthError('not_studying',409);
   b.studySkipVotes??={};b.studySkipVotes[id]=body.agree;
   if(players(b).every(p=>b.studySkipVotes[p]===true)){
    b.studySkippedAt=now().toISOString();b.quizStartAt=b.studySkippedAt;
    b.quizEndAt=new Date(now().getTime()+b.quizSec*1000).toISOString();
    b.lastTick=now().getTime();
   }
   await save(db,b);return view(b,id);
  }),
  answer:(header,battleId,body)=>locked(header,async(db,id)=>{
   const b=await findBattle(db,id,battleId),p=body?.position;
   if(!Number.isInteger(p)||p<1||p>5)throw new AuthError('invalid_answer',400);
   const q=b.questions[p-1],a=body.answer;if(q.type==='mc'?!Number.isInteger(a)||a<0||a>3:typeof a!=='boolean')throw new AuthError('invalid_answer',400);
   if(own(b.answers[id],p-1)){if(b.answers[id][p-1]!==a)throw new AuthError('answer_conflict',409);return view(b,id);}
   if(b.status!=='accepted'||b.mainClosed||b.submitted[id]||now()<date(b.quizStartAt)||now()>=date(b.quizEndAt))throw new AuthError('not_answering',409);
   if(p!==answered(b,id)+1)throw new AuthError('invalid_position',409);
   b.answers[id][p-1]=a;if(answered(b,id)===5)b.submitted[id]=now().toISOString();await settle(db,b,new Map(players(b).map(x=>[x,{status:'active'}])));return view(b,id);
  }),
  submit:(header,battleId)=>locked(header,async(db,id)=>{const b=await findBattle(db,id,battleId);if(b.status!=='accepted'||b.mainClosed||b.submitted[id])return view(b,id);if(now()<date(b.quizStartAt))throw new AuthError('too_early',409);b.submitted[id]=now().toISOString();await settle(db,b,new Map(players(b).map(x=>[x,{status:'active'}])));return view(b,id);}),
  overtime:(header,battleId,body)=>locked(header,async(db,id)=>{
   const b=await findBattle(db,id,battleId),index=body?.round;
   if(!Number.isInteger(index)||index<0||index>=5||index>=b.rounds.length)throw new AuthError('invalid_round',400);
   const r=b.rounds[index],q=b.questions[5+index],a=body.answer;
   if(q.type==='mc'?!Number.isInteger(a)||a<0||a>3:typeof a!=='boolean')throw new AuthError('invalid_answer',400);
   if(own(r.answers,id)){if(r.answers[id]!==a)throw new AuthError('answer_conflict',409);return view(b,id);}
   if(b.status!=='accepted'||index!==b.rounds.length-1||r.closed||now()<date(r.startAt)||now()>=new Date(Date.parse(r.startAt)+roundSec*1000))throw new AuthError('not_answering',409);
   r.answers[id]=a;await settle(db,b,new Map(players(b).map(x=>[x,{status:'active'}])));return view(b,id);
  }),
  forfeit:(header,battleId)=>locked(header,async(db,id)=>{const b=await findBattle(db,id,battleId);if(b.status==='accepted')await finish(db,b,players(b).find(x=>x!==id),'forfeit',id);return view(b,id);}),
 };
}
