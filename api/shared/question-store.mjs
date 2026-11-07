import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const BANK_DIR = path.join(ROOT, 'app/src/data/quizbank');
export const TOPICS_FILE = path.join(ROOT, 'api/supabase/functions/generate-quiz/topics.json');
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

// Canonical field order makes identity independent of JSON key order and file position.
export function question(value) {
  if (!object(value) || !text(value.q, 400) || !text(value.explain, 400)) throw new Error('invalid question text');
  if (value.type === 'ox' && typeof value.answer === 'boolean') {
    return { type: 'ox', q: value.q, answer: value.answer, explain: value.explain };
  }
  if (value.type === 'mc' && Array.isArray(value.choices) && value.choices.length === 4 &&
      value.choices.every(c => text(c, 200)) && new Set(value.choices.map(c => c.trim())).size === 4 &&
      Number.isInteger(value.answer) && value.answer >= 0 && value.answer < 4) {
    return { type: 'mc', q: value.q, choices: [...value.choices], answer: value.answer, explain: value.explain };
  }
  throw new Error('invalid question type or answer');
}

export function loadTopics(file = TOPICS_FILE) {
  const topics = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!object(topics)) throw new Error('invalid topics');
  return topics;
}

export function loadBank(dir = BANK_DIR, topics = loadTopics()) {
  const bank = Object.create(null);
  for (const name of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (!object(data)) throw new Error(`${name}: expected topic map`);
    for (const [topicId, values] of Object.entries(data)) {
      if (!Object.hasOwn(topics, topicId) || !Array.isArray(values)) throw new Error(`${name}: invalid topic ${topicId}`);
      const target = bank[topicId] ??= [];
      for (const value of values) {
        try { target.push(question(value)); }
        catch (e) { throw new Error(`${name}/${topicId}/${target.length}: ${e.message}`); }
      }
    }
  }
  for (const [id, values] of Object.entries(bank)) {
    if (new Set(values.map(q => hash(q))).size !== values.length) throw new Error(`${id}: duplicate question`);
  }
  return bank;
}

// Derived rows only; changing content intentionally creates a new immutable identity.
export function rowsFor(bank, source = 'bank') {
  if (!['bank', 'ai'].includes(source)) throw new Error('invalid source');
  return Object.entries(bank).sort(([a], [b]) => a.localeCompare(b)).flatMap(([topicId, values]) => values.map(v => {
    const q = question(v);
    const digest = hash([source, topicId, q]);
    const id = `${digest.slice(0,8)}-${digest.slice(8,12)}-8${digest.slice(13,16)}-${((parseInt(digest[16],16)&3)|8).toString(16)}${digest.slice(17,20)}-${digest.slice(20,32)}`;
    return { id, topicId, source, contentHash: hash(q), type: q.type, body: q.q,
      choices: q.choices ?? null, answer: q.answer, explanation: q.explain };
  }));
}

export function readPool(file) {
  if (!fs.existsSync(file)) return [];
  const values = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(values)) throw new Error(`${file}: invalid pool`);
  for (const v of values) question(v);
  return values;
}

// Same-directory rename: readers see either the complete old or complete new file.
export function writePool(file, values) {
  for (const value of values) question(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(values, null, 1), { flag: 'wx' });
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
