import { createHash, randomUUID } from 'node:crypto';
import { connect, safeError, transaction } from '../server/db.mjs';
import { walletState } from './wallet-state.mjs';

/**
 * 운영자용: 친구 UID(8자리)로 회원을 찾아 톱니바퀴를 채우고 프리미엄을 켭니다. (시험·시연 계정용)
 * EC2에서 api/server 폴더 기준으로 실행합니다. 앱이나 API 주소로는 열려 있지 않습니다.
 *
 *   npm run admin:grant -- JRY9FFXG --gears 999999 --premium
 *   npm run admin:grant -- JRY9FFXG --premium off        # 프리미엄 끄기
 *
 * - 톱니바퀴는 "잔액을 이 값으로 맞춤"이고, 차이를 wallet_transactions(reason='admin_grant')에 남깁니다.
 * - 프리미엄은 지갑 상태(wallet_operations 마지막 결과의 state.premium)로 저장합니다.
 * - 스킨·칭호는 아직 서버에 없고 기기에만 저장돼서 여기서 줄 수 없습니다. (앱 개발 빌드: 설정 > 개발용 > 모든 스킨·칭호 열기)
 */
const MAX_GEARS = 999999;

function parse(argv) {
  const [code, ...rest] = argv;
  if (!/^[A-Z2-9]{8}$/.test(String(code ?? '').toUpperCase())) throw new Error('친구 UID 8자리를 첫 번째로 적어 주세요. 예: JRY9FFXG');
  const out = { code: code.toUpperCase(), gears: null, premium: null };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--gears') {
      const n = Number(rest[++i]);
      if (!Number.isInteger(n) || n < 0 || n > MAX_GEARS) throw new Error(`--gears 는 0~${MAX_GEARS} 정수`);
      out.gears = n;
    } else if (rest[i] === '--premium') {
      const v = rest[i + 1];
      if (v === 'off' || v === 'on') { out.premium = v === 'on'; i++; } else out.premium = true;
    } else throw new Error('알 수 없는 옵션: ' + rest[i]);
  }
  if (out.gears === null && out.premium === null) throw new Error('--gears 또는 --premium 중 하나는 있어야 해요.');
  return out;
}

export async function adminGrant({ code, gears, premium }, { connectionFactory = connect, now = new Date() } = {}) {
  const db = await connectionFactory();
  try {
    return await transaction(db, async () => {
      const [[m]] = await db.execute("SELECT m.user_id FROM social_members m JOIN users u ON u.id=m.user_id AND u.status='active' WHERE m.friend_code=?", [code]);
      if (!m) throw new Error('그 UID의 회원을 찾지 못했어요: ' + code);
      const id = m.user_id;
      const value = await walletState(db, id, now); // 지갑 행 잠금 (없으면 만듦)
      const requestId = 'admin:' + randomUUID();
      if (gears !== null && gears !== value.balance) {
        await db.execute('UPDATE wallets SET balance=? WHERE user_id=?', [gears, id]);
        await db.execute("INSERT INTO wallet_transactions(user_id,amount,reason,request_id) VALUES (?,?,'admin_grant',?)", [id, gears - value.balance, requestId]);
        value.balance = gears;
      }
      const state = { ...value.state, ...(premium === null ? {} : { premium }) };
      const payload = { gears, premium };
      await db.execute('INSERT INTO wallet_operations(user_id,request_id,request_hash,action,payload,result_json) VALUES (?,?,?,?,?,?)',
        [id, requestId, createHash('sha256').update(JSON.stringify(payload)).digest(), 'admin_grant', JSON.stringify(payload), JSON.stringify({ balance: value.balance, state })]);
      return { userId: id, balance: value.balance, premium: state.premium };
    });
  } finally { await db.end(); }
}

// 직접 실행했을 때만 (시험에서 import 할 때는 실행 안 함)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/admin-grant.mjs')) {
  try { console.log(JSON.stringify(await adminGrant(parse(process.argv.slice(2))))); }
  catch (error) { console.error('admin-grant 실패: ' + (error instanceof Error && !error.code ? error.message : safeError(error))); process.exitCode = 1; }
}
export { parse as parseAdminArgs };
