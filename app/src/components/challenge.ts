import { router } from "expo-router";
import { showDialog } from "./Dialog";
import { challengeFriend, pokeFriend, respondChallenge, socialMessage, type Challenge } from "@/lib/social";

/** 친구에게 1:1 배틀 신청 (확인 창 → 신청). 접속 안 한 친구는 서버가 휴대폰 알림을 보냄 */
export function confirmChallenge(f: { uid: string; nickname: string; online?: boolean }, onSent?: () => void) {
  showDialog({
    icon: "swords",
    title: `${f.nickname}님에게 1:1 배틀을 신청할까요?`,
    message: `배틀권 1장을 써요. 10분 안에 수락하지 않으면 돌려받아요.${f.online ? "" : "\n접속 중이 아니라서 휴대폰 알림으로 알려 줄게요."}`,
    buttons: [
      { text: "취소", style: "cancel" },
      {
        text: "신청하기",
        onPress: () => {
          challengeFriend(f.uid)
            .then((r) => {
              onSent?.();
              showDialog({
                icon: "check",
                title: "배틀을 신청했어요",
                message: r.notified ? `${f.nickname}님의 휴대폰으로 알림을 보냈어요. 수락하면 바로 배틀이 시작돼요.` : `${f.nickname}님이 수락하면 바로 배틀이 시작돼요.`,
              });
            })
            .catch((e) => showDialog({ icon: "warning", title: "배틀을 신청하지 못했어요", message: socialMessage(e) }));
        },
      },
    ],
  });
}

/** 받은 배틀 신청 수락 · 거절 창 */
export function askChallenge(c: Challenge, onDone?: () => void) {
  showDialog({
    icon: "swords",
    title: `${c.friend.nickname}님이 1:1 배틀을 신청했어요`,
    message: "수락하면 바로 배틀이 시작돼요. 배틀권 1장을 써요.",
    buttons: [
      { text: "거절", style: "cancel", onPress: () => { respondChallenge(c.id, "decline").catch(() => {}).finally(() => onDone?.()); } },
      {
        text: "수락하기",
        onPress: () => {
          respondChallenge(c.id, "accept")
            .then((r) => { onDone?.(); if (r.battle) router.push({ pathname: "/battle", params: { id: r.battle.id } }); })
            .catch((e) => showDialog({ icon: "warning", title: "배틀을 시작하지 못했어요", message: socialMessage(e) }));
        },
      },
    ],
  });
}

/** 콕 찌르기 (결과를 창으로 알려 줌) */
export function pokeAndTell(f: { uid: string; nickname: string }, onDone?: () => void) {
  pokeFriend(f.uid)
    .then((r) => { onDone?.(); showDialog({ icon: "bell", title: `${f.nickname}님을 콕 찔렀어요`, message: r.notified ? "오늘 공부하러 오라고 휴대폰 알림을 보냈어요." : "친구의 휴대폰 알림이 꺼져 있어서 바로 전하지 못했어요. 오늘은 다시 찌를 수 없어요." }); })
    .catch((e) => showDialog({ icon: "warning", title: "콕 찌르지 못했어요", message: socialMessage(e) }));
}
