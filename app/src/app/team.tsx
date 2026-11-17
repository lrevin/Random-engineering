import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Chip, Row, Screen, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { weekXp } from "@/lib/report";
import { getFriends, socialEnabled, type Friend } from "@/lib/social";
import {
  TEAM_GOAL_PER_MEMBER, TEAM_MAX, TEAM_MIN, TEAM_REWARD, claimTeamReward, createTeam, getTeam, inviteFriends, leaveTeam, previewTeam, respondInvite,
  teamMessage, type TeamMode, type TeamState,
} from "@/lib/team";
import { inset, radius, useColors } from "@/theme";

const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** 스터디 팀: 2~4명 (주제 상관없음). 친구를 먼저 모으고 빈자리는 랜덤으로 채우거나, 친구끼리만. 주간 목표를 채우면 보상 */
export default function Team() {
  const { mode, prefs, records } = useApp();
  const c = useColors();
  const member = mode === "user";
  const [state, setState] = useState<TeamState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState<TeamMode | null>(null);
  const myWeekXp = useMemo(() => weekXp(records), [records]);

  const load = useCallback(async () => {
    if (!member) return;
    try { setState(await getTeam()); setNotice(""); } catch (e) { setNotice(teamMessage(e)); }
    if (socialEnabled) getFriends().then((s) => setFriends(s.friends)).catch(() => {});
  }, [member]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const s = member ? state : previewTeam(prefs.nickname, myWeekXp, previewMode);

  const act = async (fn: () => Promise<TeamState>, done?: string) => {
    tap(); setBusy(true);
    try { setState(await fn()); setNotice(done ?? ""); setPicked([]); } catch (e) { setNotice(teamMessage(e)); } finally { setBusy(false); }
  };
  /** 둘러보기에서는 예시 팀으로 */
  const start = (m: TeamMode) => {
    if (!member) { tap(); setPreviewMode(m); return; }
    void act(() => createTeam(m), m === "friends" ? "친구끼리 팀을 꾸렸어요." : "팀에 들어갔어요. 빈자리는 다른 사람이 들어오면 채워져요.");
  };

  const header = (
    <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
      <T size={26} weight="bold">스터디 팀</T>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
        <Icon name="close" size={24} color={c.muted} />
      </Pressable>
    </Row>
  );

  if (!s) {
    return (
      <Screen scroll>
        {header}
        {notice ? <T color="accent">{notice}</T> : <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />}
        {notice ? <Btn title="다시 시도" onPress={() => void load()} /> : null}
      </Screen>
    );
  }

  const team = s.team;
  const outgoing = s.invites.outgoing;
  const accepted = outgoing.filter((i) => i.status === "accepted").length;
  const open = outgoing.filter((i) => i.status !== "declined").length;
  const waitingLeader = s.invites.incoming.find((i) => i.status === "accepted");
  const room = team ? TEAM_MAX - team.members.length : TEAM_MAX - 1;
  const canInvite = room - open;

  /** 친구 고르기 + 초대 (팀 꾸리기 전 · 팀에 빈자리가 있을 때) */
  const invitePanel = s.preview ? (
    <T size={13} color="muted">로그인하면 친구 UID로 최대 {TEAM_MAX - 1}명까지 초대할 수 있어요.</T>
  ) : (
    <View style={{ gap: 10 }}>
      {outgoing.map((inv) => (
        <Row key={inv.id} gap={8} style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <T size={15} style={{ flex: 1 }}>{inv.nickname}</T>
          <Badge label={{ pending: "응답 기다리는 중", accepted: "같이 해요", declined: "거절했어요" }[inv.status]} tone={inv.status === "accepted" ? "accent" : "outline"} />
          {inv.status !== "declined" && <Pressable onPress={() => act(() => respondInvite(inv.id, "cancel"))} hitSlop={8}><T size={13} color="muted">취소</T></Pressable>}
        </Row>
      ))}
      {canInvite > 0 ? (
        friends.length ? (
          <>
            <Row gap={8}>
              {friends.filter((f) => !outgoing.some((o) => o.uid === f.uid && o.status !== "declined")).map((f) => (
                <Chip key={f.uid} label={f.nickname} selected={picked.includes(f.uid)}
                  disabled={!picked.includes(f.uid) && picked.length >= canInvite}
                  onPress={() => setPicked((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))} />
              ))}
            </Row>
            <Btn title={picked.length ? `${picked.length}명에게 초대 보내기` : `초대할 친구를 골라 주세요 (최대 ${canInvite}명)`} size="sm" variant="primary" disabled={!picked.length || busy}
              icon={<Icon name="mail" size={18} />} onPress={() => act(() => inviteFriends(picked), "초대를 보냈어요.")} />
          </>
        ) : (
          <Btn title="친구 추가하러 가기" size="sm" icon={<Icon name="handshake" size={18} />} onPress={() => router.push("/friends")} />
        )
      ) : null}
    </View>
  );

  return (
    <Screen scroll>
      {header}
      <T size={14} color="ink2">{TEAM_MIN}~{TEAM_MAX}명이 한 팀이 돼요. 공부 주제는 서로 달라도 괜찮아요. 이번 주 팀원 XP를 모아 주간 목표를 채우면 다 같이 보상을 받아요.</T>
      {s.preview ? (
        <Card style={{ gap: 4, borderColor: c.gold, backgroundColor: c.goldSoft }}>
          <T size={14} weight="bold">미리 보기</T>
          <T size={13} color="ink2">둘러보기에서는 예시 팀원으로 화면만 볼 수 있어요. 로그인하면 친구 · 다른 사람과 진짜 팀을 꾸리고 보상도 받아요.</T>
        </Card>
      ) : null}
      {notice ? <T color="accent" weight="semibold">{notice}</T> : null}

      {!team ? (
        <>
          {waitingLeader ? (
            <Card style={{ gap: 6 }}>
              <T size={15} weight="bold">{waitingLeader.nickname}님 팀에 같이 가기로 했어요</T>
              <T size={13} color="ink2">{waitingLeader.nickname}님이 팀을 시작하면 같은 팀으로 들어가요.</T>
              <Btn title="같이 가기 취소" size="sm" onPress={() => act(() => respondInvite(waitingLeader.id, "decline"))} />
            </Card>
          ) : null}

          {s.invites.incoming.filter((i) => i.status === "pending").map((inv) => (
            <Card key={inv.id} style={{ gap: 8 }}>
              <T size={15} weight="bold">{inv.nickname}님이 스터디 팀에 초대했어요</T>
              <Row gap={8} style={{ flexWrap: "nowrap" }}>
                <Btn title="거절" size="sm" onPress={() => act(() => respondInvite(inv.id, "decline"))} style={{ flex: 1 }} />
                <Btn title="같이 하기" size="sm" variant="accent" onPress={() => act(() => respondInvite(inv.id, "accept"), "수락했어요.")} style={{ flex: 1 }} />
              </Row>
            </Card>
          ))}

          {!waitingLeader ? (
            <>
              <SectionTitle title="1. 같이 할 친구 모으기 (선택)" />
              <Card style={{ gap: 10 }}>
                <T size={13} color="ink2">먼저 함께하고 싶은 친구를 초대하세요. 수락한 친구와 같은 팀이 돼요.</T>
                {invitePanel}
              </Card>

              <SectionTitle title="2. 팀 시작하기" />
              <Pressable onPress={() => start("open")} disabled={busy} accessibilityRole="button" accessibilityLabel="빈자리는 랜덤으로 채우기"
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Card style={{ gap: 6 }}>
                  <Row gap={10} style={{ flexWrap: "nowrap" }}>
                    <Icon name="dice" size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T size={17} weight="bold">빈자리는 랜덤으로 채우기</T>
                      <T size={13} color="ink2">{accepted ? `나 + 친구 ${accepted}명이 같이 들어가고, ` : ""}남은 자리는 다른 사람이 들어와요. 혼자 시작해도 돼요.</T>
                    </View>
                  </Row>
                </Card>
              </Pressable>
              <Pressable onPress={() => start("friends")} disabled={busy || (member && accepted < 1)} accessibilityRole="button" accessibilityLabel="친구끼리만 팀 꾸리기"
                style={({ pressed }) => ({ opacity: member && accepted < 1 ? 0.5 : pressed ? 0.85 : 1 })}>
                <Card style={{ gap: 6 }}>
                  <Row gap={10} style={{ flexWrap: "nowrap" }}>
                    <Icon name="handshake" size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T size={17} weight="bold">친구끼리만</T>
                      <T size={13} color="ink2">{member && accepted < 1 ? "초대를 수락한 친구가 1명 이상 있어야 해요." : `모르는 사람은 들어오지 않아요. 나중에 친구를 더 초대할 수 있어요 (최대 ${TEAM_MAX}명).`}</T>
                    </View>
                  </Row>
                </Card>
              </Pressable>
            </>
          ) : null}
        </>
      ) : (
        <>
          {/* 팀원 */}
          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T size={17} weight="bold">우리 팀 {team.members.length}/{TEAM_MAX}</T>
              <Badge label={team.mode === "friends" ? "친구끼리 팀" : "빈자리 채우는 팀"} tone={team.mode === "friends" ? "navy" : "plain"} />
            </Row>
            {Array.from({ length: TEAM_MAX }, (_, i) => team.members[i] ?? null).map((m, i) => (
              <Row key={i} gap={10} style={{ flexWrap: "nowrap", paddingVertical: 4 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: m ? (m.me ? c.accentSoft : c.chip) : "transparent",
                  borderWidth: m ? 0 : 1.5, borderColor: c.line2, borderStyle: "dashed" }}>
                  {m ? <T size={15} weight="bold">{m.nickname.slice(0, 1)}</T> : <T size={18} color="muted">+</T>}
                </View>
                {m ? (
                  <>
                    <View style={{ flex: 1 }}>
                      <Row gap={6}>
                        <T size={15} weight="semibold">{m.nickname}{m.me ? " (나)" : ""}</T>
                        {m.leader ? <Icon name="crown" size={16} /> : null}
                      </Row>
                      <T size={12} color="muted">이번 주 {m.weekXp} XP{m.claimed ? " · 보상 받음" : ""}</T>
                    </View>
                  </>
                ) : (
                  <T size={14} color="muted" style={{ flex: 1 }}>{team.mode === "open" ? "빈자리 · 다른 사람이 들어오면 채워져요" : "빈자리 · 친구를 초대할 수 있어요"}</T>
                )}
              </Row>
            ))}
            {team.members.length < TEAM_MIN ? <T size={13} color="accent" weight="semibold">팀원이 {TEAM_MIN}명 이상이 되면 주간 목표가 시작돼요.</T> : null}
          </Card>

          {/* 주간 목표 */}
          <Card style={{ gap: 10 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T size={17} weight="bold">이번 주 팀 목표</T>
              <T size={12} color="muted">{short(s.week.start)} ~ {short(s.week.end)}</T>
            </Row>
            <T size={13} color="ink2">팀원 XP 합 {team.progress.goal} XP (한 명당 {TEAM_GOAL_PER_MEMBER}) · 공부 · 스피드 퀴즈 · 보스전 XP가 모두 들어가요.</T>
            <View style={{ height: 16, borderRadius: 8, backgroundColor: c.chip, overflow: "hidden", ...inset(c) }}>
              <View style={{ width: `${Math.min(100, (team.progress.total / team.progress.goal) * 100)}%`, height: "100%", backgroundColor: team.progress.done ? c.success : c.accent,
                ...(c.grad.accent && !team.progress.done ? { experimental_backgroundImage: c.grad.accent } : null) }} />
            </View>
            <Row style={{ justifyContent: "space-between" }}>
              <T size={15} weight="bold">{team.progress.total} / {team.progress.goal} XP</T>
              <Row gap={10}>
                <Row gap={4}><Icon name="gear" size={18} /><T size={14} weight="semibold">{TEAM_REWARD.gears}</T></Row>
                <Row gap={4}><Icon name="bolt" size={18} /><T size={14} weight="semibold">{TEAM_REWARD.xp} XP</T></Row>
              </Row>
            </Row>
            {team.members.find((m) => m.me)?.claimed ? (
              <T size={14} color="success" weight="semibold">이번 주 보상을 받았어요. 다음 주 월요일에 새 목표가 시작돼요.</T>
            ) : team.canClaim ? (
              <Btn title={`보상 받기 · 톱니바퀴 ${TEAM_REWARD.gears} · ${TEAM_REWARD.xp} XP`} variant="accent" icon={<Icon name="chest" size={20} />} loading={busy} onPress={() => act(claimTeamReward, "보상을 받았어요!")} />
            ) : (
              <T size={12} color="muted">{team.progress.done ? "이번 주에 공부해서 XP를 얻은 팀원만 받을 수 있어요." : s.preview ? "미리 보기에서는 보상을 받을 수 없어요." : "목표를 채우면 이번 주에 XP를 얻은 팀원마다 보상을 받아요."}</T>
            )}
          </Card>

          {/* 친구 더 초대 */}
          {room > 0 && !s.preview ? (
            <>
              <SectionTitle title="친구 초대하기" />
              <Card style={{ gap: 10 }}>
                <T size={13} color="ink2">빈자리 {room}개 · 친구가 수락하면 바로 팀에 들어와요.</T>
                {invitePanel}
              </Card>
            </>
          ) : null}

          <Btn title="팀 나가기" variant="ghost" size="sm" onPress={() => (member ? act(leaveTeam, "팀에서 나왔어요.") : setPreviewMode(null))} />
        </>
      )}
      <View style={{ height: radius.md }} />
    </Screen>
  );
}
