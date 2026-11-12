import type { SessionStorage } from "./auth-client";
const KEY = "pg.mysql.auth.v1";
/** Web preview: tab-scoped storage. Native builds use auth-storage.native.ts. */
export const authStorage: SessionStorage = {
  async read() { return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(KEY); },
  async write(value) { sessionStorage.setItem(KEY, value); },
  async remove() { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(KEY); },
};
