// 지구과학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const EARTH_CATEGORIES: CategoryDef[] = [
  { id: "ea-geo", name: "지질·지구 내부", emoji: "🪨" },
  { id: "ea-atmo", name: "대기·해양", emoji: "🌦️" },
  { id: "ea-astro", name: "천문학", emoji: "🔭" },
];

export const EARTH_RAW: Record<string, RawTopic[]> = {
  "ea-geo": [
    ["판 구조론", "Plate tectonics", 1, "지각이 여러 판으로 나뉘어 움직인다는 이론"],
    ["지진", "Earthquake", 1, "땅속에 쌓인 힘이 풀리며 땅이 흔들리는 현상"],
    ["화산", "Volcano", 1, "마그마가 지표로 분출하는 곳"],
    ["암석의 순환", "Rock cycle", 1, "화성암·퇴적암·변성암이 서로 바뀌는 순환"],
    ["지구 내부 구조", "Internal structure of Earth", 2, "지각·맨틀·외핵·내핵으로 이루어진 층"],
    ["지진파", "Seismic wave", 2, "지진으로 생겨 땅속을 전달되는 P파·S파 등"],
    ["광물", "Mineral", 2, "자연에서 생긴 일정한 화학 조성의 결정질 고체"],
    ["방사성 연대 측정", "Radiometric dating", 2, "방사성 동위원소의 반감기로 나이를 재는 방법"],
    ["지자기", "Earth's magnetic field", 3, "지구 외핵의 운동으로 생기는 자기장"],
    ["지질 시대", "Geologic time scale", 3, "지구의 역사를 누대·대·기로 나눈 시간 척도"],
  ],
  "ea-atmo": [
    ["대기권", "Atmosphere of Earth", 1, "지구를 둘러싼 공기층과 그 층 구조"],
    ["온실 효과", "Greenhouse effect", 1, "대기가 지표의 열을 붙잡아 따뜻하게 하는 현상"],
    ["기압", "Atmospheric pressure", 1, "공기의 무게가 누르는 압력"],
    ["전선 (기상)", "Weather front", 2, "성질이 다른 두 기단이 만나는 경계"],
    ["코리올리 효과", "Coriolis force", 2, "지구 자전 때문에 움직이는 물체가 휘어 보이는 효과"],
    ["태풍", "Tropical cyclone", 2, "열대 바다에서 발달하는 강한 저기압 폭풍"],
    ["해류", "Ocean current", 2, "바닷물이 일정한 방향으로 흐르는 것"],
    ["엘니뇨-남방 진동", "El Niño–Southern Oscillation", 3, "적도 태평양 수온과 기압이 주기적으로 바뀌는 현상"],
    ["열염 순환", "Thermohaline circulation", 3, "수온과 염분 차이로 일어나는 깊은 바다의 순환"],
    ["단열 과정", "Adiabatic process", 3, "열 출입 없이 공기가 팽창·압축하며 온도가 바뀜"],
  ],
  "ea-astro": [
    ["태양계", "Solar System", 1, "태양과 그 주위를 도는 행성·위성 등의 체계"],
    ["케플러 행성 운동 법칙", "Kepler's laws of planetary motion", 1, "행성 궤도에 관한 세 가지 법칙"],
    ["항성", "Star", 1, "핵융합으로 스스로 빛을 내는 천체"],
    ["은하", "Galaxy", 1, "별·가스·암흑 물질이 중력으로 묶인 거대한 집단"],
    ["항성 진화", "Stellar evolution", 2, "별이 태어나 죽기까지 변하는 과정"],
    ["헤르츠스프룽-러셀 도표", "Hertzsprung–Russell diagram", 2, "별의 광도와 표면 온도를 나타낸 도표"],
    ["허블-르메트르 법칙", "Hubble's law", 2, "먼 은하일수록 빠르게 멀어진다는 법칙"],
    ["블랙홀", "Black hole", 2, "빛조차 빠져나올 수 없는 중력이 강한 천체"],
    ["빅뱅", "Big Bang", 3, "우주가 아주 뜨겁고 조밀한 상태에서 팽창했다는 이론"],
    ["우주 마이크로파 배경", "Cosmic microwave background", 3, "빅뱅의 흔적으로 남은 우주 전체의 마이크로파"],
  ],
};
