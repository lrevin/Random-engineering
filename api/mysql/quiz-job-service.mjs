// EC2가 실행하는 영속 큐. 요청은 최대 1개, 대기 포함 10분. 응답 유실 후 무조건 재생성하지 않는다.
import {randomUUID,createHash} from 'node:crypto';
import {connect,transaction} from '../server/db.mjs';
import {validateAiResponse,saveAiQuestions} from './ai-question-store.mjs';
import {instant} from './purchase-policy.mjs';
export const JOB_DEADLINE_MS=600000,LEASE_MS=90000;
export function llmSettings(env=process.env){
 const url=env.QUIZ_SERVER_URL||'http://127.0.0.1:18788',token=env.QUIZ_SERVER_TOKEN||'';
 const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error('invalid_llm_url');
 return {url:url.replace(/\/+$/,''),token,enabled:!!token};
}
export async function enqueueQuizJob(db,topicId,now=new Date(),{enabled=llmSettings().enabled}={}){
 // 학습 등록과 동일한 트랜잭션. 모든 쓰기는 주제 → 작업 순서로 잠근다.
 await db.execute('SELECT id FROM topics WHERE id=? FOR UPDATE',[topicId]);
 const [[old]]=await db.execute("SELECT * FROM quiz_jobs WHERE topic_id=? AND status IN ('queued','running') FOR UPDATE",[topicId]);
 if(old&&instant(old.deadline_at)>now)return old.id;
 if(old)await db.execute("UPDATE quiz_jobs SET status='failed',finished_at=?,result_summary=JSON_OBJECT('reason','deadline_expired') WHERE id=?",[now,old.id]);
 const id=randomUUID();
 await db.execute('INSERT INTO quiz_jobs(id,topic_id,status,available_at,deadline_at,request_spec,created_at,finished_at,result_summary) VALUES (?,?,?,?,?,?,?,?,?)',[id,topicId,enabled?'queued':'failed',now,new Date(+now+JOB_DEADLINE_MS),JSON.stringify({version:'llm-v1',topicId,count:4}),now,enabled?null:now,enabled?null:JSON.stringify({reason:'not_configured',questionIds:[]})]);return id;
}
const safeRetry=e=>['ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','ENOTFOUND','EAI_AGAIN'].includes(e?.cause?.code??e?.code);
export async function readLimitedJson(response,limit=131072){
 if(Number(response.headers.get('content-length')||0)>limit)throw Error('response_too_large');
 if(!response.body)throw Error('invalid_response');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('response_too_large');chunks.push(Buffer.from(value));}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function createQuizJobWorker({connectionFactory=connect,settings=llmSettings(),fetcher=fetch,now=()=>new Date(),workerId=randomUUID(),intervalMs=1000}={}){
 let busy=false,stopped=false,timer=null,controller=null;
 const connection=async action=>{const db=await connectionFactory();try{return await action(db);}finally{await db.end();}};
 async function claim(){return connection(async db=>{
  const [[lock]]=await db.query("SELECT GET_LOCK(SHA2(CONCAT(DATABASE(),':llm_claim'),256),0) AS ok");if(Number(lock.ok)!==1)return null;
  try{const at=now();
   // 회수 UPDATE는 자동 커밋으로 끝내 작업 잠금을 든 채 다른 주제 잠금을 기다리지 않는다.
   await db.execute("UPDATE quiz_jobs SET status='failed',finished_at=?,result_summary=JSON_OBJECT('reason','interrupted_or_expired') WHERE status IN ('queued','running') AND (deadline_at<=? OR (status='running' AND lease_expires_at<=?))",[at,at,at]);
   return await transaction(db,async()=>{
   const [[running]]=await db.execute("SELECT id FROM quiz_jobs WHERE status='running' LIMIT 1");if(running)return null;
   const [[candidate]]=await db.execute("SELECT id,topic_id FROM quiz_jobs WHERE status='queued' AND available_at<=? ORDER BY created_at,id LIMIT 1",[at]);if(!candidate)return null;
   await db.execute('SELECT id FROM topics WHERE id=? FOR UPDATE',[candidate.topic_id]);
   const [[job]]=await db.execute("SELECT * FROM quiz_jobs WHERE id=? AND status='queued' FOR UPDATE",[candidate.id]);if(!job)return null;
   const token=randomUUID();await db.execute("UPDATE quiz_jobs SET status='running',worker_id=?,lease_token=?,lease_expires_at=?,attempt_count=attempt_count+1,started_at=COALESCE(started_at,?) WHERE id=?",[workerId,token,new Date(Math.min(+at+LEASE_MS,+instant(job.deadline_at))),at,job.id]);
   return {...job,lease_token:token,attempt_count:Number(job.attempt_count)+1};
  });}finally{await db.query("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(),':llm_claim'),256))");}
 });}
 async function finish(job,data,error){return connection(db=>transaction(db,async()=>{
  await db.execute('SELECT id FROM topics WHERE id=? FOR UPDATE',[job.topic_id]);
  const [[current]]=await db.execute('SELECT * FROM quiz_jobs WHERE id=? FOR UPDATE',[job.id]);const at=now();
  if(current?.status!=='running'||current.lease_token!==job.lease_token||instant(current.lease_expires_at)<=at||instant(current.deadline_at)<=at)return false;
  if(error){const retry=!stopped&&safeRetry(error)&&job.attempt_count<2&&+at+5000<+instant(job.deadline_at);
   await db.execute('UPDATE quiz_jobs SET status=?,available_at=?,finished_at=?,worker_id=NULL,lease_token=NULL,lease_expires_at=NULL,result_summary=? WHERE id=?',[retry?'queued':'failed',new Date(+at+5000),retry?null:at,JSON.stringify({reason:retry?'connect_retry':error.name==='AbortError'||error.name==='TimeoutError'?'request_timeout':'request_failed',questionIds:[]}),job.id]);return true;}
  const valid=validateAiResponse(data,job.topic_id,Number(job.requested_count));
  const saved=await saveAiQuestions(db,job.topic_id,valid.questions,{model:valid.model,jobId:job.id}),n=saved.questionIds.length;
  const digest=createHash('sha256').update(JSON.stringify({topicId:job.topic_id,model:valid.model,questions:valid.questions})).digest();
  const summary={...saved,model:valid.model,origins:valid.origins,generated:valid.generated,seconds:valid.seconds,rejected:[...valid.rejected,...saved.rejected]};
  await db.execute('UPDATE quiz_jobs SET status=?,accepted_count=?,result_summary=?,response_hash=?,finished_at=?,lease_expires_at=NULL WHERE id=?',[n===Number(job.requested_count)?'succeeded':n?'partial':'failed',n,JSON.stringify(summary),digest,at,job.id]);return true;
 }));}
 async function runOnce(){if(busy||stopped||!settings.enabled)return false;busy=true;let heartbeat,job;
  try{job=await claim();if(!job)return false;controller=new AbortController();const requestController=controller;const timeout=setTimeout(()=>requestController.abort(),Math.max(1,+instant(job.deadline_at)-+now()));timeout.unref?.();
   heartbeat=setInterval(()=>{void connection(async db=>{const at=now();await db.execute("UPDATE quiz_jobs SET lease_expires_at=? WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>? AND deadline_at>?",[new Date(Math.min(+at+LEASE_MS,+instant(job.deadline_at))),job.id,job.lease_token,at,at]);}).catch(()=>requestController.abort());},20000);heartbeat.unref?.();
   let data,error;try{const response=await fetcher(settings.url+'/quiz',{method:'POST',headers:{'Content-Type':'application/json','X-Quiz-Token':settings.token},body:JSON.stringify({topicId:job.topic_id,count:Number(job.requested_count)}),signal:requestController.signal});if(!response.ok)throw Error('upstream_failed');data=await readLimitedJson(response);}catch(e){error=e;}finally{clearTimeout(timeout);clearInterval(heartbeat);}
   try{await finish(job,data,error);}catch{await finish(job,null,Error('invalid_response_or_storage'));}
   return true;
  }finally{clearInterval(heartbeat);controller=null;busy=false;}
 }
 return {runOnce,start(){if(timer||!settings.enabled)return;stopped=false;timer=setInterval(()=>{void runOnce().catch(()=>console.error('LLM 작업 처리 실패'));},intervalMs);timer.unref();void runOnce().catch(()=>console.error('LLM 작업 시작 실패'));},stop(){stopped=true;clearInterval(timer);timer=null;controller?.abort();}};
}
