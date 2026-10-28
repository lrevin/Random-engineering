// 자동 생성 파일: python scripts/quizbank.py index
// 앱에 내장된 퀴즈 문제 은행. 문제 파일을 추가한 뒤 위 명령으로 다시 만드세요.

import type { QuizQuestion } from "@/lib/quiz";
import b_ds_1 from "./ds-1.json";
import b_ds_2 from "./ds-2.json";
import b_sec_1 from "./sec-1.json";
import b_sec_3 from "./sec-3.json";
import b_sec_4 from "./sec-4.json";

const FILES = [
  b_ds_1,
  b_ds_2,
  b_sec_1,
  b_sec_3,
  b_sec_4,
] as Record<string, QuizQuestion[]>[];

// 한 주제의 문제가 여러 파일에 나뉘어 있으면 합칩니다
export const QUIZ_BANK: Record<string, QuizQuestion[]> = {};
for (const f of FILES) for (const [id, qs] of Object.entries(f)) (QUIZ_BANK[id] ??= []).push(...qs);
