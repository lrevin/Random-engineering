import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Modal, View } from "react-native";
import { domainById } from "@/data";
import { useApp } from "@/lib/app-state";
import { notifyNow } from "@/lib/notify";
import { fmtStudyTime } from "@/lib/stats";
import { userLevel } from "@/lib/rank";
import { acceptBattle, declineBattle, getInbox, setMe, socialEnabled, socialMessage, type Battle } from "@/lib/social";
import { radius, shadow, useColors } from "@/theme";
import { Btn, T } from "./ui";

const POLL_MS = 5000;

/**
 * 앱 어디에 있든 배틀 신청을 받는 부분.
 * 5초마다 서버에 물어서 신청이 오면 창을 띄우고(앱이 뒤에 있으면 알림), 배틀이 시작되면 배틀 화면으로 데려갑니다.
 */
export function BattleWatcher() {
  const { uid, prefs, xp } = useApp();
  const c = useColors();
  const path = usePathname();
  const [invite, setInvite] = useState<Battle | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const seen = useRef(new Set<string>());
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  // 서버에 보낼 내 정보
  useEffect(() => {
    setMe({ uid, nickname: prefs.nickname, level: userLevel(xp).level, xp });
  }, [uid, prefs.nickname, xp]);

  useEffect(() => {
    if (!socialEnabled || !uid) return;
    let alive = true;
    const tick = async () => {
      try {
        const { incoming, current } = await getInbox();
        if (!alive) return;
        const fresh = incoming.find((b) => !seen.current.has(b.id));
        if (fresh) {
          seen.current.add(fresh.id);
          setErr("");
          setInvite(fresh);
          if (AppState.currentState !== "active") {
            notifyNow("⚔️ 배틀 신청이 왔어요", `${fresh.from.nickname}님이 ${domainById(fresh.domain)?.name ?? ""} 배틀을 신청했어요.`).catch(() => {});
          }
        }
        // 신청이 취소·만료되면 창 닫기
        setInvite((cur) => (cur && !incoming.some((b) => b.id === cur.id) ? null : cur));
        // 배틀이 시작됐는데 배틀 화면이 아니면 데려감
        if (current?.status === "accepted" && !pathRef.current.startsWith("/battle")) {
          router.push({ pathname: "/battle", params: { id: current.id } });
        }
      } catch {
        // 서버에 못 닿으면 다음에 다시
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [uid]);

  if (!invite) return null;
  const d = domainById(invite.domain);

  const answer = async (accept: boolean) => {
    setBusy(true);
    setErr("");
    try {
      const b = await (accept ? acceptBattle(invite.id) : declineBattle(invite.id));
      setInvite(null);
      if (accept) router.push({ pathname: "/battle", params: { id: b.id } });
    } catch (e) {
      setErr(socialMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setInvite(null)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.55)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: c.paper, borderRadius: radius.lg, padding: 22, gap: 12, maxWidth: 420, width: "100%", alignSelf: "center", borderTopWidth: 5, borderTopColor: c.accent, ...shadow(c, 3) }}>
          <T size={40} center>⚔️</T>
          <T size={21} weight="bold" center>{invite.from.nickname}님이 배틀을 신청했어요</T>
          <T size={15} color="ink2" center>
            {d ? `${d.emoji} ${d.name}` : "분야"} · 공부 {fmtStudyTime(invite.studySec)} + 퀴즈 7문제{"\n"}
            수락하면 곧바로 같은 주제가 뽑혀요. 지면 내 경험치의 5%(최대 100 XP)를 잃어요.
          </T>
          {err ? <T size={14} color="accent" center>{err}</T> : null}
          <Btn title="수락하고 시작" variant="accent" size="lg" loading={busy} onPress={() => answer(true)} />
          <Btn title="거절" size="lg" disabled={busy} onPress={() => answer(false)} />
        </View>
      </View>
    </Modal>
  );
}
