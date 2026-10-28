// 퀴즈 생성 서버 함수 (Supabase Edge Function, Deno)
// 퀴즈 AI 서버(api/quiz-server)를 켜 두지 않았을 때 앱이 쓰는 예비 출제 경로입니다. 규칙은 서버와 같습니다.
//
// 앱이 { topicId, count?, avoid? } 를 보내면:
//   1) DB(quizzes)에 쌓인 그 주제의 AI 문제 중, 우리 문제 은행(bank.json)·avoid와 비슷하지 않은 것을 count개 골라 줌
//   2) 모자라거나 fresh(주제를 뽑은 즉시 보내는 요청)면 문제 은행 + 이미 쌓인 문제를 AI에게 먼저 보여 주고,
//      겹치지 않는 새 유형으로 8문제를 더 만든 뒤 바로 2번 검수(1차: 정답표 없이 직접 풀기, 2차: 정답·해설 대조)해서
//      둘 다 통과한 문제만 쌓음
// 주제 목록(topics.json)에 있는 주제만 받고, 주제마다 최대 MAX_POOL 문제까지만 만들어서 AI 비용에 상한이 있습니다.
//
// topics.json · bank.json · gem.json 은 python scripts/export_topics.py 로 만듭니다 (gem.json = api/quiz-server/gem.md).
// 배포:
//   cd api && npx supabase secrets set ANTHROPIC_API_KEY=<Claude API 키>
//   cd api && npx supabase functions deploy generate-quiz --no-verify-jwt
// 규칙: api/API_RULES.md

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import bankJson from "./bank.json" with { type: "json" };
import gem from "./gem.json" with { type: "json" };
import topics from "./topics.json" with { type: "json" };

type TopicInfo = { ko: string; en: string; lv: number; level: string; hint: string; category: string; domain: string };
type Question =
  | { type: "mc"; q: string; choices: string[]; answer: number; explain: string }
  | { type: "ox"; q: string; answer: boolean; explain: string };

const MODEL = "claude-opus-5-5";
const TOPICS = topics as Record<string, TopicInfo>;
const BANK = bankJson as Record<string, string[]>;
const BATCH = 8;
const MAX_POOL = 40;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mc", "ox"] },
          q: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          answer_bool: { type: "boolean" },
          explain: { type: "string" },
        },
        required: ["type", "q", "choices", "answer_index", "answer_bool", "explain"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const GEM = gem as { system: string; review1: string; review2: string };

type RawQuestion = { type: string; q: string; choices: string[]; answer_index: number; answer_bool: boolean; explain: string };

/** 모델 출력 → 앱 형식으로 바꾸고, 형식이 맞지 않는 문제는 버림 */
function toQuestions(raw: RawQuestion[]): Question[] {
  const out: Question[] = [];
  for (const r of raw ?? []) {
    const q = (r.q ?? "").trim();
    const explain = (r.explain ?? "").trim();
    if (!q || !explain || q.length > 400 || explain.length > 400) continue;
    if (r.type === "ox") {
      out.push({ type: "ox", q, answer: !!r.answer_bool, explain });
    } else if (r.type === "mc") {
      const choices = (r.choices ?? []).map((c) => String(c).trim());
      const ok = choices.length === 4 && choices.every((c) => c && c.length <= 200) && new Set(choices).size === 4 &&
        Number.isInteger(r.answer_index) && r.answer_index >= 0 && r.answer_index < 4;
      if (ok) out.push({ type: "mc", q, choices, answer: r.answer_index, explain });
    }
  }
  return out;
}

// ───────── 비슷한 문제 거르기 (앱·퀴즈 AI 서버와 같은 방법) ─────────
const normalize = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
function similarity(a: string, b: string) {
  const grams = (s: string) => {
    const n = normalize(s);
    const out = new Set<string>();
    for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2));
    return out;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return normalize(a) === normalize(b) ? 1 : 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
function distinct(qs: Question[], against: string[]) {
  const kept: Question[] = [];
  for (const q of qs) {
    if (![...against, ...kept.map((k) => k.q)].some((o) => similarity(q.q, o) >= 0.5)) kept.push(q);
  }
  return kept;
}

// ───────── 말투 (docs/quiz-authoring.md "말투", api/quiz-server/core.mjs 와 같은 규칙) ─────────
const COND = String.raw`(\s*\([^()]*\))?`;
const MC_END = new RegExp(String.raw`\?` + COND + "$");
const OX_END = new RegExp(String.raw`다\.` + COND + "$");
const OX_FORMAL = new RegExp(String.raw`니다\.` + COND + "$");
const HAEYO = /(예요|에요|해요|어요|아요|이죠|죠|네요|군요)[.!?]?(\s|$)/;
const BANNED_Q = /(고르시오|고르세요|무엇일까|뭘까|인가요\?|일까요\?|\[AI\]|\[연습)/;
const NUMBERED = /^\s*(\d+[.)]\s|[①-⑳]|[A-Da-d][.)]\s)/;

