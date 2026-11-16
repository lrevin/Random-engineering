/** 앱 화면 오류를 서버 로그로 보냄 (POST /client-errors). 개인정보는 보내지 않고, 같은 오류는 한 번만 보냄 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import { API_URL } from "./api";

const sent = new Set<string>();

export function reportClientError(error: unknown, where: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  const id = `${where}:${e.message}`;
  if (!API_URL || sent.has(id) || sent.size > 20) return;
  sent.add(id);
  fetch(`${API_URL}/client-errors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      where,
      message: e.message.slice(0, 300),
      stack: (e.stack ?? "").split("\n").slice(0, 6).join(" ").slice(0, 600),
      version: Constants.expoConfig?.version ?? "",
      platform: Platform.OS,
    }),
  }).catch(() => {});
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike { getGlobalHandler(): GlobalHandler; setGlobalHandler(h: GlobalHandler): void }

/** 화면 밖에서 난 오류(타이머 · 이벤트 등)도 보고하고, 원래 처리기는 그대로 부름 */
export function installGlobalErrorReporter() {
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((error, isFatal) => {
    reportClientError(error, isFatal ? "fatal" : "global");
    prev(error, isFatal);
  });
}
