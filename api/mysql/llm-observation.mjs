// 구조화 로그에는 식별자·개수·안전한 사유만 남긴다. 토큰·답안·문제 원문은 기록하지 않는다.
const events=new Set(['request_started','response_received','job_finished','job_failed','job_retry','result_ignored','quiz_issued']);
const counts=['requestedCount','returnedCount','liveCount','poolCount','unknownCount','generatedCount','acceptedCount','insertedCount','reusedCount','validationRejectedCount','storageRejectedCount','requestElapsedMs','queueElapsedMs','jobElapsedMs','llmSeconds','attemptNumber','aiCount','bankCount','practiceCount','totalCount'];
const reasons=new Set(['request_timeout','upstream_unauthorized','upstream_forbidden','upstream_http_error','response_too_large','response_interrupted','invalid_response_or_storage','request_failed','connect_retry']);
const rejects=new Set(['invalid_duplicate_or_excess_question','invalid_question','disabled_question','draft_requires_review']);
export function writeLlmLog(event,fields={},sink=line=>console.info(line)){
 try{
  if(!events.has(event))return;
  const out={component:'llm',event,at:new Date().toISOString()};
  for(const k of ['jobId','attemptId'])if(typeof fields[k]==='string'&&/^[0-9a-f-]{36}$/.test(fields[k]))out[k]=fields[k];
  if(typeof fields.topicId==='string'&&/^[a-z0-9_-]{1,80}$/.test(fields.topicId))out.topicId=fields.topicId;
  for(const k of counts)if(typeof fields[k]==='number'&&Number.isFinite(fields[k])&&fields[k]>=0)out[k]=fields[k];
  if(['draft','published'].includes(fields.storageMode))out.storageMode=fields.storageMode;
  if(['succeeded','partial','failed'].includes(fields.status))out.status=fields.status;
  if(reasons.has(fields.reason))out.reason=fields.reason;
  if(Number.isInteger(fields.upstreamStatus)&&fields.upstreamStatus>=100&&fields.upstreamStatus<=599)out.upstreamStatus=fields.upstreamStatus;
  if(Array.isArray(fields.rejections))out.rejections=fields.rejections.slice(0,64).filter(x=>x&&Number.isInteger(x.position)&&x.position>=0&&x.position<32&&rejects.has(x.reason)&&['response_validation','storage'].includes(x.stage)).map(x=>({stage:x.stage,position:x.position,reason:x.reason}));
  sink(JSON.stringify(out));
 }catch{ /* 로그 출력 실패가 출제·저장·보상에 영향을 주지 않게 한다. */ }
}
