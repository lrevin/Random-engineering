// 생명과학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const LIFE_CATEGORIES: CategoryDef[] = [
  { id: "lf-cell", name: "세포생물학", emoji: "🦠" },
  { id: "lf-genetics", name: "유전학", emoji: "🧬" },
  { id: "lf-physio", name: "생리학", emoji: "🫀" },
  { id: "lf-eco", name: "생태·진화", emoji: "🌿" },
];

export const LIFE_RAW: Record<string, RawTopic[]> = {
  "lf-cell": [
    ["세포막", "Cell membrane", 1, "세포를 둘러싸고 물질 출입을 조절하는 막"],
    ["미토콘드리아", "Mitochondria", 1, "세포 호흡으로 에너지(ATP)를 만드는 소기관"],
    ["엽록체", "Chloroplast", 1, "광합성이 일어나는 식물 세포의 소기관"],
    ["원핵생물", "Prokaryote", 1, "핵막이 없는 세포로 이루어진 생물"],
    ["세포 주기", "Cell cycle", 2, "세포가 자라고 나뉘기까지 거치는 단계"],
    ["체세포 분열", "Mitosis", 2, "같은 유전 정보를 가진 두 세포로 나뉘는 분열"],
    ["감수 분열", "Meiosis", 2, "염색체 수가 절반인 생식세포를 만드는 분열"],
    ["광합성", "Photosynthesis", 2, "빛 에너지로 이산화탄소와 물에서 포도당을 만듦"],
    ["아데노신 삼인산", "Adenosine triphosphate", 2, "세포가 쓰는 에너지 화폐 ATP"],
    ["세포골격", "Cytoskeleton", 3, "세포 모양을 유지하고 이동을 돕는 단백질 섬유망"],
  ],
  "lf-genetics": [
    ["유전자", "Gene", 1, "특정 형질을 정하는 DNA의 단위"],
    ["멘델 유전", "Mendelian inheritance", 1, "우열·분리·독립의 법칙으로 설명하는 유전"],
    ["염색체", "Chromosome", 1, "DNA와 단백질이 뭉쳐 있는 구조"],
    ["돌연변이", "Mutation", 1, "DNA 염기서열이 바뀌는 일"],
    ["전사 (생물학)", "Transcription (biology)", 2, "DNA 정보를 RNA로 옮겨 적는 과정"],
    ["번역 (생물학)", "Translation (biology)", 2, "mRNA 정보로 단백질을 만드는 과정"],
    ["유전 암호", "Genetic code", 2, "코돈과 아미노산의 대응 규칙"],
    ["후성유전학", "Epigenetics", 3, "염기서열 변화 없이 유전자 발현이 바뀌는 현상"],
    ["유전자 발현 조절", "Regulation of gene expression", 3, "언제 어떤 유전자를 켤지 정하는 조절 장치"],
    ["하디-바인베르크 법칙", "Hardy–Weinberg principle", 3, "조건이 맞으면 집단의 대립유전자 빈도가 유지된다"],
  ],
  "lf-physio": [
    ["항상성", "Homeostasis", 1, "몸 안의 상태를 일정하게 유지하는 성질"],
    ["뉴런", "Neuron", 1, "신호를 전달하는 신경 세포"],
    ["호르몬", "Hormone", 1, "혈액을 타고 다른 기관에 신호를 보내는 물질"],
    ["순환계", "Circulatory system", 1, "심장과 혈관으로 혈액을 온몸에 보내는 체계"],
    ["활동 전위", "Action potential", 2, "뉴런 막 전위가 순간적으로 뒤집히는 신호"],
    ["시냅스", "Synapse", 2, "뉴런과 뉴런이 신호를 주고받는 연결 부위"],
    ["면역계", "Immune system", 2, "병원체로부터 몸을 지키는 방어 체계"],
    ["항체", "Antibody", 2, "특정 항원에 결합하는 면역 단백질"],
    ["음성 되먹임", "Negative feedback", 3, "결과가 원인을 억제해 균형을 맞추는 조절"],
    ["네프론", "Nephron", 3, "혈액을 걸러 오줌을 만드는 콩팥의 기본 단위"],
  ],
  "lf-eco": [
    ["자연 선택", "Natural selection", 1, "환경에 잘 맞는 형질이 살아남아 퍼지는 과정"],
    ["생태계", "Ecosystem", 1, "생물과 환경이 상호작용하는 하나의 체계"],
    ["먹이 사슬", "Food chain", 1, "먹고 먹히는 관계로 이어진 생물의 연결"],
    ["종 (생물학)", "Species", 1, "서로 교배해 생식 가능한 자손을 낳는 집단"],
    ["종 분화", "Speciation", 2, "한 종에서 새로운 종이 갈라져 나오는 과정"],
    ["탄소 순환", "Carbon cycle", 2, "탄소가 대기·생물·바다·땅을 오가는 순환"],
    ["생물 다양성", "Biodiversity", 2, "생물 종·유전자·생태계의 다양함"],
    ["유전적 부동", "Genetic drift", 3, "우연에 의해 대립유전자 빈도가 바뀌는 현상"],
    ["계통수", "Phylogenetic tree", 3, "생물이 갈라져 나온 관계를 나무 모양으로 나타냄"],
    ["질소 순환", "Nitrogen cycle", 2, "질소가 대기와 생물 사이를 오가는 순환"],
  ],
};
