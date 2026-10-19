// 토목공학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const CIVIL_CATEGORIES: CategoryDef[] = [
  { id: "cv-struct", name: "구조역학", emoji: "🌉" },
  { id: "cv-geo", name: "토질·지반공학", emoji: "⛰️" },
  { id: "cv-hydro", name: "수리·수문학", emoji: "💧" },
  { id: "cv-transport", name: "교통·측량", emoji: "🛣️" },
  { id: "cv-concrete", name: "콘크리트·건설재료", emoji: "🧱" },
];

export const CIVIL_RAW: Record<string, RawTopic[]> = {
  "cv-struct": [
    ["응력", "Stress (mechanics)", 1, "단위 면적당 작용하는 내력"],
    ["훅의 법칙", "Hooke's law", 1, "탄성 범위에서 하중과 변형의 비례"],
    ["휨모멘트", "Bending moment", 1, "보를 구부리려는 내부 모멘트"],
    ["전단력", "Shear force", 1, "단면을 미끄러지게 하려는 내력"],
    ["단면2차모멘트", "Second moment of area", 2, "단면 형상이 휨에 저항하는 정도"],
    ["좌굴", "Buckling", 2, "압축 부재가 옆으로 휘며 무너지는 현상"],
    ["모어 원", "Mohr's circle", 2, "회전한 면의 응력을 원으로 구하는 법"],
    ["부정정 구조물", "Statically indeterminate", 3, "평형방정식만으로 풀 수 없는 구조"],
    ["모멘트 분배법", "Moment distribution method", 3, "반복 계산으로 연속보를 해석하는 방법"],
    ["가상일의 원리", "Virtual work", 3, "가상 변위로 처짐과 반력을 구하는 원리"],
  ],
  "cv-geo": [
    ["간극비", "Void ratio", 1, "흙 속 빈 공간과 흙 입자 부피의 비"],
    ["애터버그 한계", "Atterberg limits", 1, "함수비에 따른 세립토의 상태 변화"],
    ["다르시 법칙", "Darcy's law", 1, "흙 속을 흐르는 물의 유량과 동수경사"],
    ["표준관입시험 (SPT)", "Standard penetration test", 1, "타격 횟수 N값으로 지반 강도 추정"],
    ["유효응력", "Effective stress", 2, "흙 입자 골격이 실제로 받는 응력"],
    ["압밀", "Consolidation (soil)", 2, "간극수가 빠지며 점토가 서서히 침하"],
    ["모어-쿨롱 파괴 기준", "Mohr–Coulomb theory", 2, "점착력과 내부마찰각으로 본 전단강도"],
    ["액상화", "Soil liquefaction", 3, "지진 시 포화 모래가 액체처럼 변함"],
    ["토압", "Lateral earth pressure", 3, "옹벽에 작용하는 흙의 수평 압력"],
    ["사면안정 해석", "Slope stability analysis", 3, "비탈면이 무너지지 않을지 판단하는 법"],
  ],
  "cv-hydro": [
    ["베르누이 방정식", "Bernoulli's principle", 1, "흐름에서 압력·속도·위치 에너지 보존"],
    ["연속 방정식", "Continuity equation", 1, "단면이 바뀌어도 유량은 일정"],
    ["정수역학", "Hydrostatics", 1, "정지한 유체 속 깊이에 따른 압력"],
    ["아르키메데스의 원리", "Archimedes' principle", 1, "잠긴 물체가 받는 부력의 크기"],
    ["다르시-바이스바흐 식", "Darcy–Weisbach equation", 2, "관로 마찰에 의한 손실수두 계산"],
    ["매닝 공식", "Manning formula", 2, "조도계수로 개수로 유속을 구하는 식"],
    ["프루드 수", "Froude number", 2, "상류와 사류를 구분하는 무차원수"],
    ["도수", "Hydraulic jump", 2, "사류가 상류로 급변하며 수면이 뛰는 현상"],
    ["단위유량도", "Unit hydrograph", 3, "단위 유효우량에 대한 유역의 유출 응답"],
    ["SCS 유출곡선지수 (CN)", "Runoff curve number", 3, "토지 이용으로 직접유출량을 추정하는 법"],
  ],
  "cv-transport": [
    ["수준측량", "Levelling", 1, "두 지점 사이 높이 차를 재는 측량"],
    ["삼각측량", "Triangulation (surveying)", 1, "삼각형 망으로 위치를 정하는 측량"],
    ["위성측위시스템 (GNSS)", "Satellite navigation", 1, "위성 신호로 지상 위치를 결정"],
    ["지리정보시스템 (GIS)", "Geographic information system", 1, "공간 데이터를 저장·분석하는 시스템"],
    ["트래버스 측량", "Traverse (surveying)", 2, "측선의 길이와 각을 이어가는 측량"],
    ["교통류 기본도", "Fundamental diagram of traffic flow", 2, "교통량·속도·밀도 사이의 관계"],
    ["서비스 수준 (LOS)", "Level of service (transportation)", 2, "도로 운영 상태를 등급으로 평가"],
    ["편경사", "Cant (road and rail)", 2, "곡선부에서 바깥쪽을 높이는 이유"],
    ["완화곡선 (클로소이드)", "Euler spiral", 3, "직선과 원곡선을 부드럽게 잇는 곡선"],
    ["교통수요 예측 (4단계 모형)", "Transportation forecasting", 3, "통행 발생·분포·수단·배정의 단계"],
  ],
  "cv-concrete": [
    ["물-시멘트비", "Water–cement ratio", 1, "배합수 양이 강도와 내구성에 주는 영향"],
    ["포틀랜드 시멘트", "Portland cement", 1, "가장 널리 쓰이는 시멘트와 그 원료"],
    ["골재", "Construction aggregate", 1, "콘크리트 부피 대부분을 차지하는 재료"],
    ["슬럼프 시험", "Concrete slump test", 1, "굳지 않은 콘크리트의 반죽질기 측정"],
    ["철근콘크리트", "Reinforced concrete", 2, "인장은 철근, 압축은 콘크리트가 분담"],
    ["프리스트레스트 콘크리트 (PSC)", "Prestressed concrete", 2, "미리 압축력을 넣어 인장을 상쇄"],
    ["크리프", "Creep (deformation)", 2, "일정 하중 아래 시간에 따라 늘어나는 변형"],
    ["포졸란", "Pozzolan", 2, "플라이애시 같은 혼화재의 작용 원리"],
    ["알칼리-골재 반응", "Alkali–silica reaction", 3, "골재와 시멘트 알칼리의 팽창 반응"],
    ["한계상태설계법", "Limit state design", 3, "강도와 사용성 한계로 안전을 검토"],
  ],
};
