// All writes and cleanup are restricted to unique disposable databases on local MySQL.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
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
  const expected = await definition(fresh); assert.equal(Object.keys(expected).length, 31);
  assert.deepEqual(await definition(replay), expected); assert.deepEqual(await definition(legacy), expected);
  await assert.rejects(run(['setup-db.mjs', '--existing-empty'], {MYSQL_DATABASE: fresh}), /subprocess failed/);
  assert.deepEqual(await definition(fresh), expected);
  await migrate(fresh); assert.deepEqual(await definition(fresh), expected);
  await db.query('USE `' + fresh + '`');
  const [history] = await db.query('SELECT version,success FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank');
  assert.deepEqual(history.map(r => [r.version, Number(r.success)]), [['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1]]);
  console.log('PASS: fresh db:setup, refusal to reset populated DB, fresh migrate, V1 baseline→V2, repeated migrate and Flyway history (31 business tables).');
  await importBank(db); console.log('Certificate seed:', JSON.stringify(await importCertificates(db)));
  await run(['--test', '--test-concurrency=1', 'test.mjs', 'db-test.mjs', 'auth-test.mjs',
    '../mysql/account-test.mjs', '../mysql/record-test.mjs', '../mysql/certificate-test.mjs',
    '../mysql/migrate.test.mjs', '../mysql/features-test.mjs', '../mysql/speed-test.mjs', '../mysql/battle-test.mjs', '../../app/tests/mysql-mode.test.mjs', '../../app/tests/catalog.test.mjs', '../../app/tests/quest-time.test.mjs'], {MYSQL_DATABASE: fresh});
} finally {
  for (const name of made) {
    assert(name.startsWith(prefix + '_') && /^[a-z0-9_]+$/.test(name));
    await db.query('DROP DATABASE `' + name + '`');
  }
  await db.end(); console.log('Only disposable validation databases removed. Configured service DB and RDS unchanged.');
}
