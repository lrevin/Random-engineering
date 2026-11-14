import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { connect, transaction, safeError } from './db.mjs';
const certs=JSON.parse(fs.readFileSync(new URL('../mysql/seeds/certificates.json',import.meta.url),'utf8'));
export async function importCertificates(db,{certificates=certs}={}) {
  const [[lock]]=await db.query("SELECT GET_LOCK(SHA2(CONCAT(DATABASE(), ':certificate_import'),256),30) AS acquired");
  if(Number(lock.acquired)!==1)throw new Error('certificate_import_lock_unavailable');
  try {return await transaction(db,async()=>{
    const certs=certificates;
    const [categories]=await db.query('SELECT id FROM categories');
    const [topics]=await db.query('SELECT id FROM topics');
    const cats=new Set(categories.map(x=>x.id)), ts=new Set(topics.map(x=>x.id));
    const ids=new Set(); let subjects=0, items=0;
    // Validate ALL references before writing any seed rows.
    for(const c of certs){
      if(ids.has(c.id)||cats.has(c.id)||!/^cert-[a-z0-9_-]{1,27}$/.test(c.id))throw Error('certificate_id_conflict');
      ids.add(c.id);
      for(const s of c.subjects){
        if(new Set(s.items).size!==s.items.length)throw Error('duplicate_certificate_item');
        for(const id of s.items)if(Number(cats.has(id))+Number(ts.has(id))!==1)throw Error('unknown_or_ambiguous_certificate_reference:'+id);
      }
    }
    for(const [i,c] of certs.entries()){
      const [[old]]=await db.execute('SELECT id FROM certificates WHERE id=?',[c.id]);
      if(old){
        // Re-import never overwrites an edited DB catalog or reactivates a certificate.
        const [[row]]=await db.execute('SELECT name_ko,organization,description,display_order FROM certificates WHERE id=?',[c.id]);
        const [ss]=await db.execute('SELECT id,name_ko,display_order FROM certificate_subjects WHERE certificate_id=? ORDER BY display_order',[c.id]);
        if(row.name_ko!==c.name||row.organization!==c.org||row.description!==c.description||row.display_order!==i+1||ss.length!==c.subjects.length)throw Error('certificate_seed_conflict');
        for(const [j,s] of ss.entries()){
          const [its]=await db.execute('SELECT position,category_id,topic_id FROM certificate_subject_items WHERE subject_id=? ORDER BY position',[s.id]);
          if(s.name_ko!==c.subjects[j].name||s.display_order!==j+1||its.length!==c.subjects[j].items.length||its.some((x,k)=>x.position!==k+1||(x.category_id??x.topic_id)!==c.subjects[j].items[k]))throw Error('certificate_seed_conflict');
        }
      }else{
        await db.execute('INSERT INTO certificates(id,name_ko,organization,description,display_order) VALUES (?,?,?,?,?)',[c.id,c.name,c.org,c.description,i+1]);
        for(const [j,s] of c.subjects.entries()){
          const [r]=await db.execute('INSERT INTO certificate_subjects(certificate_id,name_ko,display_order) VALUES (?,?,?)',[c.id,s.name,j+1]);
          for(const [k,id] of s.items.entries())await db.execute('INSERT INTO certificate_subject_items(subject_id,position,category_id,topic_id) VALUES (?,?,?,?)',[r.insertId,k+1,cats.has(id)?id:null,ts.has(id)?id:null]);
        }
      }
      subjects+=c.subjects.length; items+=c.subjects.reduce((n,s)=>n+s.items.length,0);
    }
    return {certificates:certs.length,subjects,items};
  });
  } finally {await db.query("SELECT RELEASE_LOCK(SHA2(CONCAT(DATABASE(), ':certificate_import'),256))");}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const db=await connect();
 try {console.log(JSON.stringify(await importCertificates(db)));}
 catch(error){console.error('Certificate import failed:',safeError(error));process.exitCode=1;}
 finally{await db.end();}
}
