// 취득하려는 자격증 → 시험 과목별로 공부할 주제
// 관심 분야(prefs.interests)에 자격증 id("cert-…")를 함께 저장하고, 그 자격증의 주제가 랜덤 주제 후보에 들어갑니다.
// 주제는 기존 분야의 주제 id(예: "db-07")나 세부 분야 id 전체(예: "ma-prob")로 적습니다.
// 기존 주제를 쓰므로 문제 은행·위키 연결을 그대로 씁니다.

export interface CertSubject {
  name: string;
  /** 주제 id("db-07") 또는 세부 분야 id("ma-prob": 그 분야 주제 전부) */
  items: string[];
}

export interface CertDef {
  id: string;
  name: string;
  /** 시행 기관 */
  org: string;
  /** 짧은 설명 (등급·대상) */
  description: string;
  subjects: CertSubject[];
}

const r = (cat: string, ...nums: number[]) => nums.map((n) => `${cat}-${String(n).padStart(2, "0")}`);
const range = (cat: string, from: number, to: number) => r(cat, ...Array.from({ length: to - from + 1 }, (_, i) => from + i));

export const CERTS: CertDef[] = [
  {
    id: "cert-ipe", name: "정보처리기사", org: "한국산업인력공단", description: "소프트웨어 개발 전반 · 4년제 졸업(예정)",
    subjects: [
      { name: "소프트웨어 설계", items: [...range("se", 1, 18)] },
      { name: "소프트웨어 개발", items: [...r("ds", 1, 2, 5, 9, 10, 11, 16, 19), ...r("algo", 1, 3, 4, 5, 6, 7, 11), ...range("se", 19, 26)] },
      { name: "데이터베이스 구축", items: [...range("db", 1, 23)] },
      { name: "프로그래밍 언어 활용", items: [...r("pl", 1, 10, 14, 15, 16, 17, 18, 19, 26), ...r("os", 1, 2, 5, 6, 7, 10, 17, 18, 19, 20, 23), ...r("net", 1, 2, 4, 5, 6, 8, 9, 11)] },
      { name: "정보시스템 구축 관리", items: [...r("se", 4, 5, 27, 28, 30, 31), ...r("sec", 1, 2, 3, 8, 9, 16, 29, 38, 39, 40, 42, 43, 50, 63)] },
    ],
  },
  {
    id: "cert-ipi", name: "정보처리산업기사", org: "한국산업인력공단", description: "정보처리기사보다 범위가 좁은 실무 중심 시험",
    subjects: [
      { name: "정보시스템 기반 기술", items: [...r("os", 1, 2, 5, 7, 17, 18), ...r("net", 1, 2, 4, 5, 6, 9)] },
      { name: "프로그래밍 언어 활용", items: [...r("pl", 1, 10, 14, 15, 16, 17, 26), ...r("ds", 1, 2, 5, 9, 10), ...r("algo", 3, 4, 5, 11)] },
      { name: "데이터베이스 활용", items: [...r("db", 1, 2, 3, 4, 5, 6, 7, 9, 12, 18, 19, 20)] },
      { name: "보안·관리", items: [...r("se", 1, 2, 4, 6, 7, 18, 19), ...r("sec", 1, 2, 8, 9, 38)] },
    ],
  },
  {
    id: "cert-ipc", name: "정보처리기능사", org: "한국산업인력공단", description: "입문 단계 · 응시 자격 제한 없음",
    subjects: [
      { name: "프로그래밍 기초", items: [...r("pl", 1, 10, 14, 15, 16), ...r("ds", 1, 2, 3, 5), ...r("algo", 3, 4, 5, 11)] },
      { name: "데이터베이스 기초", items: [...r("db", 1, 2, 3, 5, 6, 7, 12, 18)] },
      { name: "운영체제 기초", items: [...r("os", 1, 2, 5, 7, 17, 26, 27)] },
      { name: "네트워크·보안 기초", items: [...r("net", 1, 4, 5, 9), ...r("sec", 1, 8, 9, 38)] },
      { name: "컴퓨터 기초", items: [...r("arch", 1, 2, 4, 6, 13)] },
    ],
  },
  {
    id: "cert-iss", name: "정보보안기사", org: "한국인터넷진흥원(KISA)", description: "보안 실무 전문가 · 시스템·네트워크·관리 전반",
    subjects: [
      { name: "시스템 보안", items: [...r("os", 1, 2, 17, 25, 26, 27), ...range("sec", 32, 37), ...r("sec", 50, 51, 52, 53, 54)] },
      { name: "네트워크 보안", items: [...r("net", 1, 2, 3, 4, 11, 12, 21, 26), ...range("sec", 38, 47)] },
      { name: "애플리케이션 보안", items: [...range("sec", 2, 7), ...r("web", 1, 2, 6, 7, 20, 21, 22, 29), ...r("se", 31)] },
      { name: "정보보안 일반", items: [...r("sec", 1), ...range("sec", 8, 31)] },
      { name: "정보보안 관리 및 법규", items: [...range("sec", 55, 66)] },
    ],
  },
  {
    id: "cert-issi", name: "정보보안산업기사", org: "한국인터넷진흥원(KISA)", description: "정보보안기사보다 실무 기초 중심",
    subjects: [
      { name: "시스템 보안", items: [...r("os", 1, 2, 25, 26), ...r("sec", 32, 36, 50, 51, 52)] },
      { name: "네트워크 보안", items: [...r("net", 1, 3, 4, 11, 26), ...r("sec", 38, 39, 40, 42, 43, 44, 46, 47)] },
      { name: "애플리케이션 보안", items: [...r("sec", 2, 3, 4, 7), ...r("web", 1, 2, 6, 7)] },
      { name: "정보보안 일반", items: [...r("sec", 1, 8, 9, 10, 11, 16, 20, 21, 23, 26, 29)] },
      { name: "정보보안 관리 및 법규", items: [...r("sec", 61, 64, 65, 66)] },
    ],
  },
  {
    id: "cert-ecs", name: "전자계산기조직응용기사", org: "한국산업인력공단", description: "컴퓨터구조·운영체제 중심 하드웨어 계열",
    subjects: [
      { name: "전자계산기 프로그래밍", items: [...r("pl", 1, 2, 7, 8, 10), ...r("ds", 1, 2, 5, 10, 16), ...r("algo", 1, 6, 7, 11)] },
      { name: "자료구조 및 데이터 통신", items: [...r("ds", 9, 11, 19), ...r("net", 1, 2, 4, 22, 24, 25)] },
      { name: "전자계산기 구조", items: [...range("arch", 1, 26)] },
      { name: "운영체제", items: [...range("os", 1, 27)] },
      { name: "논리 회로", items: [...r("theory", 2, 3, 4)] },
    ],
  },
  {
    id: "cert-linux", name: "리눅스마스터 2급", org: "한국정보통신진흥협회(KAIT)", description: "리눅스 운영·관리 기초",
    subjects: [
      { name: "리눅스 운영 및 관리", items: [...r("os", 1, 2, 5, 16, 17, 24, 25, 26, 27), ...r("pl", 1, 2, 3)] },
      { name: "리눅스 활용", items: [...r("net", 1, 2, 5, 6, 9, 10, 26, 27), ...r("web", 23, 24), ...r("se", 24, 25)] },
      { name: "보안 기초", items: [...r("sec", 1, 24, 29, 38)] },
    ],
  },
  {
    id: "cert-netmgr", name: "네트워크관리사 2급", org: "한국정보통신자격협회(ICQA)", description: "네트워크 구축·운영 실무",
    subjects: [
      { name: "TCP/IP", items: [...range("net", 1, 13), ...r("net", 21, 26)] },
      { name: "네트워크 일반", items: [...range("net", 14, 20), ...range("net", 22, 25), ...r("net", 27)] },
      { name: "NOS (서버 운영)", items: [...r("os", 1, 26, 27), ...r("web", 23, 24, 25)] },
      { name: "네트워크 보안", items: [...r("sec", 38, 39, 40, 41, 42, 43, 44, 45)] },
    ],
  },
  {
    id: "cert-sqld", name: "SQLD", org: "한국데이터산업진흥원", description: "SQL 개발자 · 데이터 모델링과 SQL",
    subjects: [
      { name: "데이터 모델링의 이해", items: [...r("db", 1, 3, 4, 5, 6, 7, 8, 9, 10, 11)] },
      { name: "SQL 기본 및 활용", items: [...r("db", 2, 12, 13, 18, 19, 20, 21, 22, 23)] },
    ],
  },
  {
    id: "cert-bigdata", name: "빅데이터분석기사", org: "한국데이터산업진흥원", description: "데이터 분석 기획·탐색·모델링·해석",
    subjects: [
      { name: "빅데이터 분석 기획", items: [...r("ai", 27, 28), ...r("db", 24, 25, 26, 27), ...r("sec", 66)] },
      { name: "빅데이터 탐색", items: ["ma-prob", ...r("ai", 12, 26)] },
      { name: "빅데이터 모델링", items: [...range("ai", 1, 18), ...r("ai", 22, 23, 25)] },
      { name: "빅데이터 결과 해석", items: [...r("ai", 19, 20, 21)] },
    ],
  },
  {
    id: "cert-adsp", name: "데이터분석 준전문가 (ADsP)", org: "한국데이터산업진흥원", description: "데이터 이해 · 분석 기획 · 분석 기초",
    subjects: [
      { name: "데이터 이해", items: [...r("ai", 27, 28), ...r("db", 1, 24)] },
      { name: "데이터 분석 기획", items: [...r("ai", 1, 2, 3, 19, 20)] },
      { name: "데이터 분석", items: ["ma-prob", ...r("ai", 5, 6, 7, 8, 11, 12, 13, 21)] },
    ],
  },
  {
    id: "cert-cppg", name: "개인정보관리사 (CPPG)", org: "한국CPO포럼", description: "개인정보 보호 제도 · 관리 · 보호 조치",
    subjects: [
      { name: "개인정보보호의 이해", items: [...r("sec", 1, 29, 63, 64, 65, 66)] },
      { name: "개인정보 라이프사이클 관리", items: [...r("sec", 24, 26, 61, 66), ...r("db", 12, 20)] },
      { name: "개인정보의 보호조치", items: [...r("sec", 8, 9, 11, 16, 17, 21, 23, 38, 39, 40, 48, 49, 50)] },
    ],
  },
  {
    id: "cert-infocom", name: "정보통신기사", org: "한국방송통신전파진흥원", description: "통신 전송 · 네트워크 · 정보통신 설비",
    subjects: [
      { name: "정보전송일반", items: ["ee-comm", ...r("ee-signal", 1, 5, 7)] },
      { name: "정보통신기기", items: [...r("net", 14, 15, 16), ...r("arch", 20, 21)] },
      { name: "정보통신네트워크", items: [...range("net", 1, 25)] },
      { name: "컴퓨터일반", items: [...r("arch", 1, 2, 6, 13, 14), ...r("os", 1, 5, 17)] },
    ],
  },
  {
    id: "cert-elec", name: "전기기사", org: "한국산업인력공단", description: "전기자기학 · 전력 · 전기기기 · 회로 · 제어",
    subjects: [
      { name: "전기자기학", items: ["ph-em"] },
      { name: "전력공학", items: [...r("ee-power", 2, 3, 7, 9, 10)] },
      { name: "전기기기", items: [...r("ee-power", 1, 4, 5, 6, 8)] },
      { name: "회로이론 및 제어공학", items: ["ee-circuit", "ee-control"] },
    ],
  },
  {
    id: "cert-elec-i", name: "전기산업기사", org: "한국산업인력공단", description: "전기기사보다 범위가 좁은 실무 중심 시험",
    subjects: [
      { name: "전기자기학", items: [...r("ph-em", 1, 2, 3, 4, 5, 7, 8)] },
      { name: "전력공학", items: [...r("ee-power", 2, 3, 7)] },
      { name: "전기기기", items: [...r("ee-power", 1, 4, 5, 6)] },
      { name: "회로이론", items: [...r("ee-circuit", 1, 2, 3, 5, 6, 7, 8)] },
    ],
  },
  {
    id: "cert-electronics", name: "전자기사", org: "한국산업인력공단", description: "전자회로 · 디지털 · 전자기학 · 회로이론",
    subjects: [
      { name: "전자디지털회로", items: ["ee-electronics", ...r("ee-semi", 3, 5, 6, 7), ...r("theory", 2, 3, 4), ...r("arch", 4, 5)] },
      { name: "전자계산기일반", items: [...r("arch", 1, 2, 3, 6, 8, 9, 10, 11, 13, 14)] },
      { name: "전자기학", items: ["ph-em"] },
      { name: "회로이론", items: ["ee-circuit", ...r("ee-signal", 3, 4, 6)] },
    ],
  },
  {
    id: "cert-mech", name: "일반기계기사", org: "한국산업인력공단", description: "재료역학 · 열역학 · 유체역학 · 기계재료 · 기계제작",
    subjects: [
      { name: "재료역학", items: ["me-solid"] },
      { name: "기계열역학", items: ["me-thermo"] },
      { name: "기계유체역학", items: ["me-fluid"] },
      { name: "기계재료 및 유압기기", items: [...r("mt-mech", 1, 2, 3, 4, 7), ...r("mt-types", 1, 2, 3), ...r("mt-phase", 4, 6, 10)] },
      { name: "기계제작법 및 기계동력학", items: ["me-mfg", "me-dynamics", "me-design"] },
    ],
  },
  {
    id: "cert-chem", name: "화공기사", org: "한국산업인력공단", description: "공업합성 · 반응운전 · 단위공정 · 공정제어",
    subjects: [
      { name: "공업합성", items: [...r("ch-organic", 1, 2, 3, 8), ...r("che-reaction", 6)] },
      { name: "반응운전", items: ["che-reaction", "che-thermo"] },
      { name: "단위공정관리", items: ["che-unit", "che-transport"] },
      { name: "화공계측제어", items: ["che-process"] },
    ],
  },
  {
    id: "cert-civil", name: "토목기사", org: "한국산업인력공단", description: "응용역학 · 측량 · 수리 · 콘크리트 · 토질 · 상하수도",
    subjects: [
      { name: "응용역학", items: ["cv-struct"] },
      { name: "측량학", items: [...r("cv-transport", 1, 2, 3, 4, 5)] },
      { name: "수리학 및 수문학", items: ["cv-hydro"] },
      { name: "철근콘크리트 및 강구조", items: ["cv-concrete"] },
      { name: "토질 및 기초", items: ["cv-geo"] },
      { name: "상하수도공학", items: [...r("en-water", 1, 2, 4, 5, 8)] },
    ],
  },
  {
    id: "cert-arch", name: "건축기사", org: "한국산업인력공단", description: "건축계획 · 시공 · 구조 · 설비",
    subjects: [
      { name: "건축계획", items: ["ar-plan"] },
      { name: "건축시공", items: ["ar-const"] },
      { name: "건축구조", items: ["ar-struct"] },
      { name: "건축설비", items: ["ar-env"] },
    ],
  },
  {
    id: "cert-safety", name: "산업안전기사", org: "한국산업인력공단", description: "안전관리 · 인간공학 · 기계·전기·화학·건설 안전",
    subjects: [
      { name: "안전관리론", items: [...r("ie-human", 2, 7)] },
      { name: "인간공학 및 위험성 평가·관리", items: [...r("ie-human", 1, 3, 4, 5, 6, 8, 9, 10), ...r("ie-quality", 10)] },
      { name: "기계·기구 및 설비 안전", items: [...r("me-design", 1, 3, 4), ...r("me-mfg", 1, 2, 4)] },
      { name: "전기설비 안전", items: [...r("ee-power", 1, 2, 3)] },
      { name: "화학설비 안전", items: [...r("che-process", 1, 7)] },
      { name: "건설공사 안전", items: [...r("ar-const", 1, 5), ...r("cv-geo", 9, 10)] },
    ],
  },
  {
    id: "cert-quality", name: "품질경영기사", org: "한국산업인력공단", description: "실험계획 · 통계적 품질관리 · 생산 · 신뢰성",
    subjects: [
      { name: "실험계획법", items: [...r("ie-quality", 6, 7, 9)] },
      { name: "통계적 품질관리", items: [...r("ie-quality", 1, 4, 5, 8), ...r("ma-prob", 6, 7, 8, 9)] },
      { name: "생산시스템", items: ["ie-prod"] },
      { name: "신뢰성관리", items: [...r("ie-quality", 10), ...r("ie-human", 8)] },
      { name: "품질경영", items: [...r("ie-quality", 2, 3)] },
    ],
  },
  {
    id: "cert-air", name: "대기환경기사", org: "한국산업인력공단", description: "대기오염 개론 · 연소 · 방지 기술 · 측정",
    subjects: [
      { name: "대기오염 개론", items: [...r("en-air", 1, 2, 3, 4, 8, 10), ...r("ea-atmo", 1, 2, 10)] },
      { name: "연소공학", items: [...r("che-thermo", 1, 2), ...r("me-thermo", 1, 3)] },
      { name: "대기오염 방지기술", items: [...r("en-air", 5, 6, 7, 9)] },
      { name: "대기오염 공정시험기준", items: [...r("ch-analytic", 2, 3, 4)] },
    ],
  },
  {
    id: "cert-water", name: "수질환경기사", org: "한국산업인력공단", description: "수질오염 개론 · 상하수도 · 방지 기술 · 측정",
    subjects: [
      { name: "수질오염 개론", items: [...r("en-water", 1, 2, 3, 7), ...r("lf-eco", 2, 6, 10)] },
      { name: "상하수도 계획", items: [...r("cv-hydro", 2, 5, 6)] },
      { name: "수질오염 방지기술", items: [...r("en-water", 4, 5, 6, 8, 9, 10)] },
      { name: "수질오염 공정시험기준", items: [...r("ch-analytic", 1, 3, 5)] },
    ],
  },
  {
    id: "cert-solar", name: "신재생에너지발전설비기사 (태양광)", org: "한국산업인력공단", description: "태양광 발전 설비 설계 · 시공 · 운영",
    subjects: [
      { name: "태양광 발전 기획", items: [...r("en-energy", 1, 10), ...r("ee-semi", 1, 3, 4)] },
      { name: "태양광 발전 설계·시공", items: [...r("en-energy", 1, 5, 6, 8), ...r("ee-power", 3, 8)] },
      { name: "태양광 발전 운영", items: [...r("en-energy", 6, 8), ...r("ee-power", 2, 7)] },
    ],
  },
  {
    id: "cert-aero", name: "항공기사", org: "한국산업인력공단", description: "항공역학 · 항공기 구조 · 추진 · 비행",
    subjects: [
      { name: "항공역학", items: ["ae-aero"] },
      { name: "항공기 계통·비행", items: ["ae-flight"] },
      { name: "항공기 구조", items: [...r("ae-flight", 7, 8, 10), ...r("me-solid", 1, 3, 8, 9)] },
      { name: "항공기 추진", items: ["ae-prop"] },
    ],
  },
  {
    id: "cert-biomed", name: "의공기사", org: "한국산업인력공단", description: "의료기기 · 의용전자 · 생체 계측",
    subjects: [
      { name: "의공학 개론", items: [...r("lf-physio", 2, 4, 5), ...r("bm-biomed", 6, 10)] },
      { name: "의용전자", items: [...r("ee-electronics", 1, 4, 6), ...r("ee-circuit", 1, 2, 8)] },
      { name: "의료기기", items: ["bm-biomed"] },
    ],
  },
  {
    id: "cert-bio", name: "바이오화학제품제조기사", org: "한국산업인력공단", description: "생물공정 · 미생물 · 분석 · 품질",
    subjects: [
      { name: "생화학·미생물", items: ["bm-biotech", ...r("lf-cell", 1, 2, 9)] },
      { name: "생물공정", items: ["bm-process"] },
      { name: "유전공학", items: [...r("bm-genetic", 1, 2, 3, 5, 7)] },
      { name: "분석", items: [...r("ch-analytic", 2, 3, 4)] },
    ],
  },
  {
    id: "cert-metal", name: "금속재료기사", org: "한국산업인력공단", description: "금속 조직 · 재료 시험 · 열처리",
    subjects: [
      { name: "금속재료", items: ["mt-types", "mt-crystal"] },
      { name: "금속조직", items: ["mt-phase"] },
      { name: "재료시험", items: ["mt-mech", "mt-analysis"] },
      { name: "금속열처리·가공", items: [...r("me-mfg", 3, 4, 5, 8, 10)] },
    ],
  },
];

