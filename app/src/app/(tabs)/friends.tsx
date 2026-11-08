import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { LevelBadge } from "@/components/Rank";
import { Btn, Card, Field, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import {
  getFriends, removeFriend, requestFriend, respondFriend, socialEnabled, socialMessage,
  type FriendsState,
} from "@/lib/social";
import { useColors } from "@/theme";

const EMPTY: FriendsState = { friends: [], incoming: [], outgoing: [] };

export default function Friends() {
  const { uid } = useApp();
  const c = useColors();
  const [state, setState] = useState<FriendsState>(EMPTY);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(() => {
    if (!socialEnabled) return;
    getFriends().then((s) => { setState(s); setOffline(false); }).catch(() => setOffline(true));
  }, []);

  // 이 탭을 보는 동안 5초마다 새로고침 (접속 중 표시 · 새 친구 신청)
  useFocusEffect(useCallback(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]));

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

  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">친구</T>

      {/* 내 UID */}
      <Card style={{ gap: 10 }}>
        <T size={14} color="muted">내 UID (친구에게 알려 주세요)</T>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <T size={28} weight="bold" selectable style={{ letterSpacing: 3 }}>{uid}</T>
          <Btn title="공유" size="sm" onPress={() => Share.share({ message: `뽑공에서 같이 공부해요! 제 UID는 ${uid} 예요.` }).catch(() => {})} />
        </Row>
      </Card>

      {!socialEnabled ? (
        <Card><T size={15} color="ink2">친구 서버가 아직 연결되지 않았어요. (개발용: app/.env.local 에 EXPO_PUBLIC_SOCIAL_URL)</T></Card>
      ) : (
        <>
          {offline && <T size={13} color="accent">서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.</T>}

          {/* 친구 추가 */}
          <Card style={{ gap: 10 }}>
            <Field label="UID로 친구 추가" value={code} onChangeText={setCode} placeholder="예: K7Q3MZP2" autoCapitalize="characters" autoCorrect={false} maxLength={12} />
            <Btn title="친구 신청" variant="primary" onPress={add} loading={busy} />
            {notice && <T size={13} color={notice.ok ? "success" : "accent"}>{notice.text}</T>}
          </Card>

          {state.incoming.length > 0 && (
            <Card style={{ gap: 10 }}>
              <T size={16} weight="bold">받은 친구 신청</T>
              {state.incoming.map((f) => (
                <Row key={f.uid} style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <View style={{ flex: 1 }}>
                    <T size={15} weight="semibold">{f.nickname}</T>
                    <T size={12} color="muted">{f.uid}</T>
                  </View>
                  <Btn title="거절" size="sm" variant="ghost" onPress={() => run(() => respondFriend(f.uid, false), "신청을 거절했어요.")} />
                  <Btn title="수락" size="sm" variant="accent" onPress={() => run(() => respondFriend(f.uid, true), `${f.nickname}님과 친구가 됐어요!`)} />
                </Row>
              ))}
            </Card>
          )}

          <Card style={{ gap: 12 }}>
            <T size={16} weight="bold">친구 {state.friends.length}명</T>
            {!state.friends.length && <T size={14} color="muted">아직 친구가 없어요. 친구의 UID를 받아 추가해 보세요.</T>}
            {state.friends.map((f) => (
              <Row key={f.uid} gap={10} style={{ flexWrap: "nowrap" }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f.online ? c.success : c.line2 }} />
                <Pressable style={{ flex: 1 }} onLongPress={() => run(() => removeFriend(f.uid), `${f.nickname}님을 친구에서 뺐어요.`)}>
                  <T size={15} weight="semibold" numberOfLines={1}>{f.nickname}</T>
                  <T size={12} color="muted">{f.online ? "접속 중" : "접속 안 함"} · {f.uid}</T>
                </Pressable>
                <LevelBadge level={f.level} size="sm" />
              </Row>
            ))}
            {state.friends.length > 0 && (
              <>
                <T size={12} color="muted">친구를 길게 누르면 친구에서 뺄 수 있어요.</T>
                <Btn title="⚔️ 친구와 배틀하기" size="sm" variant="accent" onPress={() => router.push("/arena")} />
              </>
            )}
          </Card>

          {state.outgoing.length > 0 && (
            <T size={13} color="muted">수락을 기다리는 신청: {state.outgoing.map((f) => f.nickname).join(", ")}</T>
          )}
        </>
      )}

    </Screen>
  );
}
