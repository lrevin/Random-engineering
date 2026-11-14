const json = value => typeof value === 'string' ? JSON.parse(value) : value;

export function databaseStore(db) {
  return {
    async catalog() {
      const [domains]=await db.query('SELECT id,name_ko AS name,is_active AS active FROM domains ORDER BY id');
      const [categories]=await db.query('SELECT id,domain_id AS domainId,name_ko AS name,is_active AS active FROM categories ORDER BY id');
      const [topics]=await db.query('SELECT id,category_id AS categoryId,name_ko AS name,difficulty,is_active AS active FROM topics ORDER BY id');
      return {domains,categories,topics};
    },
    async health() {
      const [[counts]] = await db.query(`SELECT
        (SELECT COUNT(*) FROM topics) AS topics,
        (SELECT COUNT(DISTINCT q.topic_id) FROM questions q WHERE q.source='bank' AND q.status='published'
          AND EXISTS (SELECT 1 FROM question_file_items i JOIN question_files f ON f.id=i.file_id WHERE i.question_id=q.id AND f.status='published')) AS bankTopics,
        (SELECT COUNT(*) FROM questions q WHERE q.source='bank' AND q.status='published'
          AND EXISTS (SELECT 1 FROM question_file_items i JOIN question_files f ON f.id=i.file_id WHERE i.question_id=q.id AND f.status='published')) AS questions`);
      return { ok: true, storage: 'mysql', topics:Number(counts.topics),bankTopics:Number(counts.bankTopics),questions:Number(counts.questions), auth: 'not_implemented', records: 'not_implemented' };
    },
    async questions(topicId) {
      const [[topic]] = await db.execute(`SELECT t.id FROM topics t JOIN categories c ON c.id=t.category_id
        JOIN domains d ON d.id=c.domain_id WHERE t.id=? AND t.is_active=1 AND c.is_active=1 AND d.is_active=1`, [topicId]);
      if (!topic) return null;
      const [rows] = await db.execute(`SELECT d.type,d.body,d.choices,d.answer,d.explanation FROM questions q
        JOIN question_details d ON d.question_id=q.id WHERE q.topic_id=? AND q.source='bank' AND q.status='published'
        AND EXISTS (SELECT 1 FROM question_file_items i JOIN question_files f ON f.id=i.file_id
          WHERE i.question_id=q.id AND i.topic_id=q.topic_id AND f.status='published') ORDER BY q.id`, [topicId]);
      return rows.map(r => ({ type:r.type, q:r.body, ...(r.type==='mc' ? { choices:json(r.choices) } : {}), answer:json(r.answer), explain:r.explanation }));
    },
  };
}
