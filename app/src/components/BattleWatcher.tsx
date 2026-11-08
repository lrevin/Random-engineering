import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useApp } from "@/lib/app-state";
import { notifyNow } from "@/lib/notify";
import { userLevel } from "@/lib/rank";
import { getInbox, setMe, socialEnabled } from "@/lib/social";

const POLL_MS = 5000;

/**
 * 앱 어디에 있든 배틀 시작을 챙기는 부분 (화면에 그리는 것은 없음).
 * 5초마다 서버에 물어서 랜덤 매칭이 잡히면 배틀 화면으로 데려가고, 앱이 뒤에 있으면 알림을 띄웁니다.
 */
export function BattleWatcher() {
  const { uid, prefs, xp } = useApp();
  const path = usePathname();
  const pathRef = useRef(path);
  const notified = useRef(new Set<string>());
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  // 서버에 보낼 내 정보
  useEffect(() => {
    setMe({ uid, nickname: prefs.nickname, level: userLevel(xp).level, xp });
  }, [uid, prefs.nickname, xp]);

  useEffect(() => {
    if (!socialEnabled || !uid) return;
    const tick = async () => {
      try {
        const { current } = await getInbox();
        if (current?.status !== "accepted") return;
        if (AppState.currentState !== "active" && !notified.current.has(current.id)) {
          notified.current.add(current.id);
          const opp = current.from.uid === uid ? current.to : current.from;
          notifyNow("⚔️ 배틀 상대를 찾았어요", `${opp.nickname}님과 배틀이 곧 시작돼요.`).catch(() => {});
        }
        if (!pathRef.current.startsWith("/battle") && pathRef.current !== "/arena") router.push({ pathname: "/battle", params: { id: current.id } });
      } catch {
        // 서버에 못 닿으면 다음에 다시
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [uid]);

  return null;
}
