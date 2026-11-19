// LLM 응답과 사전 생성 JSON을 같은 불변 문제 은행 규격으로 변환한다.
import {question,rowsFor} from '../shared/question-store.mjs';
export const AI_ACTIVE_LIMIT=40;
export const parseJson=v=>typeof v==='string'?JSON.parse(v):v;
export function normalizeAi(value){
 if(!value||typeof value!=='object')throw Error('invalid_question');
 const v={...value,q:typeof value.q==='string'?value.q.trim():value.q,explain:typeof value.explain==='string'?value.explain.trim():value.explain};
 if(Array.isArray(v.choices))v.choices=v.choices.map(x=>typeof x==='string'?x.trim():x);
 return question(v);
}
export function validateAiResponse(data,topicId,count=4){
 if(!data||data.topicId!==topicId)throw Error('topic_mismatch');
 if(!Array.isArray(data.questions)||data.questions.length>32)throw Error('invalid_response');
 if(typeof data.model!=='string'||!data.model.trim()||data.model.trim().length>100)throw Error('invalid_model');
 const accepted=[],rejected=[],seen=new Set(),origins=[];
 for(const [position,value]of data.questions.entries()){
  try{const q=normalizeAi(value),key=q.q.normalize('NFC');if(seen.has(key))throw Error('duplicate_question');if(accepted.length>=count)throw Error('excess_question');
   seen.add(key);accepted.push(q);origins.push(['live','pool'].includes(value.source)?value.source:'unspecified');
  }catch{rejected.push({position,reason:'invalid_duplicate_or_excess_question'});}
 }
 return {questions:accepted,model:data.model.trim(),origins,rejected,returnedCount:data.questions.length,acceptedLiveCount:origins.filter(x=>x==='live').length,acceptedPoolCount:origins.filter(x=>x==='pool').length,acceptedUnknownCount:origins.filter(x=>x==='unspecified').length,generated:Number.isInteger(data.generated)&&data.generated>=0?data.generated:null,seconds:typeof data.seconds==='number'&&Number.isFinite(data.seconds)&&data.seconds>=0?data.seconds:null};
}
// 호출자는 주제 행을 잠근 짧은 트랜잭션을 사용한다. 비활성 문제는 재활성화하지 않는다.
export async function saveAiQuestions(db,topicId,values,{model,jobId=null,status='published'}={}){
 if(typeof model!=='string'||!model.trim()||model.length>100)throw Error('invalid_model');
 if(!['draft','published'].includes(status))throw Error('invalid_question_status');
 const ids=[],rejected=[],acceptedPositions=[];let inserted=0,reused=0;
 for(const [position,value]of values.entries()){
  let q;try{q=normalizeAi(value);}catch{rejected.push({position,reason:'invalid_question'});continue;}
  const row=rowsFor({[topicId]:[q]},'ai')[0],digest=Buffer.from(row.contentHash,'hex');
  const [[old]]=await db.execute("SELECT id,status FROM questions WHERE topic_id=? AND source='ai' AND content_hash=?",[topicId,digest]);
  if(old){if(old.status==='disabled'){rejected.push({position,reason:'disabled_question'});continue;}if(old.status==='draft'&&status==='published'){rejected.push({position,reason:'draft_requires_review'});continue;}if(!ids.includes(old.id)){ids.push(old.id);acceptedPositions.push(position);reused++;}continue;}
  await db.execute("INSERT INTO questions(id,topic_id,source,status,content_hash,generation_job_id) VALUES (?,?,'ai',?,?,?)",[row.id,topicId,status,digest,jobId]);
  await db.execute('INSERT INTO question_details(question_id,type,body,choices,answer,explanation,model) VALUES (?,?,?,?,?,?,?)',[row.id,row.type,row.body,row.choices===null?null:JSON.stringify(row.choices),JSON.stringify(row.answer),row.explanation,model]);
  ids.push(row.id);acceptedPositions.push(position);inserted++;
 }
 const [active]=await db.execute("SELECT id FROM questions WHERE topic_id=? AND source='ai' AND status='published' ORDER BY created_at DESC,id DESC",[topicId]);
 const disabled=active.slice(AI_ACTIVE_LIMIT).map(x=>x.id);
 for(const id of disabled)await db.execute("UPDATE questions SET status='disabled' WHERE id=?",[id]);
 return {questionIds:ids,acceptedPositions,inserted,reused,rejected,disabled:disabled.length};
}
// 이번 작업 결과를 먼저 선택하되 중복 본문은 은행 출제에서도 다시 사용하지 않는다.
export async function selectAiQuestions(db,topicId,jobId,count=4,{attemptId}={}){
 let preferred=[],draftIds=[];
 if(jobId&&attemptId){
  // 앱이 보낸 job 번호만 믿지 않고 실제 학습 연결과 최초 요청 시도를 함께 확인한다.
  const [[job]]=await db.execute("SELECT j.request_spec,j.result_summary FROM quiz_jobs j JOIN quiz_attempts a ON a.generation_job_id=j.id AND a.topic_id=j.topic_id WHERE j.id=? AND j.topic_id=? AND a.id=? AND a.purpose='study' AND j.status IN ('succeeded','partial')",[jobId,topicId,attemptId]);
  if(job){const spec=parseJson(job.request_spec),summary=parseJson(job.result_summary);if(spec?.ownerAttemptId===attemptId){preferred=(summary?.questionIds??[]).slice(0,4);draftIds=preferred;}}
 }
 const draftSql=draftIds.length?` OR (q.status='draft' AND q.id IN (${draftIds.map(()=>'?').join(',')}))`:'';
 const [rows]=await db.execute("SELECT q.id,d.type,d.body,d.choices,d.answer,d.explanation FROM questions q JOIN question_details d ON d.question_id=q.id WHERE q.topic_id=? AND q.source='ai' AND (q.status='published'"+draftSql+") ORDER BY RAND()",[topicId,...draftIds]);
 rows.sort((a,b)=>Number(preferred.includes(b.id))-Number(preferred.includes(a.id)));
 const seen=new Set(),out=[];
 for(const r of rows){const body=r.body.trim().normalize('NFC');if(seen.has(body))continue;seen.add(body);out.push({topicId,questionId:r.id,question:{type:r.type,q:r.body,...(r.type==='mc'?{choices:parseJson(r.choices)}:{}),answer:parseJson(r.answer),explain:r.explanation,src:'ai'}});if(out.length===count)break;}
 return out;
}
