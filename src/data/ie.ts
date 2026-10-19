// 산업공학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const IE_CATEGORIES: CategoryDef[] = [
  { id: "ie-or", name: "경영과학·최적화", emoji: "📐" },
  { id: "ie-quality", name: "품질·통계", emoji: "📊" },
  { id: "ie-prod", name: "생산·물류관리", emoji: "🏭" },
  { id: "ie-human", name: "인간공학·안전", emoji: "🦺" },
];

export const IE_RAW: Record<string, RawTopic[]> = {
  "ie-or": [
    ["선형계획법", "Linear programming", 1, "제약 조건 아래에서 목표를 최적화하는 수학 모델"],
    ["대기행렬 이론", "Queueing theory", 1, "줄 서서 기다리는 현상을 수학적으로 분석"],
    ["게임 이론", "Game theory", 1, "서로의 선택이 결과에 영향을 주는 의사결정 분석"],
    ["몬테카를로 시뮬레이션", "Monte Carlo method", 1, "난수를 반복 사용해 결과를 추정하는 기법"],
    ["심플렉스법", "Simplex algorithm", 2, "꼭짓점을 따라 이동하며 최적해를 찾는 풀이법"],
    ["정수계획법", "Integer programming", 2, "변수가 정수여야 하는 최적화 문제"],
    ["마르코프 연쇄", "Markov chain", 2, "현재 상태만으로 다음 상태가 정해지는 확률 과정"],
    ["쌍대 문제 (선형계획)", "Dual linear program", 3, "하나의 최적화 문제를 뒤집어 본 짝 문제"],
    ["외판원 문제 (TSP)", "Travelling salesman problem", 3, "모든 도시를 한 번씩 도는 최단 경로 찾기"],
    ["최대 유량 문제", "Maximum flow problem", 3, "네트워크에서 보낼 수 있는 흐름의 최댓값"],
  ],
  "ie-quality": [
    ["관리도", "Control chart", 1, "공정이 안정 상태인지 시간에 따라 감시하는 도표"],
    ["6시그마", "Six Sigma", 1, "결함을 극도로 줄이려는 품질 경영 방법론"],
    ["QC 7가지 도구", "Seven basic tools of quality", 1, "현장 품질 문제 해결에 쓰는 기본 도구 모음"],
    ["가설검정", "Statistical hypothesis testing", 1, "표본으로 주장의 참·거짓을 판단하는 절차"],
    ["공정능력지수 (Cp, Cpk)", "Process capability index", 2, "공정이 규격을 얼마나 잘 만족하는지 수치화"],
    ["실험계획법 (DOE)", "Design of experiments", 2, "요인의 영향을 효율적으로 알아내는 실험 설계"],
    ["분산분석 (ANOVA)", "Analysis of variance", 2, "여러 집단 평균의 차이를 검정하는 방법"],
    ["샘플링 검사", "Acceptance sampling", 2, "일부만 검사해 로트의 합격 여부를 결정"],
    ["다구치 방법", "Taguchi methods", 3, "잡음에 강한 제품을 설계하는 품질공학 기법"],
    ["고장모드 영향분석 (FMEA)", "Failure mode and effects analysis", 3, "고장 형태와 그 영향을 미리 평가하는 기법"],
  ],
  "ie-prod": [
    ["적시생산 (JIT)", "Just-in-time manufacturing", 1, "필요한 것을 필요한 때 필요한 만큼 생산"],
    ["린 생산", "Lean manufacturing", 1, "낭비를 없애 가치 흐름을 개선하는 생산 방식"],
    ["경제적 주문량 (EOQ)", "Economic order quantity", 1, "재고 비용을 최소화하는 한 번의 주문 크기"],
    ["공급망 관리 (SCM)", "Supply chain management", 1, "원자재부터 고객까지 흐름 전체를 관리"],
    ["자재소요계획 (MRP)", "Material requirements planning", 2, "생산 일정에 맞춰 부품 수요를 계산"],
    ["채찍 효과", "Bullwhip effect", 2, "공급망 상류로 갈수록 수요 변동이 커지는 현상"],
    ["주경로법 (CPM)", "Critical path method", 2, "프로젝트 전체 기간을 결정하는 작업 경로 분석"],
    ["존슨 규칙", "Johnson's rule", 3, "두 기계 작업 순서를 정해 총 완료시간 최소화"],
    ["제약 이론 (TOC)", "Theory of constraints", 3, "시스템 성과를 막는 병목에 집중하는 관리 철학"],
    ["지수평활법", "Exponential smoothing", 3, "최근 자료에 더 큰 가중치를 두는 수요 예측법"],
  ],
  "ie-human": [
    ["인간공학", "Human factors and ergonomics", 1, "사람에게 맞게 기계와 환경을 설계하는 학문"],
    ["하인리히 법칙", "Accident triangle", 1, "큰 사고 뒤에 숨은 작은 사고와 징후의 비율"],
    ["동작·시간 연구", "Time and motion study", 1, "작업 동작과 시간을 분석해 표준을 정함"],
    ["근골격계 질환", "Musculoskeletal disorder", 1, "반복 작업과 나쁜 자세로 생기는 직업병"],
    ["피츠의 법칙", "Fitts's law", 2, "목표물까지 움직이는 시간을 예측하는 모델"],
    ["힉의 법칙", "Hick's law", 2, "선택지 수와 반응 시간의 관계"],
    ["스위스 치즈 모델", "Swiss cheese model", 2, "여러 방어층의 구멍이 겹칠 때 사고가 난다"],
    ["결함수 분석 (FTA)", "Fault tree analysis", 3, "정상 사상에서 원인을 논리 게이트로 거슬러 분석"],
    ["위험과 운전성 분석 (HAZOP)", "Hazard and operability study", 3, "가이드워드로 공정 이탈을 체계적으로 검토"],
    ["신호검출이론", "Detection theory", 3, "잡음 속 신호를 판별하는 민감도와 반응 기준"],
  ],
};
