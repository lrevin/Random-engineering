import type { StudyRecord } from "./types";
export interface AuthSession {
  accessToken: string; refreshToken: string; expiresAt: number;
  user: { id: string; email: string | null };
}
export interface AccountProfile {
  nickname: string; interests: string[]; level: 0 | 1 | 2 | 3;
  studyMinutes: number; reminderEnabled: boolean; reminderTime: string;
}
export interface SessionStorage {
  read(): Promise<string | null>; write(value: string): Promise<void>; remove(): Promise<void>;
}
export class AuthApiError extends Error {
  constructor(public code: string, public status = 0, public details: {record?: StudyRecord} = {}) { super(code); }
}
/** Pure client; platform token storage is injected. */
export function createAuthClient(url: string, storage: SessionStorage, fetcher: typeof fetch = fetch) {
  let session: AuthSession | null = null, epoch = 0;
  let refreshTask: Promise<AuthSession> | null = null;
  let writes = Promise.resolve();
  const listeners = new Set<(value: AuthSession | null) => void>();
  async function commit(value: AuthSession | null, expected = epoch) {
    if (expected !== epoch) throw new AuthApiError("session_changed");
    session = value;
    const write = writes.catch(() => {}).then(() => value ? storage.write(JSON.stringify(value)) : storage.remove());
    writes = write;
    await write;
    if (expected === epoch) for (const listener of listeners) listener(value);
  }
  async function request(path: string, body?: unknown, token?: string, method?: "GET" | "POST" | "PUT" | "DELETE") {
    const ctrl = new AbortController(), timeout = setTimeout(() => ctrl.abort(), 10000);
    try {
      const response = await fetcher(`${url}${path}`, {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal,
      });
      if (response.status === 204) return null;
      const data = await response.json();
      if (!response.ok) throw new AuthApiError(typeof data?.error === "string" ? data.error : "server_error", response.status, data);
      return data;
    } catch (error) {
      if (error instanceof AuthApiError) throw error;
      throw new AuthApiError("network_error");
    } finally { clearTimeout(timeout); }
  }
  function parse(data: { accessToken?: unknown; refreshToken?: unknown; expiresIn?: unknown; user?: AuthSession["user"] }): AuthSession {
    if (typeof data?.accessToken !== "string" || typeof data.refreshToken !== "string" || typeof data.expiresIn !== "number" ||
      data.expiresIn <= 0 || typeof data.user?.id !== "string") throw new AuthApiError("invalid_response");
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: Date.now() + data.expiresIn * 1000, user: data.user };
  }
  async function refresh() {
    if (refreshTask) return refreshTask;
    const current = session, version = epoch;
    if (!current) throw new AuthApiError("unauthorized", 401);
    refreshTask = (async () => {
      try {
        const next = parse(await request("/auth/refresh", { refreshToken: current.refreshToken }));
        await commit(next, version); return next;
      } catch (error) {
        if (version === epoch && error instanceof AuthApiError && error.status === 401) await commit(null, version);
        throw error;
      }
    })();
    try { return await refreshTask; } finally { refreshTask = null; }
  }
  async function ensure(): Promise<AuthSession> {
    if (!session) throw new AuthApiError("unauthorized", 401);
    if (session.expiresAt <= Date.now() + 30000) return refresh();
    const current = session, version = epoch;
    try {
      await request("/auth/me", undefined, current.accessToken);
      if (version !== epoch) throw new AuthApiError("session_changed");
      return current;
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        if (version !== epoch) throw new AuthApiError("session_changed");
        return refresh();
      }
      throw error;
    }
  }
  async function authorized(path: string, body?: unknown, method?: "GET" | "PUT" | "DELETE") {
    const version = epoch;
    const current = await ensure();
    try { const result = await request(path, body, current.accessToken, method); if (version !== epoch) throw new AuthApiError("session_changed"); return result; }
    catch (error) {
      if (!(error instanceof AuthApiError) || error.status !== 401 || version !== epoch) throw error;
      const next = await refresh();
      const result = await request(path, body, next.accessToken, method); if (version !== epoch) throw new AuthApiError("session_changed"); return result;
    }
  }
  return {
    async uploadRecords(records: StudyRecord[]): Promise<{results: {id: string; ok: boolean; record?: StudyRecord; error?: string}[]}> {
      return authorized("/me/records", {records}, "PUT");
    },
    async recordSnapshot(): Promise<{records: StudyRecord[]; cursor: string}> {return authorized("/me/records/snapshot");},
    async saveRecordMemo(id: string, memo: string, baseChangeSeq: string): Promise<{record: StudyRecord}> {
      return authorized("/me/records/" + id + "/memo", {memo, baseChangeSeq}, "PUT");
    },
    async deleteRecord(id: string) {await authorized("/me/records/" + id, undefined, "DELETE");},
    async getProfile(): Promise<AccountProfile | null> {
      try { return (await authorized("/me/profile")).profile; }
      catch (error) { if (error instanceof AuthApiError && error.status === 404) return null; throw error; }
    },
    async saveProfile(value: AccountProfile): Promise<AccountProfile> {
      return (await authorized("/me/profile", value, "PUT")).profile;
    },
    async deleteAccount() {
      const result = await authorized("/me", undefined, "DELETE");
      ++epoch; await commit(null); return result;
    },
    async cancelDeletion(email: string, password: string): Promise<AuthSession> {
      await request("/auth/cancel-deletion", { email, password });
      const version = ++epoch, next = parse(await request("/auth/login", { email, password }));
      await commit(next, version); return next;
    },
    subscribe(listener: (value: AuthSession | null) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async signIn(email: string, password: string) {
      const version = ++epoch, next = parse(await request("/auth/login", { email, password }));
      await commit(next, version); return next;
    },
    async signUp(email: string, password: string) {
      const version = ++epoch, next = parse(await request("/auth/signup", { email, password }));
      await commit(next, version); return next;
    },
    async restore() {
      const version = epoch, raw = await storage.read();
      if (!raw || version !== epoch) return session;
      try {
        const saved = JSON.parse(raw) as AuthSession;
        if (typeof saved.accessToken !== "string" || typeof saved.refreshToken !== "string" ||
          typeof saved.expiresAt !== "number" || typeof saved.user?.id !== "string") throw new Error("bad session");
        session = saved;
      } catch { await commit(null, version); return null; }
      try { return await ensure(); }
      catch (error) {
        if (error instanceof AuthApiError && error.status === 401) return null;
        if (error instanceof AuthApiError && error.code === "network_error") return session;
        throw error;
      }
    },
    ensure, refresh,
    async signOut() {
      const current = session; ++epoch;
      try { if (current) await request("/auth/logout", { refreshToken: current.refreshToken }); }
      finally { await commit(null); }
    },
  };
}
