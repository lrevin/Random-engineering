import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { confirmChallenge } from "@/components/challenge";
import { FriendAvatar } from "@/components/FriendAvatar";
import { Icon } from "@/components/Icon";
import { LevelBadge } from "@/components/Rank";
import { StatTile } from "@/components/StatTile";
import { TitleBadge } from "@/components/TitleBadge";
import { Btn, Card, Row, Screen, T } from "@/components/ui";
import { titleById } from "@/lib/skins";
import { getFriendInfo, socialMessage, type FriendInfo } from "@/lib/social";
import { useColors } from "@/theme";

/** 마지막 접속을 "방금 · n분 전 · n시간 전 · n일 전"으로 */
function seenText(info: FriendInfo) {
  if (info.online) return "접속 중";
  if (!info.lastSeenAt) return "접속 기록 없음";
  const min = Math.floor((Date.now() - Date.parse(info.lastSeenAt)) / 60000);
  if (min < 1) return "방금 전 접속";
  if (min < 60) return `${min}분 전 접속`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전 접속`;
  return `${Math.floor(min / 1440)}일 전 접속`;
}

/** 친구 정보 보기 (친구 탭에서 친구를 누르면) */
export default function FriendScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const c = useColors();
  const [info, setInfo] = useState<FriendInfo | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!uid) return;
    getFriendInfo(uid).then(setInfo).catch((e) => setErr(socialMessage(e)));
  }, [uid]);

  const title = titleById(info?.title);
  const games = info ? info.versus.wins + info.versus.losses + info.versus.draws : 0;

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between" }}>
        <T size={24} weight="bold">친구 정보</T>
        <Btn title="닫기" variant="ghost" size="sm" onPress={() => router.back()} />
      </Row>
      {err ? <T color="accent">{err}</T> : null}
      {info && (
        <>
          <Card style={{ alignItems: "center", gap: 8, paddingVertical: 22 }}>
            <FriendAvatar name={info.nickname} uid={info.uid} size={76} online={info.online} />
            <T size={22} weight="bold">{info.nickname}</T>
            {title && <TitleBadge t={title} />}
            <Row gap={8} style={{ justifyContent: "center" }}>
              <LevelBadge level={info.level} size="sm" />
              <T size={13} color={info.online ? "success" : "muted"}>{seenText(info)}</T>
            </Row>
            <T size={13} color="muted" selectable>UID {info.uid}</T>
          </Card>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatTile icon={<Icon name="star" size={22} />} value={info.xp.toLocaleString()} label="누적 XP" />
            <StatTile icon={<Icon name="bolt" size={22} />} value={info.weekXp.toLocaleString()} label="이번 주 XP" />
          </View>

          <Card style={{ gap: 10 }}>
            <Row gap={8}><Icon name="swords" size={22} color={c.ink} /><T size={16} weight="bold">나와의 1:1 배틀</T></Row>
            {games ? (
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                {([["내가 이김", info.versus.wins, "success"], ["비김", info.versus.draws, "ink2"], ["내가 짐", info.versus.losses, "accent"]] as const).map(([label, n, color]) => (
                  <View key={label} style={{ alignItems: "center", gap: 2 }}>
                    <T size={24} weight="bold" color={color}>{n}</T>
                    <T size={12} color="muted">{label}</T>
                  </View>
                ))}
              </View>
            ) : (
              <T size={13} color="muted">아직 둘이 겨룬 배틀이 없어요.</T>
            )}
          </Card>

          <Btn title="1:1 배틀 신청" variant="primary" size="lg" icon={<Icon name="swords" size={22} color="#ffffff" />}
            onPress={() => confirmChallenge(info)} />
        </>
      )}
    </Screen>
  );
}