function styleFix(q: Question): Question {
  if (q.type !== "mc") return { ...q, q: q.q.trim(), explain: q.explain.trim() };
  return { ...q, q: q.q.trim(), explain: q.explain.trim(), choices: q.choices.map((c) => c.trim().replace(NUMBERED, "").replace(/\.$/, "").trim()) };
}
function styleOk(q: Question) {
  if (q.type === "mc" && !MC_END.test(q.q)) return false;
  if (q.type === "ox" && (!OX_END.test(q.q) || OX_FORMAL.test(q.q))) return false;
  if (BANNED_Q.test(q.q) || !q.explain.includes("니다") || HAEYO.test(q.explain) || HAEYO.test(q.q)) return false;
  if (/(정답은?\s*\d+\s*번|\d+\s*번\s*보기|보기\s*\d+)/.test(q.explain)) return false;
  if (q.type === "mc" && q.choices.some((c) => NUMBERED.test(c) || /[^.]\.$/.test(c))) return false;
  return true;
}

async function askJson(system: string, content: string, schema: unknown, effort: "medium" | "high"): Promise<unknown> {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경 변수 사용
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 12000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }],
  } as never);
  const msg = res as unknown as { stop_reason: string; content: { type: string; text?: string }[] };
  if (msg.stop_reason === "refusal") throw new Error("refused");
  if (msg.stop_reason === "max_tokens") throw new Error("truncated");
  return JSON.parse(msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""));
}

// ───────── 검수 2번 (api/quiz-server/core.mjs 의 review 와 같음) ─────────
const REVIEW1_SCHEMA = {
  type: "object",
  properties: { results: { type: "array", items: { type: "object", properties: {
    index: { type: "integer" }, answer_index: { type: "integer" }, answer_bool: { type: "boolean" },
    ambiguous: { type: "boolean" }, on_topic: { type: "boolean" }, sound: { type: "boolean" }, note: { type: "string" },
  }, required: ["index", "answer_index", "answer_bool", "ambiguous", "on_topic", "sound", "note"], additionalProperties: false } } },
  required: ["results"], additionalProperties: false,
};
const REVIEW2_SCHEMA = {
  type: "object",
  properties: { results: { type: "array", items: { type: "object", properties: {
    index: { type: "integer" }, verdict: { type: "string", enum: ["keep", "drop"] }, reason: { type: "string" },
  }, required: ["index", "verdict", "reason"], additionalProperties: false } } },
  required: ["results"], additionalProperties: false,
};
type R1 = { index: number; answer_index: number; answer_bool: boolean; ambiguous: boolean; on_topic: boolean; sound: boolean };
type R2 = { index: number; verdict: "keep" | "drop" };

const topicLine = (t: TopicInfo) => `개념: ${t.ko} (영어: ${t.en})\n분야: ${t.domain} > ${t.category}\n난이도: Lv.${t.lv} ${t.level}\n참고 힌트: ${t.hint}`;
const asList = (qs: Question[], withKey: boolean) => qs.map((q, i) => {
  if (q.type === "ox") return `[${i}] (OX) ${q.q}` + (withKey ? `\n  정답: ${q.answer ? "O" : "X"}\n  해설: ${q.explain}` : "");
  const choices = q.choices.map((c, k) => `  ${k}) ${c}`).join("\n");
  return `[${i}] (4지선다) ${q.q}\n${choices}` + (withKey ? `\n  정답: ${q.answer}) ${q.choices[q.answer]}\n  해설: ${q.explain}` : "");
}).join("\n\n");

