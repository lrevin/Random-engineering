// 분야별 "함께 공부하면 좋은 연관 분야"
// 온보딩에서 분야를 고르면, 그 분야의 바탕이 되는 다른 분야(과학·수학 포함)의 세부 분야를 추천합니다.
// 형식: 분야 id → [세부 분야 id, 추천 이유]

export const RELATED: Record<string, [category: string, why: string][]> = {
  it: [
    ["ma-linalg", "AI·그래픽스·데이터 분석의 바탕"],
    ["ma-prob", "머신러닝(ML)·데이터의 바탕"],
    ["ma-calc", "최적화·머신러닝 학습의 바탕"],
    ["ee-circuit", "컴퓨터구조·하드웨어의 바탕"],
    ["ee-signal", "통신·멀티미디어 처리의 바탕"],
    ["ee-comm", "네트워크의 물리적 바탕"],
  ],
  ee: [
    ["ph-em", "전기·자기 현상의 원리"],
    ["ma-eng", "회로·신호 해석에 쓰는 변환"],
    ["ma-calc", "전기 이론의 수학적 바탕"],
    ["ma-linalg", "회로망·제어 해석"],
    ["arch", "디지털 회로가 쓰이는 컴퓨터구조"],
  ],
  me: [
    ["ph-mech", "4대 역학의 출발점"],
    ["ph-thermo", "열역학·열기관의 원리"],
    ["ma-calc", "역학 해석의 수학적 바탕"],
    ["ma-eng", "진동·동역학의 미분 방정식"],
    ["mt-mech", "재료의 강도와 변형"],
  ],
  che: [
    ["ch-general", "화학 반응의 기본"],
    ["ch-physical", "평형·반응 속도의 원리"],
    ["ch-organic", "고분자·석유화학의 바탕"],
    ["ph-thermo", "화공열역학의 원리"],
    ["ma-eng", "공정 모델의 미분 방정식"],
  ],
  civil: [
    ["ph-mech", "구조역학의 출발점"],
    ["me-solid", "부재의 응력과 변형"],
    ["me-fluid", "수리학의 바탕"],
    ["ea-geo", "지반·지진의 이해"],
    ["ma-calc", "구조 해석의 수학적 바탕"],
  ],
  arch: [
    ["cv-struct", "건축구조의 해석 원리"],
    ["ph-mech", "힘과 평형의 원리"],
    ["ph-thermo", "건물의 열환경 이해"],
    ["en-energy", "친환경 건축 에너지"],
  ],
  mat: [
    ["ch-general", "원자·결합의 이해"],
    ["ch-physical", "상평형·반응의 원리"],
    ["ph-modern", "고체 속 전자의 이해"],
    ["ph-thermo", "상변태의 열역학"],
  ],
  ie: [
    ["ma-prob", "품질관리·통계 분석의 바탕"],
    ["ma-linalg", "선형계획법의 바탕"],
    ["algo", "최적화·스케줄링 알고리즘"],
    ["ai", "데이터 기반 의사결정"],
  ],
  env: [
    ["ch-general", "오염 물질의 화학"],
    ["ch-analytic", "수질·대기 분석"],
    ["ea-atmo", "대기·기후의 원리"],
    ["lf-eco", "생태계와 물질 순환"],
  ],
  aero: [
    ["ph-mech", "비행역학의 출발점"],
    ["me-fluid", "공기역학의 바탕"],
    ["me-thermo", "추진기관의 열역학"],
    ["ea-astro", "궤도와 우주 환경"],
    ["ma-eng", "비행 동역학의 미분 방정식"],
  ],
  bio: [
    ["lf-cell", "세포 수준의 생명 현상"],
    ["lf-genetics", "유전공학의 바탕"],
    ["lf-physio", "의공학이 다루는 인체"],
    ["ch-organic", "생체 분자의 화학"],
  ],
  math: [
    ["theory", "이산수학·계산 이론"],
    ["ph-mech", "수학이 쓰이는 대표 분야"],
    ["ai", "수학이 쓰이는 AI·데이터"],
  ],
  phys: [
    ["ma-calc", "물리 법칙을 적는 언어"],
    ["ma-linalg", "양자역학·역학의 수학"],
    ["ma-eng", "파동·진동의 미분 방정식"],
    ["ee-circuit", "전자기학의 응용"],
  ],
  chem: [
    ["ph-thermo", "물리화학의 바탕"],
    ["ph-modern", "원자 구조의 양자역학"],
    ["che-reaction", "화학이 쓰이는 반응공학"],
  ],
  life: [
    ["ch-organic", "생체 분자의 화학"],
    ["ch-general", "생화학의 기본"],
    ["bm-genetic", "유전공학 응용"],
  ],
  earth: [
    ["ph-thermo", "대기·지구 내부의 열"],
    ["ph-wave", "지진파·전자기파의 이해"],
    ["en-air", "대기오염·기후 변화"],
  ],
};

/** 고른 분야들에 대한 연관 세부 분야 (이미 고른 분야에 속한 것은 뺌, 중복 제거) */
export function relatedFor(domains: string[], domainOf: (category: string) => string | undefined) {
  const seen = new Set<string>();
  const out: { category: string; why: string; from: string }[] = [];
  for (const d of domains) {
    for (const [category, why] of RELATED[d] ?? []) {
      const owner = domainOf(category);
      if (!owner || domains.includes(owner) || seen.has(category)) continue;
      seen.add(category);
      out.push({ category, why, from: d });
    }
  }
  return out;
}
