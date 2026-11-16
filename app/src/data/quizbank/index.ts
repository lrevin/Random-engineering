// 자동 생성 파일: python scripts/quizbank.py index
// 앱에 내장된 퀴즈 문제 은행. 문제 파일을 추가한 뒤 위 명령으로 다시 만드세요.

import type { QuizQuestion } from "@/lib/quiz";
import b_ae_aero_1 from "./ae-aero-1.json";
import b_ae_flight_1 from "./ae-flight-1.json";
import b_ae_prop_1 from "./ae-prop-1.json";
import b_ae_space_1 from "./ae-space-1.json";
import b_ai_1 from "./ai-1.json";
import b_ai_2 from "./ai-2.json";
import b_ai_3 from "./ai-3.json";
import b_algo_1 from "./algo-1.json";
import b_algo_2 from "./algo-2.json";
import b_algo_3 from "./algo-3.json";
import b_ar_const_1 from "./ar-const-1.json";
import b_ar_env_1 from "./ar-env-1.json";
import b_ar_plan_1 from "./ar-plan-1.json";
import b_ar_struct_1 from "./ar-struct-1.json";
import b_arch_1 from "./arch-1.json";
import b_arch_2 from "./arch-2.json";
import b_arch_3 from "./arch-3.json";
import b_bm_biomed_1 from "./bm-biomed-1.json";
import b_bm_biotech_1 from "./bm-biotech-1.json";
import b_bm_genetic_1 from "./bm-genetic-1.json";
import b_bm_genetic_2 from "./bm-genetic-2.json";
import b_bm_process_1 from "./bm-process-1.json";
import b_bm_process_2 from "./bm-process-2.json";
import b_ch_analytic_1 from "./ch-analytic-1.json";
import b_ch_general_1 from "./ch-general-1.json";
import b_ch_organic_1 from "./ch-organic-1.json";
import b_ch_physical_1 from "./ch-physical-1.json";
import b_che_process_1 from "./che-process-1.json";
import b_che_reaction_1 from "./che-reaction-1.json";
import b_db_1 from "./db-1.json";
import b_db_2 from "./db-2.json";
import b_db_3 from "./db-3.json";
import b_ds_1 from "./ds-1.json";
import b_ds_2 from "./ds-2.json";
import b_net_1 from "./net-1.json";
import b_net_2 from "./net-2.json";
import b_net_3 from "./net-3.json";
import b_os_1 from "./os-1.json";
import b_os_2 from "./os-2.json";
import b_os_3 from "./os-3.json";
import b_pl_1 from "./pl-1.json";
import b_pl_2 from "./pl-2.json";
import b_pl_3 from "./pl-3.json";
import b_pl_4 from "./pl-4.json";
import b_se_1 from "./se-1.json";
import b_se_2 from "./se-2.json";
import b_se_3 from "./se-3.json";
import b_se_4 from "./se-4.json";
import b_sec_1 from "./sec-1.json";
import b_sec_2 from "./sec-2.json";
import b_sec_3 from "./sec-3.json";
import b_sec_4 from "./sec-4.json";
import b_sec_5 from "./sec-5.json";
import b_theory_1 from "./theory-1.json";
import b_theory_2 from "./theory-2.json";
import b_theory_3 from "./theory-3.json";
import b_web_1 from "./web-1.json";
import b_web_2 from "./web-2.json";
import b_web_3 from "./web-3.json";

const FILES = [
  b_ae_aero_1,
  b_ae_flight_1,
  b_ae_prop_1,
  b_ae_space_1,
  b_ai_1,
  b_ai_2,
  b_ai_3,
  b_algo_1,
  b_algo_2,
  b_algo_3,
  b_ar_const_1,
  b_ar_env_1,
  b_ar_plan_1,
  b_ar_struct_1,
  b_arch_1,
  b_arch_2,
  b_arch_3,
  b_bm_biomed_1,
  b_bm_biotech_1,
  b_bm_genetic_1,
  b_bm_genetic_2,
  b_bm_process_1,
  b_bm_process_2,
  b_ch_analytic_1,
  b_ch_general_1,
  b_ch_organic_1,
  b_ch_physical_1,
  b_che_process_1,
  b_che_reaction_1,
  b_db_1,
  b_db_2,
  b_db_3,
  b_ds_1,
  b_ds_2,
  b_net_1,
  b_net_2,
  b_net_3,
  b_os_1,
  b_os_2,
  b_os_3,
  b_pl_1,
  b_pl_2,
  b_pl_3,
  b_pl_4,
  b_se_1,
  b_se_2,
  b_se_3,
  b_se_4,
  b_sec_1,
  b_sec_2,
  b_sec_3,
  b_sec_4,
  b_sec_5,
  b_theory_1,
  b_theory_2,
  b_theory_3,
  b_web_1,
  b_web_2,
  b_web_3,
] as Record<string, QuizQuestion[]>[];

/** 문제 은행 전체가 앱에 들어 있음 (서버에서 받을 필요 없음) */
export const BANK_BUNDLED_FULL = true;

// 한 주제의 문제가 여러 파일에 나뉘어 있으면 합칩니다
export const QUIZ_BANK: Record<string, QuizQuestion[]> = {};
for (const f of FILES) for (const [id, qs] of Object.entries(f)) (QUIZ_BANK[id] ??= []).push(...qs);