/** 1차: 정답표 없이 직접 풀기 → 2차: 정답·해설 대조. 둘 다 통과한 문제만 */
async function review(topic: TopicInfo, qs: Question[]): Promise<Question[]> {
  if (!qs.length) return [];
  const p1 = `${topicLine(topic)}\n\n아래 문제를 정답표 없이 직접 풀고 판단해 주세요. OX 문제는 answer_index를 0으로, 4지선다는 answer_bool을 false로 두세요.\n\n${asList(qs, false)}`;
  const r1 = (await askJson(GEM.review1, p1, REVIEW1_SCHEMA, "high") as { results: R1[] }).results;
  const m1 = new Map(r1.map((r) => [r.index, r]));
  const after1 = qs.filter((q, i) => {
    const r = m1.get(i);
    if (!r || r.ambiguous || !r.on_topic || !r.sound) return false;
    return q.type === "mc" ? r.answer_index === q.answer : r.answer_bool === q.answer;
  });
  if (!after1.length) return [];
  const p2 = `${topicLine(topic)}\n\n아래 문제를 정답표·해설까지 보고 판정해 주세요.\n\n${asList(after1, true)}`;
  const r2 = (await askJson(GEM.review2, p2, REVIEW2_SCHEMA, "high") as { results: R2[] }).results;
  const m2 = new Map(r2.map((r) => [r.index, r]));
  return after1.filter((_, i) => m2.get(i)?.verdict === "keep");
}

async function generate(topic: TopicInfo, existing: string[], count: number): Promise<Question[]> {
  const list = existing.length ? existing.map((q, i) => `${i + 1}. ${q}`).join("\n") : "(아직 없음)";
  const prompt = `개념: ${topic.ko} (영어: ${topic.en})
분야: ${topic.domain} > ${topic.category}
난이도: Lv.${topic.lv} ${topic.level}
참고 힌트: ${topic.hint}

이미 있는 문제 (이것과 비슷한 문제는 만들지 마세요):
${list}

위 문제들과 겹치지 않는 새로운 유형의 퀴즈 ${count}문제를 만들어 주세요.
말투는 위 "이미 있는 문제"와 지침의 "말투" 규칙을 그대로 따르세요 (4지선다 "~은/는?", OX "~다.", 해설 "~입니다/~합니다").`;

  const parsed = await askJson(GEM.system, prompt, SCHEMA, "medium") as { questions: RawQuestion[] };
  // 말투 검사: 작은 차이는 고치고, 규칙에 어긋나는 문제는 버림 → 만든 직후 2번 검수
  const drafted = distinct(toQuestions(parsed.questions).map(styleFix).filter(styleOk), existing);
  return await review(topic, drafted);
}

function sample<T>(xs: T[], n: number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { topicId?: unknown; count?: unknown; avoid?: unknown; fresh?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const topicId = String(body?.topicId ?? "");
  const topic = TOPICS[topicId];
  if (!topic) return json({ error: "unknown topic" }, 400);
  const count = Math.min(7, Math.max(1, Number(body?.count) || 4));
  const avoid = (Array.isArray(body?.avoid) ? body.avoid : []).slice(0, 40).map((s) => String(s).slice(0, 400));

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: row } = await db.from("quizzes").select("questions").eq("topic_id", topicId).maybeSingle();
  let pool = (row?.questions as Question[] | undefined) ?? [];
  const against = [...(BANK[topicId] ?? []), ...avoid];
  let usable = distinct(pool, against);
  let made: Question[] = [];

  if ((body?.fresh === true || usable.length < count) && pool.length < MAX_POOL) {
    try {
      made = await generate(topic, [...(BANK[topicId] ?? []), ...pool.map((q) => q.q), ...avoid], BATCH);
      pool = [...pool, ...made];
      await db.from("quizzes").upsert({ topic_id: topicId, questions: pool, model: MODEL }, { onConflict: "topic_id" });
      usable = distinct(pool, against);
    } catch (e) {
      if (!usable.length) {
        if (e instanceof Anthropic.RateLimitError) return json({ error: "rate limited" }, 429);
        if (e instanceof Anthropic.APIError) return json({ error: `ai error ${e.status}` }, 502);
        return json({ error: "generation failed" }, 502);
      }
    }
  }
  // 방금 만들고 검수한 문제를 먼저
  const madeNow = new Set(made.map((q) => q.q));
  const chosen = [...sample(usable.filter((q) => madeNow.has(q.q)), count), ...sample(usable.filter((q) => !madeNow.has(q.q)), count)].slice(0, count);
  return json({ questions: chosen, fresh: chosen.filter((q) => madeNow.has(q.q)).length });
});
