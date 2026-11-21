// 관리 표시가 있는 폴더만 정리한다. 현재 릴리스·심볼릭 링크·임의 경로는 삭제하지 않는다.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createReadStream,createWriteStream} from 'node:fs';
import {createGzip,createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {options,connect} from '../server/db.mjs';
export const MARKER='.ppobgong-ops.json';
const DAY=86400000;
const childDone=child=>new Promise((resolve,reject)=>{child.once('error',()=>reject(Error('OPS_TOOL_UNAVAILABLE')));child.once('close',code=>code===0?resolve():reject(Error('OPS_TOOL_FAILED')));});
export async function command(program,args,{env=process.env,input,output}={}){
 const child=spawn(program,args,{env,windowsHide:true,stdio:[input?'pipe':'ignore',output?'pipe':'ignore','ignore']});
 const done=childDone(child);try{await Promise.all([done,...(input?[pipeline(input,child.stdin)]:[]),...(output?[pipeline(child.stdout,output)]:[])]);}catch(e){child.kill();await done.catch(()=>{});throw e;}
}
const inside=(root,file)=>{const rel=path.relative(root,file);return !!rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
export async function folderSize(root){let bytes=0;for(const entry of await fs.readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory())bytes+=await folderSize(file);else if(entry.isFile())bytes+=(await fs.stat(file)).size;}return bytes;}
export async function fileRetention({root,kind,current,apply=false,now=new Date()}={}){
 if(!['backup','release'].includes(kind)||!root||typeof apply!=='boolean'||!Number.isFinite(+now))throw Error('OPS_INVALID_FILE_OPTIONS');
 if(kind==='release'&&!current)throw Error('OPS_CURRENT_RELEASE_REQUIRED');
 const base=await fs.realpath(root),live=current?await fs.realpath(current):null;
 if(path.parse(base).root===base)throw Error('OPS_ROOT_REFUSED');
 if(kind==='release'&&(!inside(base,live)||!(await fs.stat(live)).isDirectory()))throw Error('OPS_CURRENT_RELEASE_OUTSIDE_ROOT');
 const managed=[],unmanaged=[];
 for(const entry of await fs.readdir(base,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.isSymbolicLink())continue;
  const folder=path.join(base,entry.name);let marker;
  try{const stat=await fs.lstat(path.join(folder,MARKER));if(!stat.isFile()||stat.isSymbolicLink())throw Error();marker=JSON.parse(await fs.readFile(path.join(folder,MARKER),'utf8'));}catch{unmanaged.push(entry.name);continue;}
  if(marker.kind!==kind||marker.version!==1||marker.complete!==true||!Number.isFinite(Date.parse(marker.createdAt))){unmanaged.push(entry.name);continue;}
  managed.push({name:entry.name,folder,createdAt:marker.createdAt,bytes:await folderSize(folder)});
 }
 managed.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.name.localeCompare(b.name));
 const result=[];
 for(const [index,row]of managed.entries()){
  const protectLive=live&&(row.folder===live||inside(row.folder,live));
  const selected=!protectLive&&index>=3&&(kind==='release'||+now-Date.parse(row.createdAt)>30*DAY);
  if(apply&&selected){
   // 실행 직전에도 같은 실제 경로인지 확인하고 링크 교체를 거절한다.
   if((await fs.lstat(row.folder)).isSymbolicLink()||await fs.realpath(row.folder)!==row.folder||!inside(base,row.folder))throw Error('OPS_PATH_CHANGED');
   const check=JSON.parse(await fs.readFile(path.join(row.folder,MARKER),'utf8'));if(check.kind!==kind||check.createdAt!==row.createdAt||check.complete!==true)throw Error('OPS_MARKER_CHANGED');
   await fs.rm(row.folder,{recursive:true,force:false});
  }
  result.push({name:row.name,createdAt:row.createdAt,bytes:row.bytes,protected:!!protectLive,selected,deleted:apply&&selected});
 }
 return {kind,mode:apply?'apply':'preview',keepNewest:3,minimumDays:kind==='backup'?30:null,managed:result,unmanaged};
}
export async function diskUsage(root){const value=await fs.statfs(root);const total=Number(value.blocks)*Number(value.bsize),available=Number(value.bavail)*Number(value.bsize),used=total-available,percent=total?Math.round(used/total*100):0;return {totalBytes:total,availableBytes:available,usedPercent:percent,level:percent>=85?'action':percent>=70?'warning':'normal'};}
function mysqlSettings(environment=process.env){const c=options.call(null);return {args:['--no-defaults','--protocol=TCP','--host='+c.host,'--port='+c.port,'--user='+c.user,...(environment.MYSQL_SSL_CA?['--ssl-mode=VERIFY_IDENTITY','--ssl-ca='+environment.MYSQL_SSL_CA]:[])],env:{...environment,MYSQL_PWD:c.password},database:c.database};}
export async function createBackup({root,source,serviceConfig,environmentFile,s3,apply=false,now=new Date(),dumpTool='mysqldump',tarTool='tar',awsTool='aws'}={}){
 if(!root||!source||!serviceConfig)throw Error('OPS_BACKUP_PATHS_REQUIRED');
 if(!apply)return {mode:'preview',kind:'backup',databaseBackup:true,codeBackup:true,serviceBackup:true,environmentBackup:!!environmentFile,offsite:!!s3};
 if(s3&&!/^s3:\/\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9](?:\/[A-Za-z0-9/_-]*)?$/.test(s3))throw Error('OPS_INVALID_S3_URI');
 const base=await fs.realpath(root),code=await fs.realpath(source);
 if(base===code||inside(code,base))throw Error('OPS_BACKUP_INSIDE_SOURCE');
 const id='backup-'+now.toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),dir=path.join(base,id);
 await fs.mkdir(dir,{mode:0o700});const config=mysqlSettings();
 try{
  const raw=path.join(dir,'database.sql');
  await command(dumpTool,[...config.args,'--single-transaction','--quick','--skip-lock-tables','--no-tablespaces','--set-gtid-purged=OFF','--hex-blob',config.database],{env:config.env,output:createWriteStream(raw,{mode:0o600,flags:'wx'})});
  await pipeline(createReadStream(raw),createGzip(),createWriteStream(raw+'.gz',{mode:0o600,flags:'wx'}));await fs.unlink(raw);
  await command(tarTool,['--exclude=.git','--exclude=node_modules','--exclude=app/android','--exclude=app/ios','--exclude=.env*','--exclude=*.env','--exclude=*.p8','--exclude=*.mobileprovision','--exclude=.aws','--exclude=.ssh','--exclude=.cxx','--exclude=*.sql.gz','--exclude=*.jks','--exclude=*.pfx','--exclude=*.pem','--exclude=*.key','--exclude=*.p12','--exclude=*.keystore','-czf',path.join(dir,'code.tar.gz'),'-C',code,'.']);
  await fs.copyFile(serviceConfig,path.join(dir,'service.conf'));
  if(environmentFile)await fs.copyFile(environmentFile,path.join(dir,'environment.secret'));
  const files={};
  for(const file of await fs.readdir(dir)){const target=path.join(dir,file);await fs.chmod(target,0o600);const hash=createHash('sha256');for await(const part of createReadStream(target))hash.update(part);files[file]={bytes:(await fs.stat(target)).size,sha256:hash.digest('hex')};}
  const marker={version:1,kind:'backup',complete:true,createdAt:now.toISOString(),files,offsite:!!s3};
  await fs.writeFile(path.join(dir,MARKER),JSON.stringify(marker,null,2),{mode:0o600,flag:'wx'});
  if(s3)await command(awsTool,['s3','cp',dir,s3.replace(/\/$/,'')+'/'+id+'/','--recursive','--sse','AES256','--only-show-errors']);
  return {mode:'apply',kind:'backup',name:id,files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,v.bytes])),offsite:!!s3};
 }catch(e){await fs.writeFile(path.join(dir,MARKER),JSON.stringify({version:1,kind:'backup',complete:false,createdAt:now.toISOString()}),{mode:0o600});throw e;}
}
// 복원은 별도로 준비한 로컬 시험용 서버에서만 실행한다.
export async function restoreCheck({backup,host='127.0.0.1',port,user,password='',mysqlTool='mysql',apply=false}={}){
 if(!backup||host!=='127.0.0.1'||!Number.isInteger(port)||port<1024||port>65535||port===3306||!user)throw Error('OPS_ISOLATED_RESTORE_REQUIRED');
 await verifyBackup(backup);
 const dir=await fs.realpath(backup),marker=JSON.parse(await fs.readFile(path.join(dir,MARKER),'utf8'));
 if(marker.kind!=='backup'||!marker.complete||!marker.files?.['database.sql.gz'])throw Error('OPS_INVALID_BACKUP');
 const hash=createHash('sha256');for await(const part of createReadStream(path.join(dir,'database.sql.gz')))hash.update(part);
 if(hash.digest('hex')!==marker.files['database.sql.gz'].sha256)throw Error('OPS_BACKUP_HASH_MISMATCH');
 if(!apply)return {mode:'preview',isolated:true,hashVerified:true};
 const dbname='ppobgong_restore_'+randomBytes(8).toString('hex'),account='opsrestore_'+randomBytes(6).toString('hex'),secret=randomBytes(24).toString('hex');
 const mysql=createRequire(new URL('../server/package.json',import.meta.url))('mysql2/promise');
 const admin=await mysql.createConnection({host,port,user,password,timezone:'Z',multipleStatements:false});let created=false,login=false;
 try{
  const [[server]]=await admin.query('SELECT @@port AS port');if(Number(server.port)!==port||Number(server.port)===3306)throw Error('OPS_ISOLATED_RESTORE_REQUIRED');
  await admin.query('CREATE DATABASE `'+dbname+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');created=true;
  await admin.query("CREATE USER '"+account+"'@'127.0.0.1' IDENTIFIED BY '"+secret+"'");login=true;
  await admin.query('GRANT ALL PRIVILEGES ON `'+dbname+"`.* TO '"+account+"'@'127.0.0.1'");
  // 권한을 해당 임시 DB로만 제한해 덤프 안의 다른 DB 접근도 차단한다.
  await command(mysqlTool,['--no-defaults','--protocol=TCP','--host=127.0.0.1','--port='+port,'--user='+account,'--local-infile=0','--binary-mode',dbname],{env:{...process.env,MYSQL_PWD:secret},input:createReadStream(path.join(dir,'database.sql.gz')).pipe(createGunzip())});
  const counts={};for(const table of ['users','study_records','quiz_attempt_items','wallets','wallet_transactions','questions']){const [[row]]=await admin.query('SELECT COUNT(*) AS n FROM `'+dbname+'`.`'+table+'`');counts[table]=Number(row.n);}
  const [[history]]=await admin.query('SELECT COUNT(*) AS n FROM `'+dbname+'`.flyway_schema_history WHERE success=1');
  if(Number(history.n)<14)throw Error('OPS_RESTORE_SCHEMA_INCOMPLETE');
  const [[invalidHistory]]=await admin.query('SELECT COUNT(*) AS n FROM `'+dbname+'`.flyway_schema_history WHERE success=0');if(Number(invalidHistory.n))throw Error('OPS_RESTORE_SCHEMA_INCOMPLETE');
  for(const [child,parent,column]of [['study_records','users','user_id'],['quiz_attempt_items','quiz_attempts','attempt_id'],['wallet_transactions','wallets','user_id']]){
   const key=parent==='wallets'?'user_id':'id';const [[orphan]]=await admin.query('SELECT COUNT(*) AS n FROM `'+dbname+'`.`'+child+'` c LEFT JOIN `'+dbname+'`.`'+parent+'` p ON p.`'+key+'`=c.`'+column+'` WHERE p.`'+key+'` IS NULL');if(Number(orphan.n))throw Error('OPS_RESTORE_ORPHAN_DATA');
  }
  // 새 임시 회원으로 실제 서비스의 가입·로그인·기록 저장/조회·지갑 조회까지 확인한다.
  const factory=async()=>{const db=await mysql.createConnection({host,port,user:account,password:secret,database:dbname,timezone:'Z',dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});await db.query("SET time_zone='+00:00'");return db;};
  const {createAuth}=await import('../server/auth.mjs'),{createRecordService}=await import('./record-service.mjs'),{databaseStore}=await import('./question-service.mjs'),{walletState}=await import('./wallet-state.mjs');
  const auth=createAuth({secret:randomBytes(48).toString('hex'),connectionFactory:factory}),email=randomUUID()+'@example.com',pass=randomBytes(20).toString('hex');
  await auth.signup({email,password:pass});const session=await auth.login({email,password:pass}),header='Bearer '+session.accessToken;
  const evidence=await factory();let bank;try{bank=await databaseStore(evidence).questions('ds-01');}finally{await evidence.end();}
  if(bank.length<7)throw Error('OPS_RESTORE_BANK_INCOMPLETE');
  const records=createRecordService({auth,connectionFactory:factory}),recordId=randomUUID();
  const saved=(await records.upload(header,{records:[{id:recordId,topicId:'ds-01',memo:'복구 검사',studySec:0,score:7,total:7,studiedAt:new Date().toISOString(),items:bank.slice(0,7).map(q=>({question:{...q,src:'bank'},answer:q.answer}))}]})).results[0];
  if(!saved.ok||!(await records.snapshot(header)).records.some(r=>r.id===recordId))throw Error('OPS_RESTORE_RECORD_FAILED');
  const walletDb=await factory();try{await walletDb.beginTransaction();const w=await walletState(walletDb,session.user.id);if(w.balance!==30)throw Error('OPS_RESTORE_WALLET_FAILED');await walletDb.commit();}finally{await walletDb.end();}
  return {mode:'apply',hashVerified:true,schemaVerified:true,counts,migrations:Number(history.n),isolated:true,flows:{login:true,record:true,wallet:true}};
 }finally{
  let cleanupFailed=false;
  if(created)await admin.query('DROP DATABASE `'+dbname+'`').catch(()=>{cleanupFailed=true;});
  if(login)await admin.query("DROP USER '"+account+"'@'127.0.0.1'").catch(()=>{cleanupFailed=true;});
  await admin.end();if(cleanupFailed)throw Error('OPS_RESTORE_CLEANUP_FAILED');
 }
}
export async function rdsBackupStatus(identifier,awsTool='aws'){
 if(!/^[a-zA-Z][a-zA-Z0-9-]{0,62}$/.test(identifier??''))throw Error('OPS_INVALID_RDS_ID');
 const child=spawn(awsTool,['rds','describe-db-instances','--db-instance-identifier',identifier,'--query','DBInstances[0].{retention:BackupRetentionPeriod,latestRestorable:LatestRestorableTime,encrypted:StorageEncrypted,window:PreferredBackupWindow,allocatedGiB:AllocatedStorage,maxAllocatedGiB:MaxAllocatedStorage}','--output','json'],{windowsHide:true,stdio:['ignore','pipe','ignore']});
 const done=childDone(child);let text='';await Promise.all([done,(async()=>{for await(const chunk of child.stdout){text+=chunk;if(text.length>100000){child.kill();throw Error('OPS_RDS_RESPONSE_TOO_LARGE');}}})()]);
 return rdsRecoverySummary(JSON.parse(text));
}

/** 파일 경로와 체크섬을 확인한다. 값·덤프 내용은 출력하지 않는다. */
export async function verifyBackup(folder,{recent=false,now=new Date()}={}){
 const dir=await fs.realpath(folder),markerPath=path.join(dir,MARKER),marker=JSON.parse(await fs.readFile(markerPath,'utf8'));
 if(marker.version!==1||marker.kind!=='backup'||marker.complete!==true||!marker.files?.['database.sql.gz']||!marker.files?.['code.tar.gz']||!marker.files?.['service.conf'])throw Error('OPS_INVALID_BACKUP');
 const age=+now-Date.parse(marker.createdAt);if(!Number.isFinite(age)||age<0||recent&&age>48*3600000)throw Error('OPS_RECENT_BACKUP_REQUIRED');
 for(const [name,expected]of Object.entries(marker.files)){
  if(!['database.sql.gz','code.tar.gz','service.conf','environment.secret'].includes(name))throw Error('OPS_INVALID_BACKUP_FILE');
  const file=path.join(dir,name),stat=await fs.lstat(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size!==expected.bytes)throw Error('OPS_BACKUP_HASH_MISMATCH');
  const hash=createHash('sha256');for await(const part of createReadStream(file))hash.update(part);if(hash.digest('hex')!==expected.sha256)throw Error('OPS_BACKUP_HASH_MISMATCH');
 }
 return {dir,createdAt:marker.createdAt,hashVerified:true};
}
export async function latestVerifiedBackup(root){
 if(!root)throw Error('OPS_RECENT_BACKUP_REQUIRED');
 const base=await fs.realpath(root),candidates=[];
 for(const entry of await fs.readdir(base,{withFileTypes:true})){if(!entry.isDirectory()||entry.isSymbolicLink())continue;const folder=path.join(base,entry.name);try{const marker=JSON.parse(await fs.readFile(path.join(folder,MARKER),'utf8'));if(marker.kind==='backup'&&marker.complete)candidates.push({folder,at:marker.createdAt});}catch{}}
 candidates.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 for(const item of candidates)try{return await verifyBackup(item.folder,{recent:true});}catch{}
 throw Error('OPS_RECENT_BACKUP_REQUIRED');
}
export async function registerRelease({root,name,apply=false}={}){
 if(!root||!name||path.basename(name)!==name||name==='.'||name==='..')throw Error('OPS_INVALID_RELEASE_NAME');
 const base=await fs.realpath(root),folder=path.join(base,name),stat=await fs.lstat(folder);
 if(stat.isSymbolicLink()||!stat.isDirectory()||await fs.realpath(folder)!==folder||!inside(base,folder))throw Error('OPS_INVALID_RELEASE_PATH');
 if(!(await fs.stat(path.join(folder,'api','server','package.json'))).isFile())throw Error('OPS_NOT_A_RELEASE');
 if(!apply)return {mode:'preview',name,register:true};
 await fs.writeFile(path.join(folder,MARKER),JSON.stringify({version:1,kind:'release',complete:true,createdAt:stat.birthtime.toISOString()}),{flag:'wx',mode:0o600});
 return {mode:'apply',name,registered:true};
}

// 현재 프로젝트는 RDS 자동 백업 1일과 EC2의 별도 덤프 보관을 함께 사용한다.
export function rdsRecoverySummary(result,now=new Date()){
 const hours=result.latestRestorable?(+now-Date.parse(result.latestRestorable))/3600000:null;
 return {...result,recommendedRetentionDays:1,retentionOk:Number(result.retention)>=1,pitrAvailable:hours!==null&&hours>=0&&hours<=24,restorePointAgeHours:hours};
}
