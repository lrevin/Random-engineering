import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { askChallenge } from "@/components/challenge";
import { useApp } from "@/lib/app-state";
import { getPushToken, notifyNow, onNotificationTap } from "@/lib/notify";
import { userLevel } from "@/lib/rank";
import { getInbox, registerPush, setMe, socialEnabled } from "@/lib/social";

const POLL_MS = 5000;

/**
 * 앱 어디에 있든 배틀 시작을 챙기는 부분 (화면에 그리는 것은 없음).
 * 5초마다 서버에 물어서 랜덤 매칭이 잡히면 배틀 화면으로 데려가고, 앱이 뒤에 있으면 알림을 띄웁니다.
 * 친구가 보낸 1:1 배틀 신청은 수락 · 거절 창을 띄우고, 앱이 꺼져 있을 때는 서버가 휴대폰 푸시 알림을 보냅니다.
 */
export function BattleWatcher() {
  const { uid, prefs, xp } = useApp();
  const path = usePathname();
  const pathRef = useRef(path);
  const notified = useRef(new Set<string>());
  // 받은 배틀 신청: 창을 띄운 것 · 알림을 띄운 것
  const asked = useRef(new Set<string>());
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  // 서버에 보낼 내 정보
  useEffect(() => {
    setMe({ uid, nickname: prefs.nickname, level: userLevel(xp).level, xp });
  }, [uid, prefs.nickname, xp]);

  // 이 기기의 푸시 토큰을 서버에 등록 (접속 안 했을 때 배틀 신청 알림을 받으려고) · 알림을 누르면 친구 탭으로
  useEffect(() => {
    if (!socialEnabled || !uid) return;
    getPushToken().then((t) => (t ? registerPush(t, Platform.OS) : undefined)).catch(() => {});
    return onNotificationTap((data) => {
      if (data.type === "battle_challenge") router.push("/(tabs)/friends");
    });
  }, [uid]);

  useEffect(() => {
    if (!socialEnabled || !uid) return;
    const tick = async () => {
      try {
        const { current, incoming } = await getInbox();
        // 친구가 보낸 1:1 배틀 신청
        for (const c of incoming ?? []) {
          if (AppState.currentState === "active") {
            if (!asked.current.has(c.id) && !pathRef.current.startsWith("/battle")) { asked.current.add(c.id); askChallenge(c); }
          } else if (!notified.current.has(c.id)) {
            notified.current.add(c.id);
            notifyNow("1:1 배틀 신청", `${c.friend.nickname}님에게 1:1 배틀 신청이 왔어요.`, { type: "battle_challenge", challengeId: c.id }).catch(() => {});
          }
        }
        if (current?.status !== "accepted") return;
        if (AppState.currentState !== "active" && !notified.current.has(current.id)) {
          notified.current.add(current.id);
          const opp = current.from.uid === uid ? current.to : current.from;
          notifyNow("배틀 상대를 찾았어요", `${opp.nickname}님과 배틀이 곧 시작돼요.`).catch(() => {});
        }
        if (!pathRef.current.startsWith("/battle") && pathRef.current !== "/match") router.push({ pathname: "/battle", params: { id: current.id } });
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
