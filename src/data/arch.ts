// 건축공학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const ARCH_CATEGORIES: CategoryDef[] = [
  { id: "ar-struct", name: "건축구조", emoji: "🏛️" },
  { id: "ar-env", name: "건축환경·설비", emoji: "🌡️" },
  { id: "ar-const", name: "건축시공·관리", emoji: "🏗️" },
  { id: "ar-plan", name: "건축계획", emoji: "📐" },
];

export const ARCH_RAW: Record<string, RawTopic[]> = {
  "ar-struct": [
    ["철근콘크리트", "Reinforced concrete", 1, "콘크리트와 철근이 힘을 나눠 받는 원리"],
    ["철골 구조", "Steel frame", 1, "강재 기둥과 보로 뼈대를 짜는 구조"],
    ["트러스", "Truss", 1, "삼각형 부재 조합으로 하중을 전달하는 구조"],
    ["캔틸레버", "Cantilever", 1, "한쪽 끝만 고정된 채 내민 보"],
    ["라멘 구조", "Moment-resisting frame", 2, "기둥과 보를 강하게 접합한 골조 형식"],
    ["프리스트레스트 콘크리트", "Prestressed concrete", 2, "미리 압축력을 넣어 균열을 줄이는 방법"],
    ["좌굴", "Buckling", 2, "가늘고 긴 부재가 압축에 갑자기 휘는 현상"],
    ["면진 구조", "Base isolation", 3, "건물과 지반 사이에서 지진 진동을 끊는 기술"],
    ["한계상태설계법", "Limit state design", 3, "구조물이 기능을 잃는 경계 상태로 설계하는 법"],
    ["쉘 구조", "Thin-shell structure", 3, "얇은 곡면으로 큰 공간을 덮는 구조"],
  ],
  "ar-env": [
    ["열관류율", "Thermal transmittance", 1, "벽체를 통해 열이 얼마나 빠져나가는가"],
    ["노점 온도", "Dew point", 1, "공기 속 수증기가 물방울로 맺히는 온도"],
    ["자연환기", "Natural ventilation", 1, "기계 없이 바람과 온도차로 공기 바꾸기"],
    ["공기조화 설비 (HVAC)", "Heating, ventilation, and air conditioning", 1, "냉난방·환기를 함께 다루는 건물 설비"],
    ["열교", "Thermal bridge", 2, "단열이 끊긴 부분으로 열이 새는 현상"],
    ["주광률", "Daylight factor", 2, "실내로 들어오는 자연광의 비율 지표"],
    ["잔향시간", "Reverberation", 2, "소리가 멈춘 뒤 실내에 남는 울림"],
    ["습공기선도", "Psychrometrics", 3, "공기의 온도·습도 상태를 읽는 도표"],
    ["전열교환기", "Energy recovery ventilation", 3, "환기하면서 버려지는 열을 되찾는 장치"],
    ["패시브 하우스", "Passive house", 3, "냉난방 에너지를 극도로 줄인 건축 기준"],
  ],
  "ar-const": [
    ["거푸집", "Formwork", 1, "굳기 전 콘크리트의 모양을 잡는 틀"],
    ["레디믹스트 콘크리트 (레미콘)", "Ready-mix concrete", 1, "공장에서 배합해 현장으로 운반하는 콘크리트"],
    ["슬럼프 시험", "Concrete slump test", 1, "굳지 않은 콘크리트의 묽기를 재는 시험"],
    ["물-시멘트비", "Water–cement ratio", 1, "콘크리트 강도를 좌우하는 배합 비율"],
    ["주공정법 (CPM)", "Critical path method", 2, "공사 기간을 결정하는 작업 경로 찾기"],
    ["가치공학 (VE)", "Value engineering", 2, "기능은 유지하며 비용을 낮추는 기법"],
    ["건설정보모델링 (BIM)", "Building information modeling", 2, "건물 정보를 3차원 모델로 통합 관리"],
    ["설계·시공 일괄 발주 (턴키)", "Design–build", 3, "설계와 시공을 한 업체에 맡기는 방식"],
    ["알칼리 골재 반응", "Alkali–silica reaction", 3, "골재와 시멘트 성분이 반응해 생기는 균열"],
    ["건설사업관리 (CM)", "Construction management", 3, "발주자를 대신해 사업 전반을 관리하는 제도"],
  ],
  "ar-plan": [
    ["용적률", "Floor area ratio", 1, "대지 면적 대비 건물 연면적의 비율"],
    ["유니버설 디자인", "Universal design", 1, "누구나 차별 없이 쓸 수 있는 설계 원칙"],
    ["녹색건축", "Green building", 1, "환경 부담을 줄이는 건축의 개념"],
    ["오픈 플랜", "Open plan", 1, "칸막이를 줄여 공간을 트는 평면 구성"],
    ["범죄예방 환경설계 (CPTED)", "Crime prevention through environmental design", 2, "공간 설계로 범죄 기회를 줄이는 기법"],
    ["LEED 인증", "Leadership in Energy and Environmental Design", 2, "미국의 대표적인 친환경 건축 인증"],
    ["모듈러 건축", "Modular building", 2, "공장에서 만든 유닛을 현장에서 조립"],
    ["근대건축 5원칙", "Five Points of Architecture", 3, "르 코르뷔지에가 제시한 새 건축의 요소"],
    ["모뒬로르", "Modulor", 3, "인체 치수와 황금비를 결합한 척도 체계"],
    ["제로에너지 건축", "Zero-energy building", 3, "쓰는 에너지만큼 스스로 생산하는 건물"],
  ],
};
