// Creates only uniquely named disposable databases, leaving the configured service DB unchanged.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {connect} from '../server/db.mjs';
import {importBank} from '../server/import-bank.mjs';
import {importCertificates} from '../server/import-certificates.mjs';
const db=await connect({database:false}),made=[],prefix='ppobgong_cert_test_'+randomBytes(5).toString('hex');
const base=fileURLToPath(new URL('./',import.meta.url));
async function create(suffix){const name=prefix+'_'+suffix;await db.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');made.push(name);return name;}
async function apply(name,file){await db.query('USE `'+name+'`');const sql=fs.readFileSync(new URL(file,import.meta.url),'utf8').replace(/^\s*--.*$/gm,'');for(const stmt of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(stmt);}
async function definition(name){await db.query('USE `'+name+'`');const [tables]=await db.query('SHOW TABLES');const definitions={};for(const row of tables){const table=Object.values(row)[0];if(table==='flyway_schema_history')continue;const [[r]]=await db.query('SHOW CREATE TABLE `'+table+'`');definitions[table]=r['Create Table'];}return definitions;}
async function run(command,args,env={},cwd=base){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:'inherit',shell:command.endsWith('.cmd')});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Validation command exited '+code)));});}
const flyway=process.env.FLYWAY_EXECUTABLE;
async function migrate(name,baseline=false){
 if(!flyway){if(!baseline)await apply(name,'./migrations/V1__initial_schema.sql');await apply(name,'./migrations/V2__add_certificates.sql');return;}
 const env={FLYWAY_URL:'jdbc:mysql://'+(process.env.MYSQL_HOST||'127.0.0.1')+':'+(process.env.MYSQL_PORT||3306)+'/'+name+'?serverTimezone=UTC',FLYWAY_USER:process.env.MYSQL_USER,FLYWAY_PASSWORD:process.env.MYSQL_PASSWORD||'',FLYWAY_CLEAN_DISABLED:'true'};
 if(process.env.MYSQL_SSL_CA)env.FLYWAY_URL+='&sslMode=VERIFY_IDENTITY&serverSslCert='+encodeURIComponent(process.env.MYSQL_SSL_CA);
 if(baseline)await run(flyway,['baseline'],env);
 await run(flyway,['migrate'],env);await run(flyway,['validate'],env);
}
try{
 const migrated=await create('migrate'),snapshot=await create('snapshot'),baseline=await create('baseline');
 await migrate(migrated);await apply(snapshot,'./schema-v2.sql');await apply(baseline,'./migrations/V1__initial_schema.sql');await migrate(baseline,true);
 const expected=await definition(snapshot);assert.equal(Object.keys(expected).length,25);assert.deepEqual(await definition(migrated),expected);assert.deepEqual(await definition(baseline),expected);
 console.log('PASS: V1→V2, latest snapshot and existing V1→V2 each have identical 25 business tables. Flyway CLI used: '+!!flyway);
 await db.query('USE `'+migrated+'`');await importBank(db);console.log('Certificate seed:',JSON.stringify(await importCertificates(db)));
 await run(process.execPath,['--test','test.mjs','db-test.mjs','auth-test.mjs','../mysql/account-test.mjs','../mysql/record-test.mjs','../mysql/certificate-test.mjs','../../app/tests/mysql-mode.test.mjs'],{MYSQL_DATABASE:migrated},fileURLToPath(new URL('../server/',import.meta.url)));
}finally{
 for(const name of made){assert(name.startsWith(prefix+'_'));await db.query('DROP DATABASE `'+name+'`');}
 await db.end();console.log('All databases created by this validation were removed. Configured service DB unchanged.');
}
