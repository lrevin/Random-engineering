// 운영 전용 CLI. 기본값은 미리보기이며 --apply 없이 데이터·파일을 삭제하지 않는다.
import {pathToFileURL} from 'node:url';
import {runMaintenance,databaseUsage} from './operations-service.mjs';
import {createBackup,fileRetention,diskUsage,rdsBackupStatus,restoreCheck,latestVerifiedBackup,registerRelease,folderSize} from './operations-files.mjs';
import {safeError} from '../server/db.mjs';
export function parseOperations(argv){
 const action=argv[0];if(!['maintenance','backup','files','audit','restore','register-release'].includes(action))throw Error('OPS_INVALID_ACTION');
 const out={action,apply:false,limit:200};
 const values=new Set(['limit','root','kind','current','source','service-config','environment-file','s3','backup','restore-port','restore-user','mysql-tool','dump-tool','rds-id','backup-dir','name']);
 for(let i=1;i<argv.length;i++){const flag=argv[i];if(flag==='--apply'){out.apply=true;continue;}if(!flag.startsWith('--')||!values.has(flag.slice(2))||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('OPS_INVALID_ARGUMENT');out[flag.slice(2)]=argv[++i];}
 out.limit=Number(out.limit);if(!Number.isInteger(out.limit)||out.limit<1||out.limit>1000)throw Error('OPS_INVALID_LIMIT');return out;
}
export async function main(argv=process.argv.slice(2)){
 const o=parseOperations(argv),e=process.env;
 if(o.action==='maintenance'){if(o.apply){if(o['backup-dir']){const {verifyBackup}=await import('./operations-files.mjs');await verifyBackup(o['backup-dir'],{recent:true});}else await latestVerifiedBackup(e.OPS_BACKUP_ROOT);}return runMaintenance({apply:o.apply,limit:o.limit});}
 if(o.action==='register-release')return registerRelease({root:o.root,name:o.name,apply:o.apply});
 if(o.action==='backup'){const result=await createBackup({root:o.root??e.OPS_BACKUP_ROOT,source:o.source??e.OPS_SOURCE_ROOT,serviceConfig:o['service-config']??e.OPS_SERVICE_CONFIG,environmentFile:o['environment-file']??e.OPS_ENV_FILE,s3:o.s3??e.OPS_BACKUP_S3,apply:o.apply,dumpTool:o['dump-tool']??e.OPS_MYSQLDUMP??'mysqldump'});if(o.apply)result.retention=await fileRetention({root:o.root??e.OPS_BACKUP_ROOT,kind:'backup',apply:true});return result;}
 if(o.action==='files')return fileRetention({root:o.root,kind:o.kind,current:o.current,apply:o.apply});
 if(o.action==='restore')return restoreCheck({backup:o.backup,port:Number(o['restore-port']),user:o['restore-user'],password:e.OPS_RESTORE_PASSWORD??'',mysqlTool:o['mysql-tool']??'mysql',apply:o.apply});
 const root=o.root??e.OPS_SOURCE_ROOT??process.cwd(),db=await databaseUsage(),disk=await diskUsage(root),rdsId=o['rds-id']??e.OPS_RDS_ID;
 const backups=e.OPS_BACKUP_ROOT?{totalBytes:await folderSize(e.OPS_BACKUP_ROOT),retention:await fileRetention({root:e.OPS_BACKUP_ROOT,kind:'backup'})}:{checked:false,reason:'not_configured'};
 return {mode:'read-only',at:new Date().toISOString(),database:db,disk,backups,rds:rdsId?await rdsBackupStatus(rdsId):{checked:false,reason:'not_configured'}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const started=Date.now();main().then(result=>{console.log(JSON.stringify({event:'operations_complete',elapsedMs:Date.now()-started,...result}));if(result.disk?.level==='action'||result.rds?.retentionOk===false||result.rds?.pitrAvailable===false)process.exitCode=2;}).catch(error=>{console.error(JSON.stringify({event:'operations_failed',elapsedMs:Date.now()-started,completed:error.operationsCompleted??[],error:safeError(error).startsWith('OPS_')?safeError(error):error.message?.startsWith('OPS_')?error.message:safeError(error)}));process.exitCode=1;});
}
