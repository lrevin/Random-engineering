import {AuthError} from '../server/auth.mjs';
const json=v=>typeof v==='string'?JSON.parse(v):v;
export async function verifyBankItems(db,topicId,items){
 const [rows]=await db.execute(`SELECT q.id,d.type,d.body,d.choices,d.answer,d.explanation FROM questions q JOIN question_details d ON d.question_id=q.id
 WHERE q.topic_id=? AND q.source='bank' AND EXISTS(SELECT 1 FROM question_file_items i WHERE i.question_id=q.id)`,[topicId]);
 const seen=new Set();let verified=0;
 for(const item of items){
  if(item.question.src!=='bank')continue;
  const q=item.question;
  const match=rows.find(r=>r.type===q.type&&r.body===q.q&&r.explanation===q.explain&&(q.type==='ox'?json(r.answer)===q.answer:
   JSON.stringify([...json(r.choices)].sort())===JSON.stringify([...q.choices].sort())&&json(r.choices)[json(r.answer)]===q.choices[q.answer]));
  if(!match)throw new AuthError('bank_question_mismatch',400);
  if(seen.has(match.id))throw new AuthError('duplicate_question',400);
  seen.add(match.id);item.questionId=match.id;verified++;
 }
 return verified===items.length?'server_verified':'client_reported';
}