/** 자격증 고르기 화면에서 묶어 보여 줄 분야 (화면 전용, 서버 시드에는 넣지 않음). 여기 없는 자격증은 "기타"로 */
export const CERT_GROUPS: { name: string; ids: string[] }[] = [
  { name: "정보처리 · 소프트웨어", ids: ["cert-ipe", "cert-ipi", "cert-ipc", "cert-ecs", "cert-linux", "cert-netmgr"] },
  { name: "보안 · 개인정보", ids: ["cert-iss", "cert-issi", "cert-cppg"] },
  { name: "데이터", ids: ["cert-sqld", "cert-adsp", "cert-bigdata"] },
  { name: "전기 · 전자 · 통신", ids: ["cert-elec", "cert-elec-i", "cert-electronics", "cert-infocom"] },
  { name: "기계 · 재료 · 항공", ids: ["cert-mech", "cert-metal", "cert-aero"] },
  { name: "화공 · 바이오 · 의공", ids: ["cert-chem", "cert-bio", "cert-biomed"] },
  { name: "토목 · 건축", ids: ["cert-civil", "cert-arch"] },
  { name: "산업 · 안전 · 환경 · 에너지", ids: ["cert-safety", "cert-quality", "cert-air", "cert-water", "cert-solar"] },
];

export const CERT_PREFIX = "cert-";
export const isCertId = (id: string) => id.startsWith(CERT_PREFIX);
export const certById = (id: string) => CERTS.find((c) => c.id === id);
