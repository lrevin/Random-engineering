// 물리학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const PHYS_CATEGORIES: CategoryDef[] = [
  { id: "ph-mech", name: "일반역학", emoji: "🍎" },
  { id: "ph-em", name: "전자기학", emoji: "🧲" },
  { id: "ph-thermo", name: "열·통계물리", emoji: "🌡️" },
  { id: "ph-wave", name: "파동·광학", emoji: "🌊" },
  { id: "ph-modern", name: "현대물리", emoji: "⚛️" },
];

export const PHYS_RAW: Record<string, RawTopic[]> = {
  "ph-mech": [
    ["뉴턴 운동 법칙", "Newton's laws of motion", 1, "관성·가속도·작용 반작용의 세 법칙"],
    ["운동량", "Momentum", 1, "질량과 속도의 곱으로 나타내는 운동의 양"],
    ["일 (물리학)", "Work (physics)", 1, "힘이 물체를 움직이며 전달한 에너지"],
    ["에너지 보존 법칙", "Conservation of energy", 1, "닫힌 계의 전체 에너지는 변하지 않는다는 법칙"],
    ["원운동", "Circular motion", 2, "구심력을 받아 원 궤도를 도는 운동"],
    ["단조화 운동", "Simple harmonic motion", 2, "복원력이 변위에 비례하는 진동"],
    ["각운동량", "Angular momentum", 2, "회전하는 물체의 운동량"],
    ["토크", "Torque", 2, "물체를 회전시키는 힘의 효과"],
    ["관성 모멘트", "Moment of inertia", 3, "회전 운동에서 질량 역할을 하는 양"],
    ["라그랑주 역학", "Lagrangian mechanics", 3, "에너지로 운동 방정식을 세우는 해석역학"],
  ],
  "ph-em": [
    ["쿨롱 법칙", "Coulomb's law", 1, "두 전하 사이의 힘은 거리의 제곱에 반비례"],
    ["전기장", "Electric field", 1, "전하가 주변 공간에 만드는 힘의 장"],
    ["자기장", "Magnetic field", 1, "움직이는 전하나 자석이 만드는 장"],
    ["전위", "Electric potential", 1, "단위 전하가 가지는 전기적 위치 에너지"],
    ["가우스 법칙", "Gauss's law", 2, "닫힌 곡면을 지나는 전기 선속과 내부 전하의 관계"],
    ["로런츠 힘", "Lorentz force", 2, "전기장과 자기장 속 전하가 받는 힘"],
    ["패러데이 전자기 유도 법칙", "Faraday's law of induction", 2, "자기 선속이 변하면 기전력이 생긴다는 법칙"],
    ["앙페르 회로 법칙", "Ampère's circuital law", 2, "전류와 그 주위 자기장의 관계"],
    ["맥스웰 방정식", "Maxwell's equations", 3, "전기와 자기를 하나로 묶은 네 방정식"],
    ["전자기파", "Electromagnetic radiation", 3, "전기장과 자기장이 서로를 만들며 퍼지는 파동"],
  ],
  "ph-thermo": [
    ["온도", "Temperature", 1, "물체의 뜨겁고 차가운 정도를 나타내는 양"],
    ["열역학 제1법칙", "First law of thermodynamics", 1, "내부 에너지 변화 = 받은 열 − 한 일"],
    ["이상 기체 법칙", "Ideal gas law", 1, "압력·부피·온도·몰수 사이의 관계 PV=nRT"],
    ["비열", "Specific heat capacity", 1, "단위 질량의 온도를 1도 올리는 데 드는 열"],
    ["엔트로피", "Entropy", 2, "계의 무질서도, 열역학 제2법칙의 핵심 양"],
    ["열역학 제2법칙", "Second law of thermodynamics", 2, "고립계의 엔트로피는 줄어들지 않는다"],
    ["카르노 기관", "Carnot heat engine", 2, "가장 효율이 높은 이상적인 열기관"],
    ["기체 분자 운동론", "Kinetic theory of gases", 2, "기체의 성질을 분자 운동으로 설명"],
    ["볼츠만 분포", "Boltzmann distribution", 3, "온도에 따라 에너지 상태가 차지되는 확률 분포"],
    ["상전이", "Phase transition", 3, "고체·액체·기체 등 상태가 바뀌는 현상"],
  ],
  "ph-wave": [
    ["파동", "Wave", 1, "진동이 공간으로 퍼져 나가는 현상"],
    ["굴절", "Refraction", 1, "빛이 다른 매질로 들어가며 꺾이는 현상"],
    ["반사 (물리학)", "Reflection (physics)", 1, "파동이 경계면에서 되돌아오는 현상"],
    ["도플러 효과", "Doppler effect", 1, "파원이 움직이면 진동수가 달라지는 현상"],
    ["간섭 (파동)", "Wave interference", 2, "두 파동이 겹쳐 세지거나 약해지는 현상"],
    ["회절", "Diffraction", 2, "파동이 장애물 뒤로 돌아 퍼지는 현상"],
    ["스넬의 법칙", "Snell's law", 2, "굴절 전후 각도와 굴절률의 관계"],
    ["편광", "Polarization (waves)", 2, "횡파의 진동 방향이 한쪽으로 정해진 상태"],
    ["전반사", "Total internal reflection", 3, "임계각보다 크게 입사하면 빛이 모두 반사되는 현상"],
    ["정상파", "Standing wave", 3, "제자리에서 마디와 배가 생기며 진동하는 파동"],
  ],
  "ph-modern": [
    ["광전 효과", "Photoelectric effect", 1, "빛을 쬐면 금속에서 전자가 튀어나오는 현상"],
    ["원자 모형", "Bohr model", 1, "전자가 정해진 궤도에만 있는 보어의 원자 모형"],
    ["특수 상대성 이론", "Special relativity", 2, "빛의 속도는 누구에게나 같다는 데서 출발한 이론"],
    ["질량-에너지 등가", "Mass–energy equivalence", 2, "질량과 에너지는 E=mc²로 서로 바뀐다"],
    ["불확정성 원리", "Uncertainty principle", 2, "위치와 운동량을 동시에 정확히 알 수 없다"],
    ["파동-입자 이중성", "Wave–particle duality", 2, "빛과 물질이 파동이자 입자처럼 행동"],
    ["슈뢰딩거 방정식", "Schrödinger equation", 3, "양자 상태가 시간에 따라 변하는 방식을 나타내는 방정식"],
    ["양자 터널 효과", "Quantum tunnelling", 3, "입자가 에너지 장벽을 뚫고 지나가는 현상"],
    ["방사성 붕괴", "Radioactive decay", 2, "불안정한 원자핵이 방사선을 내며 바뀌는 현상"],
    ["핵분열", "Nuclear fission", 3, "무거운 원자핵이 쪼개지며 에너지를 내는 반응"],
  ],
};
