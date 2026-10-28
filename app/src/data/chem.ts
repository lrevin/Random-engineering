// 화학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const CHEM_CATEGORIES: CategoryDef[] = [
  { id: "ch-general", name: "일반화학", emoji: "🧪" },
  { id: "ch-organic", name: "유기화학", emoji: "⌬" },
  { id: "ch-physical", name: "물리화학", emoji: "🔥" },
  { id: "ch-analytic", name: "분석·전기화학", emoji: "🔋" },
];

export const CHEM_RAW: Record<string, RawTopic[]> = {
  "ch-general": [
    ["원자", "Atom", 1, "원자핵과 전자로 이루어진 물질의 기본 단위"],
    ["주기율표", "Periodic table", 1, "원소를 원자 번호와 성질에 따라 배열한 표"],
    ["화학 결합", "Chemical bond", 1, "원자들을 묶어 분자·결정을 만드는 힘"],
    ["몰 (단위)", "Mole (unit)", 1, "6.022×10²³개의 입자를 한 묶음으로 세는 단위"],
    ["전기 음성도", "Electronegativity", 2, "결합한 원자가 전자를 끌어당기는 정도"],
    ["산과 염기", "Acid–base reaction", 2, "양성자를 주고받는 반응"],
    ["pH", "PH", 1, "용액의 산성·염기성 정도를 나타내는 척도"],
    ["산화 환원 반응", "Redox", 2, "전자를 잃고 얻는 반응"],
    ["분자 궤도 이론", "Molecular orbital theory", 3, "전자가 분자 전체에 퍼진 궤도에 있다는 이론"],
    ["혼성 궤도", "Orbital hybridisation", 3, "원자 궤도가 섞여 새 궤도를 만드는 개념 (sp³ 등)"],
  ],
  "ch-organic": [
    ["유기 화합물", "Organic compound", 1, "탄소를 뼈대로 한 화합물"],
    ["작용기", "Functional group", 1, "분자의 화학적 성질을 정하는 원자 묶음"],
    ["탄화수소", "Hydrocarbon", 1, "탄소와 수소로만 이루어진 화합물"],
    ["이성질체", "Isomer", 2, "분자식은 같지만 구조가 다른 화합물"],
    ["방향족성", "Aromaticity", 2, "벤젠처럼 고리 전자가 퍼져 안정한 성질"],
    ["친핵성 치환 반응", "Nucleophilic substitution", 2, "친핵체가 이탈기를 밀어내고 자리를 차지하는 반응"],
    ["카이랄성", "Chirality (chemistry)", 2, "거울상과 겹치지 않는 분자의 성질"],
    ["고분자", "Polymer", 2, "단위체가 사슬처럼 길게 이어진 거대 분자"],
    ["SN2 반응", "SN2 reaction", 3, "한 번에 결합이 끊기고 생기는 이분자 치환 반응"],
    ["딜스-알더 반응", "Diels–Alder reaction", 3, "다이엔과 다이엔친화체가 고리를 만드는 반응"],
  ],
  "ch-physical": [
    ["엔탈피", "Enthalpy", 1, "일정 압력에서 계가 가진 열 함량"],
    ["반응 속도", "Reaction rate", 1, "반응물이 생성물로 바뀌는 빠르기"],
    ["화학 평형", "Chemical equilibrium", 1, "정반응과 역반응 속도가 같아진 상태"],
    ["르 샤틀리에 원리", "Le Chatelier's principle", 2, "평형이 깨지면 그 변화를 줄이는 쪽으로 이동"],
    ["깁스 자유 에너지", "Gibbs free energy", 2, "반응이 저절로 일어날지 판단하는 에너지"],
    ["활성화 에너지", "Activation energy", 2, "반응이 일어나려면 넘어야 하는 에너지 장벽"],
    ["촉매", "Catalysis", 2, "자신은 변하지 않고 반응을 빠르게 하는 작용"],
    ["아레니우스 식", "Arrhenius equation", 3, "온도에 따른 반응 속도 상수의 변화"],
    ["헤스의 법칙", "Hess's law", 2, "반응열은 경로와 관계없이 처음과 끝 상태로 정해진다"],
    ["반응 차수", "Rate equation", 3, "반응 속도가 농도에 어떻게 의존하는지 나타내는 식"],
  ],
  "ch-analytic": [
    ["적정", "Titration", 1, "농도를 아는 용액으로 미지 농도를 알아내는 방법"],
    ["크로마토그래피", "Chromatography", 1, "혼합물을 이동 속도 차이로 분리하는 방법"],
    ["분광학", "Spectroscopy", 2, "빛과 물질의 상호작용으로 성분을 분석"],
    ["질량 분석법", "Mass spectrometry", 2, "이온의 질량 대 전하 비로 물질을 확인"],
    ["완충 용액", "Buffer solution", 2, "산·염기를 넣어도 pH가 잘 변하지 않는 용액"],
    ["갈바니 전지", "Galvanic cell", 2, "산화 환원 반응으로 전기를 만드는 전지"],
    ["전기 분해", "Electrolysis", 2, "전기를 흘려 화합물을 분해하는 반응"],
    ["표준 전극 전위", "Standard electrode potential", 3, "표준 상태에서 전극이 가지는 환원 전위"],
    ["네른스트 식", "Nernst equation", 3, "농도에 따른 전극 전위를 구하는 식"],
    ["핵자기 공명 분광법", "Nuclear magnetic resonance spectroscopy", 3, "원자핵 스핀으로 분자 구조를 알아내는 분석법"],
  ],
};
