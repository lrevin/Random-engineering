// 사전 생성 JSON만 읽는다. SQL 파일은 실행하지 않는다. 오류 문항은 위치·사유만 보고한다.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {connect,transaction,safeError} from '../server/db.mjs';
import {normalizeAi,saveAiQuestions} from './ai-question-store.mjs';
export async function importAiQuizzes(db,{file,summaryFile,model='qwen3:14b'}={}){
 const bytes=fs.readFileSync(file);if(bytes.length>16777216)throw Error('import_too_large');const input=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_topic_map');
 const [topics]=await db.query('SELECT id FROM topics'),known=new Set(topics.map(x=>x.id));
 const report={sha256:createHash('sha256').update(bytes).digest('hex'),sourceTopics:Object.keys(input).length,sourceQuestions:0,inserted:0,reused:0,disabled:0,rejected:[],emptyTopics:[],missingTopics:[...known].filter(x=>!Object.hasOwn(input,x)).sort()};
 for(const [topicId,values]of Object.entries(input).sort(([a],[b])=>a.localeCompare(b))){
  if(!Array.isArray(values)){report.rejected.push({topicId,reason:'invalid_topic_array'});continue;}report.sourceQuestions+=values.length;
  if(!known.has(topicId)){report.rejected.push({topicId,reason:'unknown_topic'});continue;}if(!values.length){report.emptyTopics.push(topicId);continue;}
  const qs=[];for(const [position,q]of values.entries()){try{qs.push(normalizeAi(q));}catch{report.rejected.push({topicId,position,reason:'invalid_question'});}}
  const saved=await transaction(db,async()=>{await db.execute('SELECT id FROM topics WHERE id=? FOR UPDATE',[topicId]);return saveAiQuestions(db,topicId,qs,{model});});
  report.inserted+=saved.inserted;report.reused+=saved.reused;report.disabled+=saved.disabled;report.rejected.push(...saved.rejected.map(x=>({topicId,...x})));
 }
 const absent=[...new Set([...report.emptyTopics,...report.missingTopics])].sort();
 if(summaryFile){const text=fs.readFileSync(summaryFile,'utf8').replace(/^\uFEFF/,'');const listed=text.split(/\r?\n/).map(x=>/^([a-z][a-z0-9_-]+)\s/.exec(x)?.[1]).filter(Boolean);const set=new Set(listed);const counts=/주제 (\d+)개 중 처리 (\d+)개, 문제 (\d+)개/.exec(text);report.summary={listedEmpty:listed.length,matches:listed.length===set.size&&absent.length===set.size&&absent.every(x=>set.has(x)),countsMatch:!!counts&&Number(counts[1])===known.size&&Number(counts[2])===report.sourceTopics&&Number(counts[3])===report.sourceQuestions};}
 const [active]=await db.query("SELECT topic_id,COUNT(*) AS n FROM questions WHERE source='ai' AND status='published' GROUP BY topic_id");
 const have=new Set(active.map(x=>x.topic_id));report.activeTopics=active.length;report.activeQuestions=active.reduce((n,x)=>n+Number(x.n),0);report.noAiTopics=[...known].filter(x=>!have.has(x)).sort();return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
 if(!args.includes('--file'))throw Error('--file required');const db=await connect();
 try{const report=await importAiQuizzes(db,{file:value('--file'),summaryFile:args.includes('--summary')?value('--summary'):undefined});if(args.includes('--report'))fs.writeFileSync(path.resolve(value('--report')),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({...report,rejected:report.rejected.length,noAiTopics:report.noAiTopics.length,emptyTopics:report.emptyTopics.length,missingTopics:report.missingTopics}));}catch(e){console.error('AI 문제 가져오기 실패: '+safeError(e));process.exitCode=1;}finally{await db.end();}
}
