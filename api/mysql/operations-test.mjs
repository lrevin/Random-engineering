// 계정·기록을 만드는 검사이므로 운영 DB에서는 실행하지 않는다. 임시 MySQL 전용이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connect} from '../server/db.mjs';
import {runMaintenance,databaseUsage} from './operations-service.mjs';
test('실제 DB 운영 정리: 미리보기·기한·참조·일괄 제한·재실행',async t=>{
 if(process.env.MYSQL_HOST!=='127.0.0.1'||process.env.MYSQL_DATABASE!=='ppobgong_ops_test')throw Error('OPS_TEST_REQUIRES_DISPOSABLE_DB');
 const db=await connect();t.after(()=>db.end());const now=new Date('2026-11-21T00:00:00Z'),uid=randomUUID();
 await db.execute("INSERT INTO users(id,status) VALUES (?,'active')",[uid]);
 const old=new Date(+now-120*86400000),recent=new Date(+now-86400000),topic='ai-23';
 for(let i=0;i<3;i++)await db.execute('INSERT INTO password_resets(id,user_id,email,code_hash,expires_at,created_at) VALUES (?,?,?,UNHEX(REPEAT(\'00\',32)),?,?)',[randomUUID(),uid,'ops@example.com',old,old]);
 await db.execute('INSERT INTO password_resets(id,user_id,email,code_hash,expires_at,created_at) VALUES (?,?,?,UNHEX(REPEAT(\'00\',32)),?,?)',[randomUUID(),uid,'ops@example.com',recent,recent]);
 await db.execute("INSERT INTO notification_log(kind,ref,period,user_id,created_at) VALUES ('weekly',?,'2026-01-01',?,?)",[uid,uid,old]);
 const oldSession=randomUUID(),liveSession=randomUUID();
 for(const [id,expiry]of [[oldSession,old],[liveSession,new Date(+now+86400000)]])await db.execute('INSERT INTO auth_sessions(id,user_id,created_at,expires_at) VALUES (?,?,?,?)',[id,uid,new Date(+old-86400000),expiry]);
 for(const id of [oldSession,liveSession])await db.execute("INSERT INTO refresh_tokens(token_hash,session_id,created_at,expires_at) VALUES (UNHEX(SHA2(?,256)),?,?,?)",[id,id,new Date(+old-86400000),id===oldSession?old:new Date(+now+86400000)]);
 const jobs=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
 for(const [i,id]of jobs.entries())await db.execute("INSERT INTO quiz_jobs(id,topic_id,status,requested_count,accepted_count,available_at,deadline_at,request_spec,created_at,finished_at) VALUES (?,?,'failed',4,0,?,?,JSON_OBJECT(),?,?)",[id,topic,old,new Date(+old+600000),old,i===2?recent:old]);
 const attempt=randomUUID();await db.execute("INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,generation_job_id) VALUES (?,?,?,'issued','server_verified',?,?)",[attempt,uid,topic,old,jobs[3]]);
 const qid=randomUUID();await db.execute("INSERT INTO questions(id,topic_id,source,status,content_hash,generation_job_id,created_at,updated_at) VALUES (?,?,'ai','draft',UNHEX(SHA2(?,256)),?,?,?)",[qid,topic,qid,jobs[1],old,old]);
 const preview=await runMaintenance({now,limit:2});assert.equal(preview.mode,'preview');assert.equal(preview.automatic.find(x=>x.table==='password_resets').selected,2);assert(preview.review.find(x=>x.type==='questions_review').ids.includes(qid));
 assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM password_resets WHERE user_id=?',[uid]))[0][0].n),4);
 let deletes=0;const failing=async()=>{const c=await connect(),execute=c.execute.bind(c);c.execute=async(sql,args)=>{if(sql.startsWith('DELETE x FROM password_resets')&&++deletes===2)throw Error('OPS_TEST_ABORT');return execute(sql,args);};return c;};
 await assert.rejects(runMaintenance({apply:true,now,limit:2},failing),/TEST_ABORT/);
 assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM password_resets WHERE user_id=?',[uid]))[0][0].n),4);
 const result=await runMaintenance({apply:true,now,limit:2});assert.equal(result.automatic.find(x=>x.table==='password_resets').deleted,2);
 assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM auth_sessions WHERE id=?',[liveSession]))[0][0].n),1);assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM refresh_tokens WHERE session_id=?',[liveSession]))[0][0].n),1);
 const [remaining]=await db.execute('SELECT id FROM quiz_jobs WHERE id IN (?,?,?,?)',jobs);assert.deepEqual(remaining.map(x=>x.id).sort(),[jobs[1],jobs[2],jobs[3]].sort());
 await runMaintenance({apply:true,now,limit:2});const final=await runMaintenance({apply:true,now,limit:2});assert.equal(final.automatic.find(x=>x.table==='password_resets').deleted,0);
 assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM questions WHERE id=?',[qid]))[0][0].n),1);assert.equal(Number((await db.execute('SELECT COUNT(*) n FROM password_resets WHERE user_id=?',[uid]))[0][0].n),1);
 const usage=await databaseUsage();assert(usage.totalBytes>0);assert(usage.tables.some(x=>x.name==='questions'));
});

