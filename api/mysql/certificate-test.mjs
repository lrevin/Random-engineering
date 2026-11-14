import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {connect} from '../server/db.mjs';
import {importCertificates} from '../server/import-certificates.mjs';
import {createAuth} from '../server/auth.mjs';
import {createServer} from '../server/server.mjs';
import {databaseStore} from './question-service.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('./seeds/certificates.json',import.meta.url),'utf8'));
const ts=createRequire(new URL('../../app/package.json',import.meta.url))('typescript');
test('certificate catalog and mixed profile interests on real MySQL',async t=>{
 const db=await connect();t.after(()=>db.end());
 const counts=async()=>{const list=[];for(const table of ['certificates','certificate_subjects','certificate_subject_items']){const [[r]]=await db.query('SELECT COUNT(*) AS n FROM '+table);list.push(Number(r.n));}return list;};
 await t.test('seed preserves all current app certificate IDs, order and subject content',()=>{
  const exports={};const code=ts.transpileModule(fs.readFileSync(new URL('../../app/src/data/cert.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports});assert.deepEqual(seed,JSON.parse(JSON.stringify(exports.CERTS)));assert.equal(seed.length,10);
 });
 await t.test('import is repeatable and concurrent re-imports create no duplicates',async()=>{
  const before=await counts(),a=await connect(),b=await connect();
  try{await Promise.all([importCertificates(a),importCertificates(b)]);}finally{await a.end();await b.end();}
  assert.deepEqual(await counts(),before);assert.equal(before[0],10);
 });
 await t.test('every subject and category/topic mapping round-trips in source order',async()=>{
  const [certs]=await db.query('SELECT * FROM certificates ORDER BY display_order');
  for(const [i,c]of certs.entries()){
   assert.equal(c.id,seed[i].id);assert.equal(c.name_ko,seed[i].name);const [subjects]=await db.execute('SELECT * FROM certificate_subjects WHERE certificate_id=? ORDER BY display_order',[c.id]);
   for(const [j,s]of subjects.entries()){assert.equal(s.name_ko,seed[i].subjects[j].name);const [items]=await db.execute('SELECT * FROM certificate_subject_items WHERE subject_id=? ORDER BY position',[s.id]);assert.deepEqual(items.map(x=>x.category_id??x.topic_id),seed[i].subjects[j].items);}
  }
 });
 await t.test('unknown references are rejected before any certificate is inserted',async()=>{
  const before=await counts(),first={...structuredClone(seed[0]),id:'cert-test-valid'},last={...structuredClone(seed[1]),id:'cert-test-invalid'};last.subjects[0].items.push('does-not-exist');
  await assert.rejects(importCertificates(db,{certificates:[first,last]}),/unknown_or_ambiguous/);assert.deepEqual(await counts(),before);
 });
 await t.test('DB edits are not overwritten and disabled certificates are not reactivated',async()=>{
  const c=seed[0];await db.execute('UPDATE certificates SET name_ko=? WHERE id=?',['edited',c.id]);
  try{await assert.rejects(importCertificates(db),/certificate_seed_conflict/);const [[r]]=await db.execute('SELECT name_ko FROM certificates WHERE id=?',[c.id]);assert.equal(r.name_ko,'edited');}finally{await db.execute('UPDATE certificates SET name_ko=? WHERE id=?',[c.name,c.id]);}
  await db.execute('UPDATE certificates SET is_active=0 WHERE id=?',[c.id]);try{await importCertificates(db);const [[r]]=await db.execute('SELECT is_active FROM certificates WHERE id=?',[c.id]);assert.equal(r.is_active,0);}finally{await db.execute('UPDATE certificates SET is_active=1 WHERE id=?',[c.id]);}
 });
 await t.test('failure midway through a new certificate import rolls back all rows',async()=>{
  const before=await counts();let writes=0;const proxy=new Proxy(db,{get(target,key){if(key==='execute')return(sql,args)=>{if(sql.startsWith('INSERT INTO certificate_subject_items')&&++writes===3)throw new Error('forced certificate failure');return target.execute(sql,args);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  await assert.rejects(importCertificates(proxy,{certificates:[{...structuredClone(seed[0]),id:'cert-test-rollback'}]}),/forced certificate failure/);assert.deepEqual(await counts(),before);
 });
 await t.test('MySQL enforces exclusive mapping target, FK, position and uniqueness',async()=>{
  const [[subject]]=await db.query('SELECT id FROM certificate_subjects ORDER BY id LIMIT 1');
  for(const [position,category,topic] of [[65000,null,null],[65000,'ds','ds-01'],[65000,null,'missing-topic'],[0,'ds',null]])await assert.rejects(db.execute('INSERT INTO certificate_subject_items(subject_id,position,category_id,topic_id) VALUES (?,?,?,?)',[subject.id,position,category,topic]));
  const [[item]]=await db.execute('SELECT * FROM certificate_subject_items WHERE subject_id=? ORDER BY position LIMIT 1',[subject.id]);
  await assert.rejects(db.execute('INSERT INTO certificate_subject_items(subject_id,position,category_id,topic_id) VALUES (?,?,?,?)',[subject.id,item.position,item.category_id,item.topic_id]));
 });
 await t.test('actual app client saves mixed category/certificate interests; rejects unknown and inactive IDs',async()=>{
  const auth=createAuth({secret:randomBytes(48).toString('hex')}),server=createServer({store:databaseStore(db),auth});server.listen(0,'127.0.0.1');await once(server,'listening');
  const code=ts.transpileModule(fs.readFileSync(new URL('../../app/src/lib/auth-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('exports',code)(exports);
  const client=exports.createAuthClient('http://127.0.0.1:'+server.address().port,{read:async()=>null,write:async()=>{},remove:async()=>{}});let user;
  try{
   user=(await client.signUp('cert-'+randomUUID()+'@example.com','Cert-Test-42!')).user;
   const profile={nickname:'자격증 검증',interests:['ds',seed[0].id],level:1,studyMinutes:15,reminderEnabled:false,reminderTime:'21:00'};
   assert.deepEqual(await client.saveProfile(profile),profile);assert.deepEqual(await client.getProfile(),profile);
   // Onboarding may select certificates alone or every category plus every certificate.
   const certOnly={...profile,interests:seed.map(c=>c.id)};
   assert.deepEqual(await client.saveProfile(certOnly),certOnly);
   const [categories]=await db.query('SELECT id FROM categories WHERE is_active=1 ORDER BY id');
   const full={...profile,interests:[...categories.map(c=>c.id),...seed.map(c=>c.id)]};
   assert.equal(full.interests.length,90);assert.deepEqual(await client.saveProfile(full),full);
   await assert.rejects(client.saveProfile({...full,interests:[...full.interests,'cert-limit-overflow']}),e=>e.code==='invalid_profile');
   assert.deepEqual(await client.getProfile(),full); // Rejected update must preserve the saved 90 IDs.
   await client.saveProfile(profile);
   for(const interests of [['missing'],['ds',seed[0].id,'missing'],[seed[0].id,seed[0].id]])await assert.rejects(client.saveProfile({...profile,interests}));
   await db.execute('UPDATE certificates SET is_active=0 WHERE id=?',[seed[0].id]);
   try{await assert.rejects(client.saveProfile(profile),e=>e.code==='invalid_interests');}finally{await db.execute('UPDATE certificates SET is_active=1 WHERE id=?',[seed[0].id]);}
   assert.deepEqual(await client.getProfile(),profile);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));if(user)await db.execute('DELETE FROM users WHERE id=?',[user.id]);}
 });
});
