import { API_URL } from "./api";
import { createAuthClient, AuthApiError } from "./auth-client";
import { authStorage } from "./auth-storage";
// Authentication always uses the MySQL-backed API.
if (!API_URL) throw new Error('MySQL API URL is required');
export const mysqlAuth = createAuthClient(API_URL, authStorage);
export function authErrorMessage(error: unknown) {
  if (!(error instanceof AuthApiError)) {
    const message = error instanceof Error ? error.message : String(error);
    if (/network|fetch/i.test(message)) return "인터넷 연결을 확인해 주세요.";
    return "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
  }
  const messages: Record<string, string> = {
    invalid_answers:"문제의 보기와 제출 답안이 맞지 않아요. 답안은 유지되니 다시 확인해 주세요.",
    answer_conflict:"이미 저장된 답안과 달라요. 기존 풀이를 다시 불러와 주세요.",
    record_conflict:"서버에 저장된 풀이와 내용이 달라요. 기존 기록을 확인해 주세요.",
    verification_required:"서버에서 문제 원본을 확인하지 못했어요. 답안은 기기에 유지돼요.",
    activity_closed:"이미 종료한 풀이예요. 진행 상태를 다시 확인해 주세요.",
    recall_not_due:"아직 복습할 주제가 없어요.",
    review_not_due:"서버에서 확인된 미해결 오답이 없어요.",
    premium_required:"프리미엄 회원 전용 기능이에요.",
    exam_ticket_required:"무료 횟수를 사용했어요. 모의고사권이 필요해요.",
    insufficient_balance:"톱니바퀴가 부족해요.",
    study_limit:"학습 시간을 더 추가할 수 없어요.",
    invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
    invalid_email: "이메일 형식을 확인해 주세요.",
    email_taken: "이미 가입된 이메일이에요. 로그인해 주세요.",
    weak_password: "비밀번호는 8자 이상으로 정해 주세요.",
    unauthorized: "로그인이 만료됐어요. 다시 로그인해 주세요.",
    rate_limited: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    too_many_attempts: "비밀번호를 여러 번 틀렸어요. 15분 뒤에 다시 시도해 주세요.",
    network_error: "서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.",
    database_unavailable: "서버에 잠시 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
    invalid_profile: "프로필 입력값을 확인해 주세요.",
    nickname_not_allowed: "사용할 수 없는 단어가 들어 있는 닉네임이에요. 다른 닉네임을 정해 주세요.",
    nickname_length: "닉네임은 2~5자로 정해 주세요.",
    invalid_interests: "존재하는 관심 분야를 선택해 주세요.",
    account_deleting: "탈퇴 신청 중인 계정이에요. 7일 이내에는 아래에서 취소할 수 있어요.",
    deletion_period_expired: "탈퇴 신청 후 7일이 지나 취소할 수 없어요.",
    kakao_failed: "카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.",
    kakao_unavailable: "카카오 로그인이 아직 준비되지 않았어요.",
    expired: "로그인 시간이 지났어요. 다시 시도해 주세요.",
    feature_not_migrated: "이 계정의 회원 탈퇴 기능은 아직 연결되지 않았어요.",
  };
  return messages[error.code] ?? "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
