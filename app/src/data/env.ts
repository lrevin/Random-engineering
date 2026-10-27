// 환경·에너지공학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const ENV_CATEGORIES: CategoryDef[] = [
  { id: "en-water", name: "수질·수처리", emoji: "💧" },
  { id: "en-air", name: "대기오염·기후", emoji: "🌫️" },
  { id: "en-waste", name: "폐기물·토양", emoji: "♻️" },
  { id: "en-energy", name: "신재생에너지", emoji: "☀️" },
];

export const ENV_RAW: Record<string, RawTopic[]> = {
  "en-water": [
    ["생물화학적 산소요구량 (BOD)", "Biochemical oxygen demand", 1, "미생물이 유기물을 분해할 때 쓰는 산소량"],
    ["화학적 산소요구량 (COD)", "Chemical oxygen demand", 1, "산화제로 유기물을 분해할 때 드는 산소량"],
    ["부영양화", "Eutrophication", 1, "영양염류가 넘쳐 조류가 급증하는 현상"],
    ["응집·플록 형성", "Flocculation", 1, "작은 입자를 뭉쳐 가라앉히는 정수 공정"],
    ["활성슬러지법", "Activated sludge", 2, "미생물 덩어리로 하수를 정화하는 대표 공법"],
    ["역삼투", "Reverse osmosis", 2, "압력을 가해 막으로 물만 통과시키는 기술"],
    ["질산화", "Nitrification", 2, "암모니아가 단계적으로 산화되는 생물 반응"],
    ["염소 소독", "Water chlorination", 2, "염소로 병원균을 제거하는 정수 공정"],
    ["막분리 생물반응기 (MBR)", "Membrane bioreactor", 3, "생물 처리와 분리막을 결합한 수처리"],
    ["생물학적 인 제거", "Enhanced biological phosphorus removal", 3, "혐기·호기 조건을 번갈아 인을 제거"],
  ],
  "en-air": [
    ["온실효과", "Greenhouse effect", 1, "대기가 지표의 열을 붙잡아 두는 현상"],
    ["미세먼지 (PM2.5)", "Particulates", 1, "공기 중에 떠다니는 아주 작은 입자"],
    ["오존층 파괴", "Ozone depletion", 1, "성층권 오존이 줄어드는 현상과 원인 물질"],
    ["기온역전", "Inversion (meteorology)", 1, "높이 올라갈수록 기온이 오르는 대기 상태"],
    ["전기집진기", "Electrostatic precipitator", 2, "전기력으로 배기가스 속 먼지를 포집"],
    ["선택적 촉매 환원 (SCR)", "Selective catalytic reduction", 2, "촉매와 환원제로 질소산화물을 제거"],
    ["배연탈황", "Flue-gas desulfurization", 2, "배기가스에서 황산화물을 제거하는 공정"],
    ["대기확산 모델", "Atmospheric dispersion modeling", 3, "오염물질이 퍼지는 농도를 수식으로 예측"],
    ["탄소 포집 및 저장 (CCS)", "Carbon capture and storage", 3, "이산화탄소를 모아 땅속에 가두는 기술"],
    ["지구온난화지수 (GWP)", "Global warming potential", 3, "온실가스의 상대적 온난화 효과 지표"],
  ],
  "en-waste": [
    ["위생 매립", "Landfill", 1, "폐기물을 땅에 묻어 처분하는 방법"],
    ["소각", "Incineration", 1, "폐기물을 태워 부피를 줄이는 처리"],
    ["퇴비화", "Compost", 1, "유기성 폐기물을 미생물로 분해해 비료화"],
    ["순환경제", "Circular economy", 1, "자원을 버리지 않고 계속 순환시키는 경제 모델"],
    ["침출수", "Leachate", 2, "매립지에서 빗물이 오염물을 녹여 흘러나온 물"],
    ["혐기성 소화", "Anaerobic digestion", 2, "산소 없이 유기물을 분해해 메탄을 얻는 공정"],
    ["생물학적 정화 (바이오레메디에이션)", "Bioremediation", 2, "미생물로 오염된 토양·지하수를 정화"],
    ["토양 증기 추출 (SVE)", "Soil vapor extraction", 2, "토양 속 휘발성 오염물을 진공으로 뽑아냄"],
    ["다이옥신", "Polychlorinated dibenzodioxins", 3, "소각 과정에서 생길 수 있는 맹독성 물질"],
    ["열분해", "Pyrolysis", 3, "산소 없이 가열해 물질을 분해하는 공정"],
  ],
  "en-energy": [
    ["태양광 발전", "Photovoltaics", 1, "빛을 직접 전기로 바꾸는 발전 방식"],
    ["풍력 발전", "Wind power", 1, "바람의 운동에너지로 전기를 만드는 방식"],
    ["연료전지", "Fuel cell", 1, "수소와 산소의 화학반응으로 전기를 생산"],
    ["지열 에너지", "Geothermal energy", 1, "땅속 열을 난방·발전에 이용"],
    ["p-n 접합", "P–n junction", 2, "태양전지와 다이오드의 핵심이 되는 반도체 구조"],
    ["최대전력점 추적 (MPPT)", "Maximum power point tracking", 2, "발전 출력이 가장 큰 지점을 계속 찾는 제어"],
    ["베츠의 법칙", "Betz's law", 2, "풍차가 바람에서 뽑을 수 있는 에너지의 한계"],
    ["에너지 저장 장치 (ESS)", "Grid energy storage", 2, "남는 전력을 저장했다 필요할 때 공급"],
    ["수전해", "Electrolysis of water", 3, "전기로 물을 분해해 수소를 얻는 방법"],
    ["균등화 발전원가 (LCOE)", "Levelized cost of electricity", 3, "발전원별 전기 생산 단가를 비교하는 지표"],
  ],
};
