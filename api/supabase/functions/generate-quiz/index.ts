// 퀴즈 생성 서버 함수 (Supabase Edge Function, Deno)
// 퀴즈 AI 서버(api/quiz-server)를 켜 두지 않았을 때 앱이 쓰는 예비 출제 경로입니다. 규칙은 서버와 같습니다.
//
// 앱이 { topicId, count?, avoid? } 를 보내면:
//   1) DB(quizzes)에 쌓인 그 주제의 AI 문제 중, 우리 문제 은행(bank.json)·avoid와 비슷하지 않은 것을 count개 골라 줌
//   2) 모자라면 문제 은행 + 이미 쌓인 문제를 AI에게 먼저 보여 주고, 겹치지 않는 새 유형으로 6문제를 더 만들어 쌓음
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
const BATCH = 6;
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

async function generate(topic: TopicInfo, existing: string[], count: number): Promise<Question[]> {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경 변수 사용
  const list = existing.length ? existing.map((q, i) => `${i + 1}. ${q}`).join("\n") : "(아직 없음)";
  const prompt = `개념: ${topic.ko} (영어: ${topic.en})
분야: ${topic.domain} > ${topic.category}
난이도: Lv.${topic.lv} ${topic.level}
참고 힌트: ${topic.hint}

이미 있는 문제 (이것과 비슷한 문제는 만들지 마세요):
${list}

위 문제들과 겹치지 않는 새로운 유형의 퀴즈 ${count}문제를 만들어 주세요.
말투는 위 "이미 있는 문제"와 지침의 "말투" 규칙을 그대로 따르세요 (4지선다 "~은/는?", OX "~다.", 해설 "~입니다/~합니다").`;

  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 12000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: (gem as { system: string }).system,
    messages: [{ role: "user", content: prompt }],
  } as never);

  const msg = res as unknown as { stop_reason: string; content: { type: string; text?: string }[] };
  if (msg.stop_reason === "refusal") throw new Error("refused");
  if (msg.stop_reason === "max_tokens") throw new Error("truncated");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const parsed = JSON.parse(text) as { questions: RawQuestion[] };
  // 말투 검사: 작은 차이는 고치고, 규칙에 어긋나는 문제는 버림
  return distinct(toQuestions(parsed.questions).map(styleFix).filter(styleOk), existing);
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

  let body: { topicId?: unknown; count?: unknown; avoid?: unknown } = {};
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

  if (usable.length < count && pool.length < MAX_POOL) {
    try {
      const made = await generate(topic, [...(BANK[topicId] ?? []), ...pool.map((q) => q.q), ...avoid], BATCH);
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
  return json({ questions: sample(usable, count) });
});
