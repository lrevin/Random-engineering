import nodemailer from 'nodemailer';

/**
 * 메일 보내기 (비밀번호 찾기 확인 코드).
 * 서버 환경변수: SMTP_HOST · SMTP_PORT(기본 587) · SMTP_USER · SMTP_PASS · MAIL_FROM (예: "뽑공 <no-reply@...>")
 *  - 구글 계정이면 SMTP_HOST=smtp.gmail.com, SMTP_PASS 는 '앱 비밀번호' (계정 비밀번호 아님)
 * 설정이 없으면 null → 비밀번호 찾기가 꺼짐. 개발 중에만 MAIL_DEV_LOG=1 이면 메일 대신 서버 로그에 남김.
 */
export function createMailer({ env = process.env, log = console.log } = {}) {
  if (env.SMTP_HOST && env.MAIL_FROM) {
    const port = Number(env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      disableFileAccess: true, disableUrlAccess: true,
    });
    return { send: ({ to, subject, text }) => transport.sendMail({ from: env.MAIL_FROM, to, subject, text }) };
  }
  if (env.MAIL_DEV_LOG === '1') return { send: async ({ to, subject, text }) => { log(`[mail:dev] to=${to} | ${subject} | ${text.replace(/\s+/g, ' ')}`); } };
  return null;
}
