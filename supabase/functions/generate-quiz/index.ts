// 퀴즈 생성 서버 함수 (Supabase Edge Function, Deno)
//
// 앱이 { topicId } 를 보내면:
//   1) 이미 만든 문제가 DB(quizzes)에 있으면 그대로 돌려줌 → AI 호출 없음
//   2) 없으면 Claude로 15문제를 만들어 검증·저장하고 돌려줌
// 주제 목록(topics.json)에 있는 주제만 받으므로 AI 비용은 최대 "주제 수 × 1회"입니다.
//
// 배포:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy generate-quiz --no-verify-jwt
// (둘러보기 사용자도 퀴즈를 받을 수 있도록 JWT 검사를 끕니다. 대신 위의 주제 목록 + 캐시로 남용을 막습니다.)

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import topics from "./topics.json" with { type: "json" };

type TopicInfo = { ko: string; en: string; lv: number; level: string; hint: string; category: string; domain: string };
type Question =
  | { type: "mc"; q: string; choices: string[]; answer: number; explain: string }
  | { type: "ox"; q: string; answer: boolean; explain: string };

const MODEL = "claude-opus-5-5";
const TOPICS = topics as Record<string, TopicInfo>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM = `당신은 한국 대학교 공과대학 전공 과목과 국가기술자격(기사) 시험 문제를 출제하는 출제위원입니다.
학생이 방금 15분 동안 위키백과로 한 가지 개념을 공부했습니다. 그 개념을 제대로 이해했는지 확인하는 퀴즈를 만듭니다.

규칙:
- 모든 문제는 주어진 개념 하나에 대한 것이어야 합니다. 정의, 동작 원리·작동 방식, 특징·장단점, 비교(비슷한 개념과의 차이), 적용 예시, 간단한 계산이나 판단을 고르게 섞습니다.
- 교과서·위키백과 수준에서 널리 인정되는 사실만 씁니다. 출처마다 다를 수 있는 수치, 연도, 인명 암기 문제는 피합니다.
- 정답이 하나로 분명해야 합니다. "모두 맞다/모두 틀리다", "위 보기 중 없음" 같은 보기는 쓰지 않습니다.
- 4지선다 오답 보기는 그럴듯하지만 분명히 틀린 내용으로 만들고, 정답 위치를 고르게 섞습니다.
- OX 문제는 맞는 진술과 틀린 진술을 섞습니다.
- 난이도는 주어진 Lv에 맞춥니다 (Lv.1 기초: 정의·핵심 특징 / Lv.2 중급: 원리·비교·적용 / Lv.3 심화: 응용·분석·계산).
- 문제와 해설은 자연스러운 한국어로 씁니다. 전공 용어는 한국어로 쓰고 필요하면 괄호에 영어를 덧붙입니다.
- explain에는 왜 그것이 정답인지 1~2문장으로 씁니다.

형식:
- 정확히 15문제: 4지선다(type "mc") 11개, OX(type "ox") 4개.
- mc: choices에 보기 4개, answer_index에 정답 번호(0~3), answer_bool은 false.
- ox: choices는 빈 배열, answer_bool에 정답(true=O, false=X), answer_index는 0.`;

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

async function generate(topic: TopicInfo): Promise<Question[]> {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경 변수 사용
  const prompt = `개념: ${topic.ko} (영어: ${topic.en})
분야: ${topic.domain} > ${topic.category}
난이도: Lv.${topic.lv} ${topic.level}
참고 힌트: ${topic.hint}

이 개념에 대한 퀴즈 15문제를 만들어 주세요.`;

  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  } as never);

  const msg = res as unknown as { stop_reason: string; content: { type: string; text?: string }[] };
  if (msg.stop_reason === "refusal") throw new Error("refused");
  if (msg.stop_reason === "max_tokens") throw new Error("truncated");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const parsed = JSON.parse(text) as { questions: RawQuestion[] };
  return toQuestions(parsed.questions);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let topicId = "";
  try {
    topicId = String((await req.json())?.topicId ?? "");
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const topic = TOPICS[topicId];
  if (!topic) return json({ error: "unknown topic" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // 1) 캐시
  const { data: cached } = await db.from("quizzes").select("questions").eq("topic_id", topicId).maybeSingle();
  if (cached?.questions) return json({ questions: cached.questions, cached: true });

  // 2) 생성
  try {
    const questions = await generate(topic);
    if (questions.length < 10) return json({ error: "not enough valid questions" }, 502);
    await db.from("quizzes").upsert({ topic_id: topicId, questions, model: MODEL }, { onConflict: "topic_id", ignoreDuplicates: true });
    return json({ questions, cached: false });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate limited" }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `ai error ${e.status}` }, 502);
    return json({ error: "generation failed" }, 502);
  }
});
