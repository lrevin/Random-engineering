import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { BANK_DIR, loadBank, rowsFor } from '../shared/question-store.mjs';
import { connect, transaction, safeError } from './db.mjs';
import { loadCatalog } from './catalog.mjs';

export function sourceFiles() {
  // Full validation happens before the first DB write.
  const bank = loadBank();
  const files = fs.readdirSync(BANK_DIR).filter(f => f.endsWith('.json')).sort().map(name => {
    const bytes = fs.readFileSync(path.join(BANK_DIR, name));
    const topics = JSON.parse(bytes.toString('utf8'));
    return { key: `app/src/data/quizbank/${name}`, sha: createHash('sha256').update(bytes).digest(), topics,
      rows: rowsFor(topics), count: Object.values(topics).reduce((n, qs) => n + qs.length, 0) };
  });
  if (files.reduce((n, f) => n + f.count, 0) !== rowsFor(bank).length) throw new Error('source changed during validation');
  return files;
}

async function masters(db, catalog) {
  // Reimport is safe for matching masters; changed definitions require an explicit update.
  for (const d of catalog.domains) {
    const [[old]] = await db.execute('SELECT name_ko FROM domains WHERE id=?', [d.id]);
    if (old && old.name_ko !== d.name) throw new Error('domain conflict');
    if (!old) await db.execute('INSERT INTO domains(id,name_ko) VALUES (?,?)', [d.id,d.name]);
  }
  for (const c of catalog.categories) {
    const [[old]] = await db.execute('SELECT domain_id,name_ko FROM categories WHERE id=?', [c.id]);
    if (old && (old.domain_id !== c.domainId || old.name_ko !== c.name)) throw new Error('category conflict');
    if (!old) await db.execute('INSERT INTO categories(id,domain_id,name_ko) VALUES (?,?,?)', [c.id,c.domainId,c.name]);
  }
  for (const t of catalog.topics) {
    const [[old]] = await db.execute('SELECT category_id,name_ko,difficulty FROM topics WHERE id=?', [t.id]);
    if (old && (old.category_id !== t.categoryId || old.name_ko !== t.name || old.difficulty !== t.difficulty)) throw new Error('topic conflict');
    if (!old) await db.execute('INSERT INTO topics(id,category_id,name_ko,difficulty) VALUES (?,?,?,?)', [t.id,t.categoryId,t.name,t.difficulty]);
  }
}

export async function importBank(db, { files = sourceFiles(), catalog = loadCatalog() } = {}) {
  if (!files.length) throw new Error('empty import is not allowed');
  const [[lock]] = await db.query("SELECT GET_LOCK(SHA2(CONCAT(DATABASE(), ':question_import'),256), 30) AS acquired");
  if (Number(lock.acquired) !== 1) throw new Error('import lock unavailable');
  try {
    return await transaction(db, async () => {
      await masters(db, catalog);
      let inserted = 0, reused = 0;
      for (const file of files) {
        const [[prior]] = await db.execute('SELECT id FROM question_files WHERE storage_key=? AND sha256=?', [file.key,file.sha]);
        const fileId = prior?.id ?? randomUUID();
        if (!prior) {
          await db.execute("INSERT INTO question_files(id,source,storage_key,sha256,status,question_count) VALUES (?,'bank',?,?,'draft',?)", [fileId,file.key,file.sha,file.count]);
          for (const [topicId, qs] of Object.entries(file.topics)) {
            await db.execute('INSERT INTO question_file_topics(file_id,topic_id,question_count) VALUES (?,?,?)', [fileId,topicId,qs.length]);
          }
          const positions = new Map();
          for (const row of file.rows) {
            const digest = Buffer.from(row.contentHash, 'hex');
            const [[existing]] = await db.execute('SELECT topic_id,source,content_hash FROM questions WHERE id=?', [row.id]);
            if (existing) {
              if (existing.topic_id !== row.topicId || existing.source !== row.source || !existing.content_hash.equals(digest)) throw new Error('question identity conflict');
              const [[detail]] = await db.execute('SELECT question_id FROM question_details WHERE question_id=?', [row.id]);
              if (!detail) throw new Error('question detail missing');
              reused++;
            } else {
              await db.execute("INSERT INTO questions(id,topic_id,source,status,content_hash) VALUES (?,?,?,'published',?)", [row.id,row.topicId,row.source,digest]);
              await db.execute('INSERT INTO question_details(question_id,type,body,choices,answer,explanation,model) VALUES (?,?,?,?,?,?,NULL)',
                [row.id,row.type,row.body,row.choices === null ? null : JSON.stringify(row.choices),JSON.stringify(row.answer),row.explanation]);
              inserted++;
            }
            const position = (positions.get(row.topicId) ?? 0) + 1;
            positions.set(row.topicId, position);
            await db.execute('INSERT INTO question_file_items(file_id,topic_id,position,question_id) VALUES (?,?,?,?)', [fileId,row.topicId,position,row.id]);
          }
        } else reused += file.count;
        // Version switch happens only when every file is valid, in this transaction.
        await db.execute("UPDATE question_files SET status='disabled' WHERE storage_key=? AND id<>? AND status='published'", [file.key,fileId]);
        await db.execute("UPDATE question_files SET status='published' WHERE id=?", [fileId]);
      }
      // Removed source files stop serving, but their version/location history stays.
      await db.execute(`UPDATE question_files SET status='disabled' WHERE source='bank'
        AND storage_key LIKE 'app/src/data/quizbank/%' AND storage_key NOT IN (${files.map(()=>'?').join(',')})`,files.map(f=>f.key));
      return { files: files.length, questions: files.reduce((n,f) => n+f.count,0), inserted, reused,
        domains: catalog.domains.length, categories: catalog.categories.length, topics: catalog.topics.length };
    });
  } finally { await db.query("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(), ':question_import'),256))"); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let db;
  try { const files = sourceFiles(), catalog = loadCatalog(); db = await connect(); console.log(JSON.stringify(await importBank(db, { files, catalog }))); }
  catch (error) { console.error(`Import failed: ${safeError(error)}`); process.exitCode=1; }
  finally { await db?.end(); }
}
