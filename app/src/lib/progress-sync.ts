/**
 * 기기에만 있던 학습 진행(모의고사 결과 · 오답 해결 · 복습 시각 · 자격증 시험일)을 계정에 보관 (GET/PUT /me/progress).
 * 재화가 아닌 학습 기록이라 단순하게 맞춤:
 *  - 이 기기에서 이 계정으로 처음 맞추거나, 기기에 값이 없으면 → 서버 값을 받음
 *  - 기기 값이 지난번 맞춘 뒤 바뀌었으면 → 서버에 올림 (두 기기에서 동시에 바꿨으면 나중에 올린 쪽이 이김)
 *  - 기기 값은 그대로인데 서버가 바뀌었으면 → 서버 값을 받음
 * 목록은 서버 api/mysql/progress-service.mjs의 PROGRESS_NAMES와 같아야 함.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mysqlAuth } from "./auth";
import { LOCAL_KEYS } from "./local-data";

const NAMES = {
  exam: LOCAL_KEYS.exam.key,
  reviewDone: LOCAL_KEYS.reviewDone.key,
  recall: LOCAL_KEYS.recall.key,
  certDates: LOCAL_KEYS.certDates.key,
} as const;
type Name = keyof typeof NAMES;
type Meta = Partial<Record<Name, { raw: string; at: string }>>;
type Remote = Partial<Record<string, { value: unknown; updatedAt: string }>>;

const metaKey = (userId: string) => `pg.mysql.progress-sync.${userId}`;
let queue: Promise<void> = Promise.resolve();

/** 계정 학습 진행 맞추기. 여러 번 불러도 한 번에 하나씩 차례로 실행 */
export function syncProgress(userId: string, isCurrent: () => boolean): Promise<void> {
  queue = queue.catch(() => {}).then(() => (isCurrent() ? run(userId, isCurrent) : undefined));
  return queue;
}

async function run(userId: string, isCurrent: () => boolean) {
  const { items } = (await mysqlAuth.apiRequest("/me/progress", undefined, "GET")) as { items?: Remote };
  if (!isCurrent()) return;
  let meta: Meta = {};
  try { meta = JSON.parse((await AsyncStorage.getItem(metaKey(userId))) ?? "{}") ?? {}; } catch { meta = {}; }

  for (const name of Object.keys(NAMES) as Name[]) {
    const key = NAMES[name];
    const local = await AsyncStorage.getItem(key);
    const m = meta[name];
    const s = items?.[name];
    const localChanged = local != null && local !== m?.raw;

    if (s && (!m || local == null || (!localChanged && s.updatedAt !== m.at))) {
      const raw = JSON.stringify(s.value);
      if (!isCurrent()) return;
      await AsyncStorage.setItem(key, raw);
      meta[name] = { raw, at: s.updatedAt };
    } else if (local != null && (localChanged || !s)) {
      let value: unknown;
      try { value = JSON.parse(local); } catch { continue; }
      if (!value || typeof value !== "object") continue;
      const { updatedAt } = (await mysqlAuth.apiRequest(`/me/progress/${name}`, { value }, "PUT")) as { updatedAt: string };
      if (!isCurrent()) return;
      meta[name] = { raw: local, at: updatedAt };
    }
  }
  await AsyncStorage.setItem(metaKey(userId), JSON.stringify(meta));
}
