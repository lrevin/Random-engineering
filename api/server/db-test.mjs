import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { connect, transaction } from './db.mjs';
import { importBank, sourceFiles } from './import-bank.mjs';
import { loadCatalog } from './catalog.mjs';
import { loadBank, rowsFor, hash } from '../shared/question-store.mjs';
import { databaseStore } from './db-store.mjs';
import { createServer } from './server.mjs';

// Real MySQL integration tests, never an in-memory substitute. Import persists;
// account/record/XP fixtures run in a transaction that is always rolled back.
test('MySQL schema, direct import, HTTP reads, constraints and transactions', async t => {
  const db = await connect();
  t.after(() => db.end());
  const [[version]] = await db.query('SELECT VERSION() AS version');
  assert.match(version.version, /^8\./);
  t.diagnostic(`MySQL ${version.version}`);
  const catalog = loadCatalog(), files = sourceFiles(), source = loadBank();
  const expectedRows = rowsFor(source);

  await t.test('all 19 V2 tables exist; removed study columns are absent', async () => {
    const [tables] = await db.query('SHOW TABLES');
    assert.equal(tables.length, 19);
    const [columns] = await db.query('SHOW COLUMNS FROM study_records');
    for (const name of ['verification_status','quiz_source','xp_rule_version','wrong']) {
      assert.ok(!columns.some(c => c.Field === name), name);
    }
    const [fks] = await db.query(`SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE CONSTRAINT_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='topics'
      AND TABLE_NAME IN ('questions','question_file_topics')`);
    assert.equal(fks.length, 2);
  });

  await t.test('imports original JSON directly into MySQL; rerun adds no duplicate rows', async () => {
    const first = await importBank(db, { files, catalog });
    assert.equal(first.questions, expectedRows.length);
    const second = await importBank(db, { files, catalog });
    assert.equal(second.inserted, 0);
    for (const [table, count] of [['domains',catalog.domains.length],['categories',catalog.categories.length],
      ['topics',catalog.topics.length],['questions',expectedRows.length],['question_details',expectedRows.length]]) {
      const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
      assert.equal(Number(row.n), count, table);
    }
    const [[links]] = await db.query(`SELECT COUNT(*) AS n FROM question_file_items i JOIN question_files f ON f.id=i.file_id WHERE f.status='published'`);
    assert.equal(Number(links.n), expectedRows.length);
  });

  await t.test('every imported question matches source JSON through MySQL reader', async () => {
    const store = databaseStore(db);
    for (const [topicId, qs] of Object.entries(source)) {
      const actual = await store.questions(topicId);
      assert.deepEqual(actual.map(hash).sort(), qs.map(hash).sort(), topicId);
    }
    const empty = catalog.topics.find(x => !source[x.id]);
    assert.deepEqual(await store.questions(empty.id), []);
    assert.equal(await store.questions('unknown-topic'), null);
  });

  await t.test('HTTP endpoint reads actual MySQL data, ETag works', async () => {
    const server = createServer({ store:databaseStore(db) });
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const health = await (await fetch(`${base}/health`)).json();
      assert.equal(health.storage,'mysql');
      const topicId = Object.keys(source)[0];
      const response = await fetch(`${base}/api/quiz-bank/${topicId}`);
      assert.equal(response.status,200);
      assert.equal((await response.json()).questions.length, source[topicId].length);
      assert.equal((await fetch(`${base}/quiz-bank/${topicId}`,{headers:{'If-None-Match':response.headers.get('etag')}})).status,304);
      assert.equal((await fetch(`${base}/quiz-bank/unknown-topic`)).status,404);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });

  await t.test('a failed import rolls back the entire file and all inserted questions', async () => {
    const key = `__test__/${randomUUID()}`;
    const topicId = Object.keys(source)[0];
    const fresh = rowsFor({ [topicId]:[{ ...source[topicId][0], explain:'트랜잭션 롤백 검증용 해설입니다.' }] })[0];
    const invalid = { ...fresh,id:randomUUID(),topicId:'missing-parent' };
    await assert.rejects(importBank(db,{catalog,files:[{key,sha:Buffer.alloc(32,2),topics:{[topicId]:[source[topicId][0]]},count:2,rows:[fresh,invalid]}]}),e=>e.code==='ER_NO_REFERENCED_ROW_2');
    const [[f]] = await db.execute('SELECT COUNT(*) AS n FROM question_files WHERE storage_key=?',[key]);
    const [[q]] = await db.execute('SELECT COUNT(*) AS n FROM questions WHERE id=?',[fresh.id]);
    assert.equal(Number(f.n),0); assert.equal(Number(q.n),0);
  });

  await t.test('actual FK/CHECK/UNIQUE enforcement, memo sequence and XP deletion transaction', async () => {
    await db.beginTransaction();
    try {
      const user = randomUUID(), attempt = randomUUID(), record = randomUUID(), award = randomUUID();
      const topic = catalog.topics.find(x => source[x.id]);
      const category = catalog.categories.find(c=>c.id===topic.categoryId);
      await db.execute('INSERT INTO users(id) VALUES (?)',[user]);
      await assert.rejects(db.execute("UPDATE users SET status='deleting' WHERE id=?",[user]), e=>e.code==='ER_CHECK_CONSTRAINT_VIOLATED');
      await db.execute('INSERT INTO user_sync_states(user_id) VALUES (?)',[user]);
      await assert.rejects(db.execute("INSERT INTO profiles(user_id,nickname,interests,reminder_time) VALUES (?,'tester',JSON_ARRAY(),'25:00')",[user]),e=>e.code==='ER_CHECK_CONSTRAINT_VIOLATED');
      await db.execute("INSERT INTO profiles(user_id,nickname,interests) VALUES (?,'검증 사용자',JSON_ARRAY())",[user]);
      await assert.rejects(db.execute("INSERT INTO questions(id,topic_id,source,content_hash) VALUES (?,'missing-parent','bank',?)",[randomUUID(),Buffer.alloc(32)]),e=>e.code==='ER_NO_REFERENCED_ROW_2');
      const qid = randomUUID();
      await db.execute("INSERT INTO questions(id,topic_id,source,content_hash) VALUES (?,?,'bank',?)",[qid,topic.id,Buffer.alloc(32,7)]);
      await assert.rejects(db.execute("INSERT INTO question_details(question_id,type,body,choices,answer,explanation) VALUES (?,'mc','질문',JSON_ARRAY('가','나','다','라'),'4','해설')",[qid]),e=>e.code==='ER_CHECK_CONSTRAINT_VIOLATED');
      await db.execute("INSERT INTO question_details(question_id,type,body,answer,explanation) VALUES (?,'ox','질문','false','해설')",[qid]);
      await db.execute("INSERT INTO quiz_attempts(id,user_id,topic_id,status,verification_status,started_at,completed_at) VALUES (?,?,?,'completed','client_reported',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[attempt,user,topic.id]);
      for (let i=1;i<=7;i++) await db.execute('INSERT INTO quiz_attempt_items(attempt_id,position,question_snapshot,submitted_answer,is_correct) VALUES (?,?,?,?,1)',[attempt,i,JSON.stringify(source[topic.id][i-1]),'0']);
      await assert.rejects(db.execute('INSERT INTO quiz_attempt_items(attempt_id,position,question_snapshot) VALUES (?,8,JSON_OBJECT())',[attempt]),e=>e.code==='ER_CHECK_CONSTRAINT_VIOLATED');
      const values = [record,user,attempt,topic.id,topic.name,category.domainId,category.id,topic.difficulty,'최초 메모',7,102,900,Buffer.alloc(32,1)];
      const insert = `INSERT INTO study_records(id,user_id,attempt_id,topic_id,topic_ko,domain,category,difficulty,memo,score,rp,study_sec,submission_hash,studied_at,study_date,time_validation_status,change_seq,received_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),UTC_DATE(),'accepted',1,UTC_TIMESTAMP(3))`;
      await db.execute(insert,values);
      await assert.rejects(db.execute(insert,[randomUUID(),...values.slice(1)]),e=>e.code==='ER_DUP_ENTRY');
      await assert.rejects(db.execute('UPDATE study_records SET score=8 WHERE id=?',[record]),e=>e.code==='ER_CHECK_CONSTRAINT_VIOLATED');
      await assert.rejects(db.execute('UPDATE study_records SET memo=? WHERE id=?',['x'.repeat(5001),record]),e=>e.code==='ER_CHECK_CONSTRAINT_VIOLATED');
      await db.execute('UPDATE user_sync_states SET last_change_seq=1 WHERE user_id=?',[user]);
      const [[state]] = await db.execute('SELECT last_change_seq FROM user_sync_states WHERE user_id=? FOR UPDATE',[user]);
      assert.equal(Number(state.last_change_seq),1);
      const [memo] = await db.execute('UPDATE study_records SET memo=?,change_seq=2 WHERE id=? AND change_seq=1',['새 메모',record]);
      assert.equal(memo.affectedRows,1);
      const [conflict] = await db.execute('UPDATE study_records SET memo=?,change_seq=3 WHERE id=? AND change_seq=1',['오래된 수정',record]);
      assert.equal(conflict.affectedRows,0);
      const awardSql = "INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,rule_version,verification_status,calculation_details,idempotency_key) VALUES (?,?,?,?,'award',102,'test-v1','client_reported',JSON_OBJECT('base',63),?)";
      await db.execute(awardSql,[award,user,record,topic.id,`award:${record}`]);
      await assert.rejects(db.execute(awardSql,[randomUUID(),user,record,topic.id,`retry:${record}`]),e=>e.code==='ER_DUP_ENTRY');
      await assert.rejects(db.execute('DELETE FROM quiz_attempts WHERE id=?',[attempt]),e=>e.code==='ER_ROW_IS_REFERENCED_2');
      await db.execute('DELETE FROM study_records WHERE id=?',[record]);
      await db.execute('DELETE FROM quiz_attempt_items WHERE attempt_id=?',[attempt]);
      await db.execute("INSERT INTO xp_ledger(id,user_id,source_record_id,topic_id,event_type,amount,reverses_entry_id,rule_version,verification_status,calculation_details,idempotency_key) VALUES (?,?,?,?,'reversal',-102,?,'test-v1','client_reported',JSON_OBJECT(),?)",[randomUUID(),user,record,topic.id,award,`reversal:${record}`]);
      await db.execute('INSERT INTO study_record_tombstones(user_id,record_id,change_seq,deleted_at,expires_at) VALUES (?,?,3,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 90 DAY))',[user,record]);
      await db.execute('UPDATE user_sync_states SET last_change_seq=3 WHERE user_id=?',[user]);
      const [[total]] = await db.execute('SELECT SUM(amount) AS n FROM xp_ledger WHERE user_id=?',[user]);
      assert.equal(Number(total.n),0);
      const [[kept]] = await db.execute('SELECT status FROM quiz_attempts WHERE id=?',[attempt]);
      assert.equal(kept.status,'completed');
      const [[tomb]] = await db.execute('SELECT change_seq FROM study_record_tombstones WHERE user_id=? AND record_id=?',[user,record]);
      assert.equal(Number(tomb.change_seq),3);
      // Explicit account deletion order; completion markers last only until account deletion.
      await db.execute('DELETE FROM quiz_attempts WHERE user_id=?',[user]);
      await db.execute('DELETE FROM study_record_tombstones WHERE user_id=?',[user]);
      await db.execute('DELETE FROM xp_ledger WHERE user_id=?',[user]);
      await db.execute('DELETE FROM users WHERE id=?',[user]);
      const [[gone]] = await db.execute('SELECT COUNT(*) AS n FROM profiles WHERE user_id=?',[user]);
      assert.equal(Number(gone.n),0);
    } finally { await db.rollback(); }
  });

  await t.test('explicit transaction failure leaves no partial account', async () => {
    const id = randomUUID();
    await assert.rejects(transaction(db,async()=>{
      await db.execute('INSERT INTO users(id) VALUES (?)',[id]);
      throw new Error('forced rollback');
    }), /forced rollback/);
    const [[row]] = await db.execute('SELECT COUNT(*) AS n FROM users WHERE id=?',[id]);
    assert.equal(Number(row.n),0);
  });
});