test('실제 DB 덤프·압축 백업을 격리 DB에 복원해 로그인·기록·지갑까지 검사',async t=>{
 if(process.env.MYSQL_HOST!=='127.0.0.1'||process.env.MYSQL_DATABASE!=='ppobgong_ops_test')throw Error('OPS_TEST_REQUIRES_DISPOSABLE_DB');
 const fs=await import('node:fs/promises'),path=await import('node:path'),os=await import('node:os');
 const {createBackup,verifyBackup,restoreCheck}=await import('./operations-files.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ppobgong-ops-backup-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=path.join(root,'source'),backups=path.join(root,'backups');await fs.mkdir(source);await fs.mkdir(backups);await fs.writeFile(path.join(source,'code.txt'),'복구 검사');await fs.writeFile(path.join(source,'.env'),'SYNTHETIC_ONLY=1');await fs.writeFile(path.join(source,'private.env'),'SYNTHETIC_ONLY=2');await fs.mkdir(path.join(source,'node_modules'));await fs.writeFile(path.join(source,'node_modules','ignored.txt'),'검사');
 const envfile=path.join(root,'fake-environment'),service=path.join(root,'service.conf');await fs.writeFile(envfile,'SYNTHETIC_TEST_ONLY=1');await fs.writeFile(service,'[Service]');
 const bin=process.env.OPS_TEST_MYSQL_BIN;if(!bin)throw Error('OPS_TEST_MYSQL_BIN_REQUIRED');
 const result=await createBackup({root:backups,source,serviceConfig:service,environmentFile:envfile,apply:true,dumpTool:path.join(bin,'mysqldump.exe')});
 const {execFileSync}=await import('node:child_process');const archive=execFileSync('tar',['-tzf',path.join(backups,result.name,'code.tar.gz')],{encoding:'utf8'});assert(archive.includes('code.txt'));assert(!archive.includes('.env'));assert(!archive.includes('node_modules'));
 const backup=path.join(backups,result.name);assert.equal((await verifyBackup(backup)).hashVerified,true);
 const restored=await restoreCheck({backup,port:Number(process.env.MYSQL_PORT),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD??'',apply:true,mysqlTool:path.join(bin,'mysql.exe')});
 assert.deepEqual(restored.flows,{login:true,record:true,wallet:true});assert.equal(restored.migrations,14);
 const db=await connect();try{const [rows]=await db.query("SHOW DATABASES LIKE 'ppobgong_restore_%'");assert.equal(rows.length,0);}finally{await db.end();}
 // 복원 파일이 다른 DB 생성을 요구해도 제한 계정으로 거절하고 임시 자원은 정리한다.
 const {gzipSync}=await import('node:zlib'),{createHash}=await import('node:crypto');const payload=gzipSync('CREATE DATABASE ops_forbidden_database;');
 await fs.writeFile(path.join(backup,'database.sql.gz'),payload);const markerPath=path.join(backup,'.ppobgong-ops.json'),manifest=JSON.parse(await fs.readFile(markerPath,'utf8'));
 manifest.files['database.sql.gz']={bytes:payload.length,sha256:createHash('sha256').update(payload).digest('hex')};await fs.writeFile(markerPath,JSON.stringify(manifest));
 await assert.rejects(restoreCheck({backup,port:Number(process.env.MYSQL_PORT),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD??'',apply:true,mysqlTool:path.join(bin,'mysql.exe')}),/TOOL_FAILED/);
 const check=await connect();try{for(const pattern of ['ops_forbidden_database','ppobgong_restore_%']){const [rows]=await check.execute('SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE ?',[pattern]);assert.equal(rows.length,0);}}finally{await check.end();}
 await fs.appendFile(path.join(backup,'service.conf'),'변경');await assert.rejects(verifyBackup(backup),/HASH_MISMATCH/);
});
