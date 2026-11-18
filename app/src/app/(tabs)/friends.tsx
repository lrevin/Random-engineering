import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Share, TextInput, View } from "react-native";
import { askChallenge, confirmChallenge, pokeAndTell } from "@/components/challenge";
import { showDialog } from "@/components/Dialog";
import { FriendAvatar } from "@/components/FriendAvatar";
import { Icon } from "@/components/Icon";
import { LevelBadge } from "@/components/Rank";
import { SectionTitle } from "@/components/StatTile";
import { Btn, Card, FONT, Row, Screen, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { userLevel } from "@/lib/rank";
import {
  getFriends, getInbox, removeFriend, requestFriend, respondChallenge, respondFriend, socialEnabled, socialMessage,
  type Challenge, type FriendsState,
} from "@/lib/social";
import { inset, radius, raised, shadow, useColors } from "@/theme";

const EMPTY: FriendsState = { friends: [], incoming: [], outgoing: [] };
export default function Friends() {
  const { uid, prefs, xp } = useApp();
  const c = useColors();
  const [state, setState] = useState<FriendsState>(EMPTY);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  // 친구와 주고받은 1:1 배틀 신청 (대기 중인 것)
  const [challenges, setChallenges] = useState<{ incoming: Challenge[]; outgoing: Challenge[] }>({ incoming: [], outgoing: [] });
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    if (!socialEnabled) return;
    getFriends().then((s) => { setState(s); setOffline(false); }).catch(() => setOffline(true));
    getInbox().then((i) => setChallenges({ incoming: i.incoming ?? [], outgoing: i.outgoing ?? [] })).catch(() => {});
  }, []);

  // 이 탭을 보는 동안 5초마다 새로고침 (접속 중 표시 · 새 친구 신청)
  useFocusEffect(useCallback(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    // 배틀 신청 남은 시간 표시용 1초 갱신
    const s = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(s); };
  }, [refresh]));

  /** 친구를 누르면: 정보 보기 · 1:1 배틀 신청 */
  const openFriend = (f: { uid: string; nickname: string; level: number; online: boolean }) => {
    tap();
    showDialog({
      title: f.nickname,
      message: `${f.level}레벨 · ${f.online ? "접속 중" : "접속 안 함"}`,
      buttons: [
        { text: "정보 보기", onPress: () => router.push({ pathname: "/friend", params: { uid: f.uid } }) },
        { text: "1:1 배틀 신청", onPress: () => setTimeout(() => confirmChallenge(f, refresh), 250) },
        { text: "콕 찌르기", onPress: () => setTimeout(() => pokeAndTell(f), 250) },
        { text: "닫기", style: "cancel" },
      ],
    });
  };
  const left = (c: Challenge) => {
    const sec = Math.max(0, Math.round((Date.parse(c.expiresAt) - now) / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  };

  const run = async (fn: () => Promise<FriendsState>, ok: string) => {
    setBusy(true);
    setNotice(null);
    try {
      setState(await fn());
      setNotice({ text: ok, ok: true });
    } catch (e) {
      setNotice({ text: socialMessage(e), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const v = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(v)) return setNotice({ text: "UID는 영어 대문자와 숫자 8자리예요.", ok: false });
    run(() => requestFriend(v), "친구 신청을 보냈어요. 상대가 수락하면 친구가 돼요.").then(() => setCode(""));
  };

  const askRemove = (uidToRemove: string, nickname: string) =>
    showDialog({
      icon: "warning",
      title: `${nickname}님을 친구에서 뺄까요?`,
      message: "다시 친구가 되려면 UID로 새로 신청해야 해요.",
      buttons: [
        { text: "취소", style: "cancel" },
        { text: "친구 끊기", style: "destructive", onPress: () => run(() => removeFriend(uidToRemove), `${nickname}님을 친구에서 뺐어요.`) },
      ],
    });

  const shareUid = () => {
    tap();
    Share.share({ message: `뽑공에서 같이 공부해요! 제 UID는 ${uid} 예요.` }).catch(() => {});
  };

  // 친구 순위: 나 + 친구를 레벨 순으로
  const myName = prefs.nickname || "나";
  const ranking = [
    { uid, nickname: myName, level: userLevel(xp).level, online: true, me: true },
    ...state.friends.map((f) => ({ ...f, me: false })),
  ].sort((a, b) => b.level - a.level || Number(b.me) - Number(a.me));

  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">친구</T>

      {/* 내 UID 카드 */}
      <View style={{ borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#1d2742", ...shadow(c, 2) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 18 }}>
          <FriendAvatar name={myName} uid={uid} size={56} me />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={13} style={{ color: "#9aa3c0" }}>내 UID · 친구에게 알려 주세요</T>
            <T size={26} weight="bold" selectable style={{ color: "#fffaf0", letterSpacing: 3 }}>{uid}</T>
          </View>
          <Pressable onPress={shareUid} accessibilityRole="button" accessibilityLabel="내 UID 공유"
            style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 14, backgroundColor: "#f7b500", alignItems: "center", justifyContent: "center", ...raised("#c98f00", pressed) })}>
            <Icon name="share" size={24} color="#1d2742" />
          </Pressable>
        </View>
      </View>

      {!socialEnabled ? (
        <Card><T size={15} color="ink2">친구 서버가 아직 연결되지 않았어요. (개발용: app/.env.local 에 EXPO_PUBLIC_SOCIAL_URL)</T></Card>
      ) : (
        <>
          {offline && <T size={13} color="accent">서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.</T>}

          {/* 친구 추가 */}
          <Card style={{ gap: 10 }}>
            <Row gap={8}><Icon name="user-plus" size={22} color={c.ink} /><T size={16} weight="bold">UID로 친구 추가</T></Row>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="예: K7Q3MZP2"
                placeholderTextColor={c.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                onSubmitEditing={add}
                returnKeyType="send"
                accessibilityLabel="친구 UID"
                style={{
                  flex: 1, borderWidth: 1.5, borderColor: c.line2, backgroundColor: c.paper, borderRadius: radius.md, ...inset(c),
                  paddingHorizontal: 14, fontSize: 18, letterSpacing: 2, color: c.ink, fontFamily: FONT.semibold,
                }}
              />
              <Btn title="신청" variant="primary" onPress={add} loading={busy} disabled={!code.trim()} />
            </View>
            {notice && <T size={13} color={notice.ok ? "success" : "accent"}>{notice.text}</T>}
            {state.outgoing.length > 0 && (
              <T size={12} color="muted">수락을 기다리는 신청: {state.outgoing.map((f) => f.nickname).join(", ")}</T>
            )}
          </Card>

          {/* 1:1 배틀 신청 (받은 것 · 보낸 것) */}
          {challenges.incoming.map((ch) => (
            <Card key={ch.id} accent style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Icon name="swords" size={30} color={c.accent} />
              <View style={{ flex: 1 }}>
                <T size={15} weight="bold" numberOfLines={2}>{ch.friend.nickname}님이 1:1 배틀을 신청했어요</T>
                <T size={12} color="muted">{left(ch)} 안에 수락하면 바로 시작</T>
              </View>
              <Btn title="보기" size="sm" variant="accent" onPress={() => askChallenge(ch, refresh)} />
            </Card>
          ))}
          {challenges.outgoing.map((ch) => (
            <Card key={ch.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Icon name="clock" size={28} color={c.ink2} />
              <View style={{ flex: 1 }}>
                <T size={15} weight="bold" numberOfLines={2}>{ch.friend.nickname}님에게 배틀 신청 중</T>
                <T size={12} color="muted">수락을 기다려요 · {left(ch)} 남음</T>
              </View>
              <Btn title="취소" size="sm" variant="ghost" onPress={() => respondChallenge(ch.id, "cancel").then(refresh).catch((e) => setNotice({ text: socialMessage(e), ok: false }))} />
            </Card>
          ))}

          {/* 받은 친구 신청 */}
          {state.incoming.length > 0 && (
            <>
              <SectionTitle title={`받은 친구 신청 ${state.incoming.length}`} />
              {state.incoming.map((f) => (
                <Card key={f.uid} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <FriendAvatar name={f.nickname} uid={f.uid} />
                  <View style={{ flex: 1 }}>
                    <T size={16} weight="bold" numberOfLines={1}>{f.nickname}</T>
                    <T size={12} color="muted">{f.level}레벨 · {f.uid}</T>
                  </View>
                  <Btn title="거절" size="sm" variant="ghost" onPress={() => run(() => respondFriend(f.uid, false), "신청을 거절했어요.")} />
                  <Btn title="수락" size="sm" variant="accent" onPress={() => run(() => respondFriend(f.uid, true), `${f.nickname}님과 친구가 됐어요!`)} />
                </Card>
              ))}
            </>
          )}

          {/* 친구 순위 (레벨 순) */}
          <SectionTitle title="친구 순위" right={<T size={13} color="muted">친구 {state.friends.length}명</T>} />
          {!state.friends.length ? (
            <Card style={{ alignItems: "center", gap: 10, paddingVertical: 26 }}>
              <Icon name="user-plus" size={54} color={c.line2} />
              <T size={16} weight="bold" center>아직 친구가 없어요</T>
              <T size={13} color="muted" center>내 UID를 공유하거나 친구의 UID를 받아{"\n"}함께 레벨을 겨뤄 보세요.</T>
              <Btn title="내 UID 공유하기" icon={<Icon name="share" size={20} color={c.ink} />} onPress={shareUid} />
            </Card>
          ) : (
            <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper, overflow: "hidden" }}>
              {ranking.map((f, i) => (
                <Pressable
                  key={f.uid}
                  disabled={f.me}
                  onPress={() => openFriend(f)}
                  onLongPress={() => askRemove(f.uid, f.nickname)}
                  accessibilityHint={f.me ? undefined : "누르면 정보 보기 · 1:1 배틀 신청 · 콕 찌르기, 길게 누르면 친구에서 뺄 수 있어요"}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14,
                    backgroundColor: f.me ? c.successSoft : pressed ? c.chip : c.paper, borderTopWidth: i ? 1 : 0, borderTopColor: c.line,
                  })}
                >
                  <T size={17} weight="bold" color={f.me ? "success" : i < 3 ? "accent" : "ink2"} style={{ width: 22, textAlign: "center" }}>{i + 1}</T>
                  <FriendAvatar name={f.nickname} uid={f.uid} online={f.me ? undefined : f.online} me={f.me} />
                  <View style={{ flex: 1 }}>
                    <T size={16} weight="bold" color={f.me ? "success" : "ink"} numberOfLines={1}>{f.nickname}{f.me ? " (나)" : ""}</T>
                    <T size={12} color="muted">{f.me ? "나" : f.online ? "접속 중" : "접속 안 함"}</T>
                  </View>
                  {i === 0 && <Icon name="crown" size={24} />}
                  <LevelBadge level={f.level} size="sm" />
                </Pressable>
              ))}
            </View>
          )}
          {state.friends.length > 0 && <T size={12} color="muted" center>친구를 누르면 정보 보기 · 배틀 신청 · 콕 찌르기, 길게 누르면 친구에서 뺄 수 있어요.</T>}
        </>
      )}
    </Screen>
  );
}
