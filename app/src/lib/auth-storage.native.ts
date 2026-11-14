import * as SecureStore from "expo-secure-store";
import type { SessionStorage } from "./auth-client";
const KEY = "pg.mysql.auth.v1";
export const authStorage: SessionStorage = {
  read: () => SecureStore.getItemAsync(KEY),
  write: value => SecureStore.setItemAsync(KEY, value),
  remove: () => SecureStore.deleteItemAsync(KEY),
};
