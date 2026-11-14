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
];

export const CERT_PREFIX = "cert-";
export const isCertId = (id: string) => id.startsWith(CERT_PREFIX);
export const certById = (id: string) => CERTS.find((c) => c.id === id);
