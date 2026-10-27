// 신소재공학(재료공학) 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const MAT_CATEGORIES: CategoryDef[] = [
  { id: "mt-crystal", name: "결정구조·결함", emoji: "💎" },
  { id: "mt-phase", name: "상태도·상변태", emoji: "🔥" },
  { id: "mt-mech", name: "기계적 성질", emoji: "🔩" },
  { id: "mt-types", name: "금속·세라믹·고분자", emoji: "🧪" },
  { id: "mt-analysis", name: "재료분석", emoji: "🔬" },
];

export const MAT_RAW: Record<string, RawTopic[]> = {
  "mt-crystal": [
    ["결정 구조", "Crystal structure", 1, "원자가 규칙적으로 배열되는 방식"],
    ["입방정계 (BCC·FCC)", "Cubic crystal system", 1, "정육면체 단위격자의 원자 배치 종류"],
    ["밀러 지수", "Miller index", 1, "결정 속 면과 방향을 숫자로 표기하는 법"],
    ["배위수", "Coordination number", 1, "한 원자를 둘러싼 최근접 원자의 수"],
    ["전위", "Dislocation", 2, "소성 변형을 일으키는 선 모양 결함"],
    ["공공", "Vacancy defect", 2, "원자가 있어야 할 자리가 빈 점결함"],
    ["결정립계", "Grain boundary", 2, "방향이 다른 결정들이 만나는 경계"],
    ["버거스 벡터", "Burgers vector", 3, "전위가 만드는 격자 뒤틀림의 크기와 방향"],
    ["적층 결함", "Stacking fault", 3, "원자면 쌓임 순서가 어긋난 면결함"],
    ["쌍정", "Crystal twinning", 3, "경계를 사이에 두고 거울상인 결정"],
  ],
  "mt-phase": [
    ["상태도", "Phase diagram", 1, "온도·조성에 따른 안정한 상을 보여주는 그림"],
    ["공정 반응", "Eutectic system", 1, "액체가 두 고상으로 동시에 굳는 반응"],
    ["지렛대 법칙", "Lever rule", 1, "두 상이 공존할 때 각 상의 양 구하기"],
    ["펄라이트", "Pearlite", 1, "페라이트와 시멘타이트가 층을 이룬 조직"],
    ["깁스 상률", "Phase rule", 2, "평형에서 바꿀 수 있는 변수의 개수"],
    ["마르텐사이트", "Martensite", 2, "강을 급랭하면 생기는 단단한 조직"],
    ["픽의 확산 법칙", "Fick's laws of diffusion", 2, "농도 차이에 따른 원자 이동을 기술"],
    ["핵생성", "Nucleation", 3, "새로운 상이 처음 생겨나는 과정"],
    ["스피노달 분해", "Spinodal decomposition", 3, "핵생성 없이 조성이 저절로 분리되는 현상"],
    ["항온 변태 곡선 (TTT)", "Isothermal transformation diagram", 3, "온도·시간에 따른 변태 진행을 나타낸 도표"],
  ],
  "mt-mech": [
    ["응력-변형률 곡선", "Stress–strain curve", 1, "인장할 때 힘과 늘어남의 관계 그래프"],
    ["영률 (탄성 계수)", "Young's modulus", 1, "재료가 얼마나 뻣뻣한지 나타내는 값"],
    ["항복 강도", "Yield (engineering)", 1, "영구 변형이 시작되는 지점의 응력"],
    ["경도", "Hardness", 1, "표면이 눌림이나 긁힘에 버티는 정도"],
    ["크리프", "Creep (deformation)", 2, "일정한 하중에서 시간이 지나며 늘어나는 변형"],
    ["피로", "Fatigue (material)", 2, "반복 하중으로 강도 이하에서 파손되는 현상"],
    ["가공 경화", "Work hardening", 2, "변형할수록 재료가 더 단단해지는 현상"],
    ["파괴 인성", "Fracture toughness", 3, "균열이 있을 때 파괴에 저항하는 능력"],
    ["홀-페치 관계 (결정립 미세화 강화)", "Grain boundary strengthening", 3, "결정립 크기와 강도 사이의 관계"],
    ["석출 경화", "Precipitation hardening", 3, "미세 입자를 석출시켜 강도를 높이는 법"],
  ],
  "mt-types": [
    ["탄소강", "Carbon steel", 1, "탄소 함량으로 성질이 달라지는 기본 강"],
    ["스테인리스강", "Stainless steel", 1, "크롬을 넣어 녹이 잘 슬지 않는 강"],
    ["알루미늄 합금", "Aluminium alloy", 1, "가볍고 강도를 높인 비철 합금"],
    ["열가소성 수지", "Thermoplastic", 1, "가열하면 다시 녹일 수 있는 고분자"],
    ["열경화성 수지", "Thermosetting polymer", 2, "한 번 굳으면 다시 녹지 않는 고분자"],
    ["유리 전이", "Glass transition", 2, "비정질 고분자가 단단함과 고무 상태를 오가는 현상"],
    ["소결", "Sintering", 2, "분말을 녹는점 아래에서 굳혀 만드는 공정"],
    ["형상 기억 합금", "Shape-memory alloy", 3, "변형돼도 가열하면 원래 모양으로 돌아가는 금속"],
    ["초합금", "Superalloy", 3, "고온에서도 강도를 유지하는 내열 합금"],
    ["고엔트로피 합금", "High-entropy alloy", 3, "여러 원소를 비슷한 비율로 섞은 합금"],
  ],
  "mt-analysis": [
    ["브래그 법칙", "Bragg's law", 1, "X선이 결정면에서 보강 간섭하는 조건"],
    ["주사전자현미경 (SEM)", "Scanning electron microscope", 1, "전자빔을 훑어 표면 형상을 보는 장비"],
    ["금속 조직학", "Metallography", 1, "연마·부식 후 금속 조직을 관찰하는 기술"],
    ["비파괴 검사", "Nondestructive testing", 1, "부품을 망가뜨리지 않고 결함 찾기"],
    ["투과전자현미경 (TEM)", "Transmission electron microscopy", 2, "얇은 시편을 통과한 전자로 내부를 보는 법"],
    ["에너지 분산형 X선 분광법 (EDS)", "Energy-dispersive X-ray spectroscopy", 2, "특성 X선으로 원소 성분을 알아내는 분석"],
    ["시차 주사 열량 측정 (DSC)", "Differential scanning calorimetry", 2, "가열 중 열 흐름으로 상변화를 측정"],
    ["원자간력 현미경 (AFM)", "Atomic force microscopy", 3, "탐침과 표면의 힘으로 나노 형상 측정"],
    ["X선 광전자 분광법 (XPS)", "X-ray photoelectron spectroscopy", 3, "튀어나온 전자로 표면 화학 상태 분석"],
    ["라만 분광법", "Raman spectroscopy", 3, "빛의 비탄성 산란으로 분자 진동을 분석"],
  ],
};
