// 화학공학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const CHE_CATEGORIES: CategoryDef[] = [
  { id: "che-thermo", name: "화공열역학", emoji: "🌡️" },
  { id: "che-reaction", name: "반응공학", emoji: "⚗️" },
  { id: "che-transport", name: "이동현상", emoji: "🌊" },
  { id: "che-unit", name: "단위조작·분리공정", emoji: "🧪" },
  { id: "che-process", name: "공정설계·제어", emoji: "🏭" },
];

export const CHE_RAW: Record<string, RawTopic[]> = {
  "che-thermo": [
    ["이상기체 상태방정식", "Ideal gas law", 1, "기체의 압력·부피·온도 사이의 관계"],
    ["열역학 제1법칙", "First law of thermodynamics", 1, "에너지는 형태만 바뀔 뿐 보존된다"],
    ["엔트로피", "Entropy", 1, "무질서도와 자발적 과정의 방향"],
    ["라울의 법칙", "Raoult's law", 1, "이상용액에서 성분의 증기압 계산"],
    ["깁스 자유 에너지", "Gibbs free energy", 2, "등온·등압에서 반응의 자발성 판단 기준"],
    ["반데르발스 상태방정식", "Van der Waals equation", 2, "분자 크기와 인력을 보정한 실제기체 식"],
    ["랭킨 사이클", "Rankine cycle", 2, "증기를 이용한 발전소의 열기관 사이클"],
    ["퓨개시티", "Fugacity", 3, "실제기체의 압력을 대신하는 유효 압력"],
    ["활동도 계수", "Activity coefficient", 3, "비이상용액이 이상에서 벗어난 정도"],
    ["줄-톰슨 효과", "Joule–Thomson effect", 3, "기체가 교축 팽창할 때의 온도 변화"],
  ],
  "che-reaction": [
    ["반응속도식", "Rate equation", 1, "농도와 반응속도를 잇는 식과 반응차수"],
    ["아레니우스 식", "Arrhenius equation", 1, "온도와 활성화에너지가 속도상수에 주는 영향"],
    ["회분식 반응기", "Batch reactor", 1, "원료를 한 번에 넣고 반응시키는 반응기"],
    ["연속교반탱크반응기 (CSTR)", "Continuous stirred-tank reactor", 1, "완전 혼합 상태로 연속 운전하는 반응기"],
    ["플러그 흐름 반응기 (PFR)", "Plug flow reactor model", 2, "관 속을 축방향 혼합 없이 흐르는 반응기"],
    ["촉매", "Catalysis", 2, "소모되지 않고 반응 경로를 바꾸는 물질"],
    ["랭뮤어 흡착 등온식", "Langmuir adsorption model", 2, "단분자층 흡착과 표면 덮임률"],
    ["체류시간 분포 (RTD)", "Residence time distribution", 3, "반응기 속 유체 입자가 머무는 시간의 분포"],
    ["티엘레 계수", "Thiele modulus", 3, "촉매 기공 내 확산과 반응속도의 비교"],
    ["미카엘리스-멘텐 속도론", "Michaelis–Menten kinetics", 3, "효소 반응의 기질 농도와 속도 관계"],
  ],
  "che-transport": [
    ["점성", "Viscosity", 1, "유체가 흐름에 저항하는 성질"],
    ["레이놀즈 수", "Reynolds number", 1, "층류와 난류를 가르는 무차원수"],
    ["열전도 (푸리에 법칙)", "Thermal conduction", 1, "온도 기울기에 따른 고체 내 열 이동"],
    ["픽의 확산 법칙", "Fick's laws of diffusion", 1, "농도 기울기에 따른 물질 이동"],
    ["경계층", "Boundary layer", 2, "벽면 근처 속도가 급변하는 얇은 영역"],
    ["대류 열전달 계수", "Heat transfer coefficient", 2, "유체와 표면 사이 열 이동의 세기"],
    ["누셀트 수", "Nusselt number", 2, "대류와 전도 열전달의 비"],
    ["슈테판-볼츠만 법칙", "Stefan–Boltzmann law", 2, "흑체가 내는 복사 에너지와 온도"],
    ["나비에-스토크스 방정식", "Navier–Stokes equations", 3, "점성 유체의 운동량 보존 방정식"],
    ["칠턴-콜번 유사성", "Chilton and Colburn J-factor analogy", 3, "운동량·열·물질 전달 사이의 상사성"],
  ],
  "che-unit": [
    ["증류", "Distillation", 1, "끓는점 차이를 이용한 액체 혼합물 분리"],
    ["기체 흡수", "Absorption (chemistry)", 1, "기체 성분을 액체 용매에 녹여 분리"],
    ["액액추출", "Liquid–liquid extraction", 1, "섞이지 않는 두 액체 간 용해도 차 이용"],
    ["열교환기", "Heat exchanger", 1, "두 유체 사이에 열을 주고받는 장치"],
    ["상대휘발도", "Relative volatility", 2, "두 성분의 증류 분리 용이성 척도"],
    ["이론단", "Theoretical plate", 2, "기액 평형에 도달하는 가상의 단"],
    ["대수평균온도차 (LMTD)", "Logarithmic mean temperature difference", 2, "열교환기 설계에 쓰는 평균 온도차"],
    ["역삼투", "Reverse osmosis", 2, "압력을 가해 막으로 용매를 걸러내는 공정"],
    ["맥케이브-틸레 법", "McCabe–Thiele method", 3, "작도로 증류탑 단수를 구하는 방법"],
    ["펜스케 식", "Fenske equation", 3, "전환류에서의 최소 이론단수 계산"],
  ],
  "che-process": [
    ["물질수지", "Mass balance", 1, "들어온 양 = 나간 양 + 축적 + 소모"],
    ["공정흐름도 (PFD)", "Process flow diagram", 1, "주요 설비와 흐름을 그린 공정 도면"],
    ["라플라스 변환", "Laplace transform", 1, "미분방정식을 대수식으로 바꾸는 도구"],
    ["시간상수", "Time constant", 1, "1차 시스템 응답이 얼마나 빠른가"],
    ["PID 제어기", "Proportional–integral–derivative controller", 2, "비례·적분·미분 동작을 결합한 제어기"],
    ["전달함수", "Transfer function", 2, "입력과 출력의 관계를 s영역에서 표현"],
    ["위험과 운전분석 (HAZOP)", "Hazard and operability study", 2, "가이드워드로 공정 위험을 찾는 기법"],
    ["보드 선도", "Bode plot", 3, "주파수에 따른 이득과 위상 그래프"],
    ["지글러-니콜스 튜닝", "Ziegler–Nichols method", 3, "제어기 파라미터를 경험적으로 정하는 법"],
    ["핀치 분석", "Pinch analysis", 3, "열 회수를 최대화하는 열교환망 설계"],
  ],
};
