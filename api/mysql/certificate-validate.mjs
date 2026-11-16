// All writes and cleanup are restricted to unique disposable databases on local MySQL.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {connect} from '../server/db.mjs';
import {checkFlyway, runFlyway} from './migrate.mjs';
import {importBank} from '../server/import-bank.mjs';
import {importCertificates} from '../server/import-certificates.mjs';

if (!['localhost', '127.0.0.1'].includes(process.env.MYSQL_HOST || '127.0.0.1')) {
  throw new Error('Validation requires local MySQL; service RDS is never modified.');
}
await checkFlyway();
const db = await connect({database: false});
const made = [], prefix = 'ppobgong_verify_' + randomBytes(5).toString('hex');
async function create(suffix) {
  const name = prefix + '_' + suffix;
  assert(/^[a-z0-9_]+$/.test(name));
  await db.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
  made.push(name); return name;
}
async function definition(name) {
  await db.query('USE `' + name + '`');
  const [tables] = await db.query('SHOW TABLES'), definitions = {};
  for (const row of tables) {
    const table = Object.values(row)[0]; if (table === 'flyway_schema_history') continue;
    const [[r]] = await db.query('SHOW CREATE TABLE `' + table + '`');
    definitions[table] = r['Create Table'];
  }
  return definitions;
}
async function run(args, env = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {cwd: fileURLToPath(new URL('../server/', import.meta.url)),
      env: {...process.env, ...env}, stdio: 'inherit', windowsHide: true});
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Validation subprocess failed: ' + code)));
  });
}
async function migrate(name) {
  await runFlyway('migrate', {database: name}); await runFlyway('validate', {database: name});
}
try {
  const fresh = await create('fresh'), replay = await create('replay'), legacy = await create('legacy');
  // Validate the real db:setup entry point as well as direct migration commands.
  await run(['setup-db.mjs', '--existing-empty'], {MYSQL_DATABASE: fresh});
  await migrate(replay);
  await db.query('USE `' + legacy + '`');
  // Test fixture only: represent a pre-Flyway DB whose structure is exactly V1.
  const sql = fs.readFileSync(new URL('./migrations/V1__initial_schema.sql', import.meta.url), 'utf8').replace(/^\s*--.*$/gm, '');
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
  await runFlyway('baseline', {database: legacy, baselineVersion: '1'}); await migrate(legacy);
  const expected = await definition(fresh); assert.equal(Object.keys(expected).length, 36);
  assert.deepEqual(await definition(replay), expected); assert.deepEqual(await definition(legacy), expected);
  await assert.rejects(run(['setup-db.mjs', '--existing-empty'], {MYSQL_DATABASE: fresh}), /subprocess failed/);
  assert.deepEqual(await definition(fresh), expected);
  await migrate(fresh); assert.deepEqual(await definition(fresh), expected);
  await db.query('USE `' + fresh + '`');
  const [history] = await db.query('SELECT version,success FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank');
  assert.deepEqual(history.map(r => [r.version, Number(r.success)]), Array.from({length:8},(_,i)=>[String(i+1),1]));
  // V7 운영 형태의 기존 회원·구매·일반/배틀 풀이를 보존하며 V8로 올린다.
  const upgrade=await create('v7data'),oldTarget=process.env.FLYWAY_TARGET;
  process.env.FLYWAY_TARGET='7';
  try{await migrate(upgrade);}finally{if(oldTarget===undefined)delete process.env.FLYWAY_TARGET;else process.env.FLYWAY_TARGET=oldTarget;}
  await db.query('USE `'+upgrade+'`');
  const owner=randomUUID();await db.execute('INSERT INTO users(id) VALUES (?)',[owner]);
  await db.execute("INSERT INTO domains(id,name_ko) VALUES ('upgrade-domain','검증 분야')");
  await db.execute("INSERT INTO categories(id,domain_id,name_ko) VALUES ('upgrade-category','upgrade-domain','검증 분류')");
  await db.execute("INSERT INTO topics(id,category_id,name_ko,difficulty) VALUES ('upgrade-topic','upgrade-category','검증 주제',1)");
  await db.execute('INSERT INTO wallets(user_id,balance) VALUES (?,123)',[owner]);
  await db.execute("INSERT INTO member_assets(user_id,exam_tickets,boost_until) VALUES (?,3,'2026-12-01 00:00:00.000')",[owner]);
  await db.execute("INSERT INTO member_cosmetics(user_id,item_type,item_id,is_equipped,acquired_via) VALUES (?,'skin','sunset',1,'purchase')",[owner]);
  const attemptIds=[];
  for(const [i,type]of ['study','battle'].entries()){
    const attempt=randomUUID();attemptIds.push(attempt);
    await db.execute("INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,completed_at) VALUES (?,?,'upgrade-topic','completed','server_verified',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[attempt,owner]);
    for(let position=1;position<=7;position++)await db.execute("INSERT INTO quiz_attempt_items(attempt_id,position,question_snapshot,submitted_answer,is_correct) VALUES (?,?,JSON_OBJECT('type','ox','q','검증 문제','answer',TRUE,'explain','검증 해설'),'true',1)",[attempt,position]);
    await db.execute("INSERT INTO study_records(id,user_id,attempt_id,topic_id,topic_ko,domain,category,difficulty,memo,score,quiz_total,rp,study_sec,studied_at,study_date,time_validation_status,submission_hash,change_seq,received_at,study_type) VALUES (?,?,?,'upgrade-topic','검증 주제','upgrade-domain','upgrade-category',1,'기존 기록',7,7,10,60,UTC_TIMESTAMP(3),UTC_DATE(),'accepted',?, ?,UTC_TIMESTAMP(3),?)",[randomUUID(),owner,attempt,Buffer.alloc(32,i+1),i+1,type]);
  }
  await db.execute("INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,rule_version,verification_status,calculation_details,idempotency_key,source_type) SELECT UUID(),user_id,id,topic_id,'award',rp,'rp-v1','server_verified',JSON_OBJECT('parts',JSON_ARRAY()),CONCAT('upgrade:',id),study_type FROM study_records WHERE user_id=?",[owner]);
  await migrate(upgrade);await db.query('USE `'+upgrade+'`');
  const [attempts]=await db.execute('SELECT purpose,rule_version FROM quiz_attempts WHERE user_id=? ORDER BY purpose',[owner]);assert.deepEqual(attempts.map(a=>[a.purpose,a.rule_version]),[['battle','legacy'],['study','legacy']]);
  const [[items]]=await db.execute("SELECT COUNT(*) AS n FROM quiz_attempt_items WHERE topic_id='upgrade-topic'");assert.equal(Number(items.n),14);
  const [[asset]]=await db.execute('SELECT exam_tickets,boost_until FROM member_assets WHERE user_id=?',[owner]);assert.equal(Number(asset.exam_tickets),3);assert.equal(new Date(asset.boost_until.replace(' ','T')+'Z').toISOString(),'2026-12-01T00:00:00.000Z');
  const [[wallet]]=await db.execute('SELECT balance FROM wallets WHERE user_id=?',[owner]);assert.equal(Number(wallet.balance),123);
  const [[cosmetic]]=await db.execute("SELECT is_equipped FROM member_cosmetics WHERE user_id=? AND item_id='sunset'",[owner]);assert.equal(Number(cosmetic.is_equipped),1);
  const [[visible]]=await db.execute('SELECT COUNT(*) AS n FROM study_records WHERE user_id=? AND hidden_at IS NULL',[owner]);assert.equal(Number(visible.n),2);
  const [[granted]]=await db.execute("SELECT COUNT(*) AS n,SUM(rp) AS xp FROM study_records WHERE user_id=? AND reward_status='legacy_granted'",[owner]);assert.equal(Number(granted.n),2);assert.equal(Number(granted.xp),20);
  const [[ledger]]=await db.execute('SELECT SUM(amount) AS n FROM xp_ledger WHERE user_id=?',[owner]);assert.equal(Number(ledger.n),20);
  await migrate(upgrade);console.log('PASS: V7 회원·지갑·구매권·부스터·장착·기존 풀이 보존 및 V8 분류/주제 보완·반복 적용');
  console.log('PASS: fresh db:setup, refusal to reset populated DB, fresh migrate, V1 baseline→V2, repeated migrate and Flyway history (36 business tables).');
  await db.query('USE `'+fresh+'`');
  await importBank(db); console.log('Certificate seed:', JSON.stringify(await importCertificates(db)));
  await run(['--test', '--test-concurrency=1', 'test.mjs', 'db-test.mjs', 'auth-test.mjs',
    '../mysql/account-test.mjs', '../mysql/record-test.mjs', '../mysql/certificate-test.mjs',
    '../mysql/migrate.test.mjs', '../mysql/features-test.mjs', '../mysql/speed-test.mjs', '../mysql/battle-test.mjs', '../mysql/purchase-test.mjs', '../mysql/special-reward-test.mjs', '../mysql/general-reward-test.mjs', '../../app/tests/mysql-mode.test.mjs', '../../app/tests/catalog.test.mjs', '../../app/tests/quest-time.test.mjs'], {MYSQL_DATABASE: fresh});
} finally {
  for (const name of made) {
    assert(name.startsWith(prefix + '_') && /^[a-z0-9_]+$/.test(name));
    await db.query('DROP DATABASE `' + name + '`');
  }
  await db.end(); console.log('Only disposable validation databases removed. Configured service DB and RDS unchanged.');
}
