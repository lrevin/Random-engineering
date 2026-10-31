import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Btn, Screen, T } from "@/components/ui";
import { APP_NAME, SUPPORT_EMAIL } from "@/config";

// ⚠️ 초안입니다. 출시 전에 실제 운영 방식에 맞게 고치고, 가능하면 전문가 검토를 받으세요.
const PRIVACY: [string, string][] = [
  ["1. 수집하는 개인정보", "회원가입 시: 이메일 주소, 비밀번호(암호화 저장), 닉네임\n서비스 이용 시: 관심 분야, 난이도 설정, 공부 기록(주제, 메모, 퀴즈 점수, 틀린 문제, 경험치, 공부 시간), 알림 설정"],
  ["2. 이용 목적", "회원 식별 및 로그인, 공부 기록 저장·동기화, 연속 학습 일수 등 통계 제공, 공부 알림 제공"],
  ["3. 보관 기간", "회원 탈퇴 시 즉시 삭제합니다. 단, 관계 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다."],
  ["4. 처리 위탁", "데이터 저장 및 인증: Supabase Inc. (클라우드 데이터베이스)"],
  ["5. 이용자의 권리", "앱의 설정 화면에서 언제든 정보를 수정하거나 회원 탈퇴(전체 삭제)를 할 수 있습니다."],
  ["6. AI 퀴즈", "퀴즈 문제는 주제 이름과 분야 정보만으로 서버에서 AI(Anthropic Claude)가 만듭니다. 회원의 개인정보나 공부 기록은 AI에 전달되지 않습니다."],
  ["7. 둘러보기 모드", "로그인 없이 이용하면 모든 정보가 이 휴대폰에만 저장되며 서버로 전송되지 않습니다."],
  ["8. 문의", `개인정보 관련 문의: ${SUPPORT_EMAIL}`],
];

const TERMS: [string, string][] = [
  ["제1조 (목적)", `이 약관은 ${APP_NAME}(이하 "서비스")의 이용 조건과 절차를 정합니다.`],
  ["제2조 (서비스 내용)", "서비스는 학습 주제를 무작위로 제시하고, 공부 타이머·AI 퀴즈·레벨·랭크·학습 기록 기능을 제공합니다. AI가 만든 퀴즈에는 오류가 있을 수 있습니다. 외부 사이트(위키백과, 나무위키 등)의 내용은 각 사이트의 책임입니다."],
  ["제3조 (회원의 의무)", "회원은 타인의 정보를 도용하거나 서비스 운영을 방해해서는 안 됩니다."],
  ["제4조 (서비스 변경·중단)", "운영상 필요한 경우 서비스 내용을 변경하거나 중단할 수 있으며, 중요한 변경은 앱 안에서 미리 알립니다."],
  ["제5조 (탈퇴)", "회원은 언제든 설정 화면에서 탈퇴할 수 있으며, 탈퇴 시 모든 기록이 삭제됩니다."],
  ["제6조 (문의)", SUPPORT_EMAIL],
];

export default function Privacy() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const terms = doc === "terms";
  const items = terms ? TERMS : PRIVACY;
  return (
    <Screen scroll>
      <T size={24} weight="bold">{terms ? "이용약관" : "개인정보처리방침"}</T>
      {items.map(([h, b]) => (
        <View key={h} style={{ gap: 4 }}>
          <T weight="semibold">{h}</T>
          <T size={15} color="ink2">{b}</T>
        </View>
      ))}
      <Btn title="닫기" variant="primary" onPress={() => router.back()} />
    </Screen>
  );
}
