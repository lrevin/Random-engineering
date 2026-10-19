// 항공우주공학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const AERO_CATEGORIES: CategoryDef[] = [
  { id: "ae-aero", name: "공기역학", emoji: "🌬️" },
  { id: "ae-prop", name: "추진기관", emoji: "🔥" },
  { id: "ae-flight", name: "비행역학·항공기 구조", emoji: "✈️" },
  { id: "ae-space", name: "우주·궤도역학", emoji: "🛰️" },
];

export const AERO_RAW: Record<string, RawTopic[]> = {
  "ae-aero": [
    ["양력", "Lift (force)", 1, "비행기가 하늘에 뜰 수 있게 하는 힘"],
    ["항력", "Drag (physics)", 1, "물체의 운동을 방해하는 유체의 저항력"],
    ["베르누이 정리", "Bernoulli's principle", 1, "유체의 속도와 압력 사이의 관계"],
    ["받음각", "Angle of attack", 1, "날개와 흐름 방향이 이루는 각도"],
    ["마하 수", "Mach number", 2, "비행 속도를 소리의 속도와 비교한 값"],
    ["레이놀즈 수", "Reynolds number", 2, "관성력과 점성력의 비로 흐름을 구분"],
    ["경계층", "Boundary layer", 2, "물체 표면 근처 점성이 지배하는 얇은 층"],
    ["충격파", "Shock wave", 2, "초음속 흐름에서 생기는 급격한 압력 변화"],
    ["쿠타-주코프스키 정리", "Kutta–Joukowski theorem", 3, "순환과 양력을 연결하는 이론"],
    ["유도항력", "Lift-induced drag", 3, "양력을 만드는 대가로 생기는 저항"],
  ],
  "ae-prop": [
    ["추력", "Thrust", 1, "항공기를 앞으로 밀어내는 반작용 힘"],
    ["터보제트 엔진", "Turbojet", 1, "흡입·압축·연소·배기로 추력을 얻는 엔진"],
    ["터보팬 엔진", "Turbofan", 1, "여객기에 주로 쓰이는 바이패스 엔진"],
    ["로켓 엔진", "Rocket engine", 1, "산화제를 싣고 다니는 반작용 엔진"],
    ["브레이턴 사이클", "Brayton cycle", 2, "가스터빈의 이상적인 열역학 사이클"],
    ["비추력", "Specific impulse", 2, "추진제의 효율을 나타내는 지표"],
    ["치올코프스키 로켓 방정식", "Tsiolkovsky rocket equation", 2, "로켓의 속도 변화와 질량비의 관계"],
    ["드 라발 노즐", "De Laval nozzle", 2, "배기가스를 초음속으로 가속하는 노즐"],
    ["스크램제트", "Scramjet", 3, "초음속 연소를 이용하는 공기흡입 엔진"],
    ["에어로스파이크 엔진", "Aerospike engine", 3, "고도에 따라 팽창이 보정되는 노즐 엔진"],
  ],
  "ae-flight": [
    ["에일러론 (도움날개)", "Aileron", 1, "항공기의 좌우 기울기를 조종하는 면"],
    ["승강타", "Elevator (aeronautics)", 1, "기수를 올리거나 내리는 조종면"],
    ["방향타", "Rudder", 1, "기수의 좌우 방향을 바꾸는 조종면"],
    ["항공기 기준축 (롤·피치·요)", "Aircraft principal axes", 1, "항공기 회전을 설명하는 세 개의 축"],
    ["실속", "Stall (fluid dynamics)", 2, "받음각이 너무 커져 양력을 잃는 현상"],
    ["세로 정적 안정성", "Longitudinal static stability", 2, "피치 방향 교란 후 되돌아오려는 성질"],
    ["모노코크 구조", "Monocoque", 2, "외피가 하중을 함께 지지하는 동체 구조"],
    ["하중 배수", "Load factor (aeronautics)", 2, "선회·기동 시 기체가 받는 하중의 배율"],
    ["더치 롤", "Dutch roll", 3, "요와 롤이 결합된 진동 운동"],
    ["공탄성", "Aeroelasticity", 3, "공기력과 구조 변형이 상호작용하는 현상"],
  ],
  "ae-space": [
    ["케플러 법칙", "Kepler's laws of planetary motion", 1, "행성 궤도의 모양과 주기에 관한 법칙"],
    ["탈출 속도", "Escape velocity", 1, "천체의 중력을 벗어나기 위한 최소 속도"],
    ["정지 궤도", "Geostationary orbit", 1, "지상에서 보면 멈춰 있는 위성의 궤도"],
    ["대기권 재진입", "Atmospheric entry", 1, "우주선이 대기로 돌아올 때의 가열 문제"],
    ["궤도 요소", "Orbital elements", 2, "궤도를 정의하는 여섯 개의 매개변수"],
    ["호만 전이 궤도", "Hohmann transfer orbit", 2, "두 원궤도 사이를 옮겨 가는 효율적 경로"],
    ["라그랑주 점", "Lagrange point", 2, "두 천체의 중력이 균형을 이루는 위치"],
    ["중력 도움 (스윙바이)", "Gravity assist", 2, "행성 중력을 이용해 속도를 얻는 기법"],
    ["램버트 문제", "Lambert's problem", 3, "두 위치와 비행시간으로 궤도를 구하는 문제"],
    ["반작용 휠", "Reaction wheel", 3, "회전 관성으로 위성 자세를 제어하는 장치"],
  ],
};
