// 바이오·의공학 주제 데이터
// 형식: [한국어 이름, 영어 위키피디아 문서 이름, 난이도(1=기초 2=중급 3=심화), 한 줄 힌트]

import type { CategoryDef, RawTopic } from "./types";

export const BIO_CATEGORIES: CategoryDef[] = [
  { id: "bm-biotech", name: "생명공학 기초", emoji: "🔬" },
  { id: "bm-genetic", name: "유전공학·분자생물", emoji: "🧬" },
  { id: "bm-biomed", name: "의공학·의료기기", emoji: "🩺" },
  { id: "bm-process", name: "생물공정", emoji: "🧫" },
];

export const BIO_RAW: Record<string, RawTopic[]> = {
  "bm-biotech": [
    ["세포", "Cell (biology)", 1, "모든 생명체를 이루는 기본 단위"],
    ["DNA 복제", "DNA replication", 1, "세포 분열 전 유전 정보를 복사하는 과정"],
    ["센트럴 도그마", "Central dogma of molecular biology", 1, "유전 정보가 흐르는 방향에 관한 원리"],
    ["효소", "Enzyme", 1, "생체 내 화학 반응을 빠르게 하는 단백질"],
    ["미카엘리스-멘텐 반응속도론", "Michaelis–Menten kinetics", 2, "기질 농도와 효소 반응 속도의 관계"],
    ["단백질 구조", "Protein structure", 2, "1차부터 4차까지 단백질이 접히는 방식"],
    ["세포 호흡", "Cellular respiration", 2, "영양분에서 ATP를 만들어 내는 과정"],
    ["막 수송", "Membrane transport", 2, "물질이 세포막을 드나드는 방법"],
    ["세포 신호 전달", "Cell signaling", 3, "세포가 외부 신호를 받아 반응하는 경로"],
    ["세포자멸사 (아포토시스)", "Apoptosis", 3, "세포가 스스로 질서 있게 죽는 과정"],
  ],
  "bm-genetic": [
    ["중합효소 연쇄 반응 (PCR)", "Polymerase chain reaction", 1, "특정 DNA 조각을 대량으로 증폭하는 기술"],
    ["제한 효소", "Restriction enzyme", 1, "특정 염기서열에서 DNA를 자르는 효소"],
    ["플라스미드", "Plasmid", 1, "세균 속 작은 고리 모양의 DNA"],
    ["겔 전기영동", "Gel electrophoresis", 1, "DNA·단백질을 크기별로 분리하는 방법"],
    ["분자 클로닝", "Molecular cloning", 2, "원하는 유전자를 벡터에 넣어 복제하는 과정"],
    ["DNA 염기서열 분석", "DNA sequencing", 2, "DNA의 염기 순서를 읽어 내는 기술"],
    ["CRISPR 유전자 편집", "CRISPR gene editing", 2, "가이드 RNA로 원하는 위치를 자르는 기술"],
    ["웨스턴 블롯", "Western blot", 2, "특정 단백질을 항체로 검출하는 방법"],
    ["RNA 간섭 (RNAi)", "RNA interference", 3, "작은 RNA로 유전자 발현을 억제하는 현상"],
    ["실시간 PCR (qPCR)", "Real-time polymerase chain reaction", 3, "증폭 과정을 형광으로 정량하는 기술"],
  ],
  "bm-biomed": [
    ["심전도 (ECG)", "Electrocardiography", 1, "심장의 전기 활동을 기록하는 검사"],
    ["컴퓨터 단층촬영 (CT)", "CT scan", 1, "X선으로 몸의 단면 영상을 얻는 장비"],
    ["초음파 영상", "Medical ultrasound", 1, "음파의 반사로 몸속을 보는 영상 기법"],
    ["인공심박동기", "Artificial cardiac pacemaker", 1, "심장 박동을 전기 자극으로 조절하는 기기"],
    ["자기공명영상 (MRI)", "Magnetic resonance imaging", 2, "강한 자기장과 전파로 만드는 영상"],
    ["생체적합성", "Biocompatibility", 2, "재료가 몸 안에서 해를 주지 않는 성질"],
    ["뇌파 (EEG)", "Electroencephalography", 2, "두피에서 뇌의 전기 활동을 측정하는 검사"],
    ["제세동", "Defibrillation", 2, "전기 충격으로 심장 리듬을 되돌리는 처치"],
    ["양전자 방출 단층촬영 (PET)", "Positron emission tomography", 3, "방사성 추적자로 대사 활동을 보는 영상"],
    ["조직공학", "Tissue engineering", 3, "세포와 지지체로 조직을 재생하는 분야"],
  ],
  "bm-process": [
    ["발효", "Fermentation", 1, "미생물이 유기물을 분해해 산물을 만드는 과정"],
    ["생물반응기", "Bioreactor", 1, "세포·미생물을 키우는 제어된 용기"],
    ["멸균", "Sterilization (microbiology)", 1, "모든 미생물을 제거하는 공정"],
    ["미생물 생장 곡선", "Bacterial growth", 1, "유도기·대수기·정지기·사멸기의 변화"],
    ["모노드 식", "Monod equation", 2, "기질 농도와 미생물 비성장속도의 관계"],
    ["유가식 배양", "Fed-batch culture", 2, "배양 중 기질을 조금씩 공급하는 방식"],
    ["크로마토그래피", "Chromatography", 2, "이동상과 고정상으로 물질을 분리하는 방법"],
    ["단백질 정제", "Protein purification", 2, "혼합물에서 목표 단백질만 분리하는 과정"],
    ["케모스탯 (연속 배양)", "Chemostat", 3, "유입과 유출을 같게 유지하는 배양 장치"],
    ["다운스트림 공정", "Downstream processing", 3, "배양 후 산물을 회수·정제하는 단계"],
  ],
};
