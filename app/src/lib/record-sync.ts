import {AuthApiError, type createAuthClient} from "./auth-client";
import type {StudyRecord} from "./types";
type Client = ReturnType<typeof createAuthClient>;
/** Serialize reads and deletes together so stale snapshots cannot restore a deleted record. */
export function enqueueRecordOperation(queue: {current: Promise<void>}, action: () => Promise<void>) {
 const task=queue.current.catch(()=>{}).then(action);queue.current=task;return task;
}
/** One account at a time; callers serialize jobs and invalidate ownership before switching accounts. */
export async function syncMySqlRecords(client: Client, get: () => StudyRecord[], set: (rs: StudyRecord[]) => void, current: () => boolean, orphan: (r: StudyRecord) => Promise<void>) {
 const merge = (remote: StudyRecord) => {
  if (!current()) return;
  set(get().map(local => local.id !== remote.id ? local : local.memoPending ? {
   ...remote, memo: local.memo, memoPending: {...local.memoPending, baseChangeSeq: local.memoPending.baseChangeSeq ?? remote.changeSeq}, memoConflict: local.memoConflict,
  } : remote));
 };
 const pending=get().filter(r=>!r.synced && r.syncError!=="record_deleted");
 for(let i=0;i<pending.length;i+=100){
  if(!current()) return;
  const response=await client.uploadRecords(pending.slice(i,i+100));
  if(!current()) return;
  for(const result of response.results){
   if(result.ok && result.record) merge(result.record);
   else set(get().map(r=>r.id===result.id?{...r,syncError:result.error}:r));
  }
 }
 if(!current()) return;
 const snapshot=await client.recordSnapshot();
 if(!current()) return;
 const latest=get(),serverIds=new Set(snapshot.records.map(r=>r.id));
 // Keep a recoverable draft if another device deleted its parent record.
 for(const r of latest.filter(r=>!serverIds.has(r.id)&&(r.synced||r.syncError==="record_deleted")&&r.memoPending)) await orphan(r);
 if(!current())return;
 const byId=new Map(get().map(r=>[r.id,r]));
 set([...snapshot.records.map(remote=>{
  const local=byId.get(remote.id);
  return local?.memoPending?{...remote,memo:local.memo,memoPending:{...local.memoPending,baseChangeSeq:local.memoPending.baseChangeSeq??remote.changeSeq},memoConflict:local.memoConflict}:remote;
 }),...get().filter(r=>!r.synced&&r.syncError!=="record_deleted"&&!serverIds.has(r.id))].sort((a,b)=>a.studiedAt.localeCompare(b.studiedAt)));
 for(const r of get().filter(r=>r.synced&&r.memoPending&&!r.memoConflict)){
  if(!current())return;
  const draft=r.memoPending!;
  if(!draft.baseChangeSeq)continue;
  try {
   const {record}=await client.saveRecordMemo(r.id,r.memo,draft.baseChangeSeq);
   if(!current())return;
   set(get().map(local=>local.id!==r.id?local:local.memoPending?.version===draft.version?record:{...record,memo:local.memo,memoPending:local.memoPending?{...local.memoPending,baseChangeSeq:record.changeSeq}:undefined}));
  } catch(e){
   if(!current())return;
   if(e instanceof AuthApiError && e.code==="memo_conflict" && e.details.record){
    const remote=e.details.record;set(get().map(local=>local.id===r.id?{...local,memoConflict:{memo:remote.memo,changeSeq:remote.changeSeq!}}:local));
   }else if(e instanceof AuthApiError && e.status===404){await orphan(r);if(current())set(get().filter(local=>local.id!==r.id));}
   else throw e;
  }
 }
}
