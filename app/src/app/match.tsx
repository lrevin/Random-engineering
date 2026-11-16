import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { BattleIntro, useBattleIntroFirstTime } from "@/components/BattleIntro";
import { Icon, type IconName } from "@/components/Icon";
import { MatchOverlay } from "@/components/MatchOverlay";
import { SectionTitle } from "@/components/StatTile";
import { Btn, Card, Row, Screen, T } from "@/components/ui";
import { interestName } from "@/data";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, BATTLE_XP_MAX, FREE_BATTLE_TICKETS } from "@/lib/economy";
import { userLevel } from "@/lib/rank";
import { sfx } from "@/lib/sfx";
import { getBattleHistory, getMatch, joinMatch, leaveMatch, serverNow, socialMessage, type Battle, type MatchState } from "@/lib/social";
import { radius, useColors } from "@/theme";

/** 매칭 대기 최대 시간 · 공부 시간 · 본 문제 수 (서버 규칙과 같음: docs/BATTLE_SYSTEM.md) */
const MATCH_WAIT_SEC = 180;
const MATCH_STUDY_MIN = 10;
const MATCH_QUESTIONS = 5;

/** 동그란 얼굴: 나는 노란 동전(프로필과 같은 모양), 상대는 점선 물음표 */
function Face({ label, name, sub, mine }: { label: string; name: string; sub: string; mine: boolean }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", gap: 4, flex: 1 }}>
      <View style={mine ? {
        width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center",
        backgroundColor: c.gold, borderWidth: 4, borderColor: c.goldSoft, boxShadow: "0px 5px 0px #c98f00",
      } : {
        width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center",
        backgroundColor: c.chip, borderWidth: 3, borderColor: c.line2, borderStyle: "dashed",
      }}>
        <T size={36} weight="bold" style={{ color: mine ? "#1d2742" : c.muted, lineHeight: 44 }}>{label}</T>
      </View>
      <T size={16} weight="bold" numberOfLines={1} style={{ marginTop: 6 }}>{name}</T>
      <T size={12} color="muted">{sub}</T>
    </View>
  );
}

/** 작은 규칙 칩: 그림 + 짧은 글 */
function Chip({ icon, label }: { icon: IconName; label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: c.chip }}>
      <Icon name={icon} size={18} />
      <T size={13} weight="semibold" color="ink2">{label}</T>
    </View>
  );
}

/** 배틀 진행 순서 (BattleIntro와 같은 규칙) */
const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "swords", title: "상대 찾기", body: "관심 분야가 겹치는 학습자와 1:1로 매칭돼요." },
  { icon: "dice", title: "같은 주제 뽑기", body: "두 사람에게 같은 주제가 같은 순간에 뽑혀요." },
  { icon: "hourglass", title: `${MATCH_STUDY_MIN}분 공부`, body: "둘 다 같은 시간 동안 공부해요. 시간은 늘릴 수 없어요." },
  { icon: "target", title: `${MATCH_QUESTIONS}문제 대결`, body: "같은 문제를 같은 순서로 풀어요. 동점이면 연장전!" },
  { icon: "trophy", title: "승리 보상", body: `진 사람 경험치의 5%(최대 ${BATTLE_XP_MAX} XP)를 가져와요.` },
];

/**
 * 랜덤 매칭 배틀 대기 화면 (콘텐츠 탭에서 들어옴).
 * 처음 들어오면 배틀 안내를 한 번 보여 주고, ? 버튼으로 다시 볼 수 있음.
 * 매칭·배틀권·승패는 모두 서버가 처리하고, 이 화면은 상태를 2.5초마다 읽어 보여 줌.
 */
export default function Match() {
  const { mode, uid, prefs, xp, premium, freeTickets, boughtTickets, gears, buyBattleTicket, refreshWallet, walletNotice } = useApp();
  const c = useColors();
  const focused = useIsFocused();
  const [match, setMatch] = useState<MatchState>({ status: "none" });
  const [history, setHistory] = useState<Battle[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(serverNow());
  // 이 화면에 처음 들어오면 설명을 한 번 보여 줌. ? 버튼으로 다시 볼 수 있음
  const firstTime = useBattleIntroFirstTime();
  const [intro, setIntro] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  /** 기다리다 매칭되면 잠깐 상대를 보여 준 뒤 배틀 화면으로 */
  const [found, setFound] = useState<string | null>(null);
  const prevStatus = useRef("");
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (mode !== "user" || running.current) return;
    running.current = true;
    try {
      const m = await getMatch();
      // 기다리던 매칭이 잡힘 → 상대 공개 + 효과음 → 배틀 화면 (처음 열 때 이미 잡혀 있던 건 이어하기 카드로)
      if (prevStatus.current === "waiting" && m.status === "matched") {
        const b = m.battle;
        sfx("match");
        setFound((b.from.uid === uid ? b.to : b.from).nickname);
        setTimeout(() => { setFound(null); router.push({ pathname: "/battle", params: { id: b.id } }); }, 1800);
      }
      prevStatus.current = m.status;
      setMatch(m);
      setHistory((await getBattleHistory()).battles);
      await refreshWallet();
      setNotice("");
    } catch (e) {
      setNotice(socialMessage(e));
    } finally {
      running.current = false;
    }
  }, [mode, uid, refreshWallet]);

  useFocusEffect(useCallback(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]));

  const waiting = match.status === "waiting";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const m = await joinMatch();
      // 바로 잡혀도 다음 확인 때 상대 공개 연출이 나오게 "기다리는 중"으로 둠
      prevStatus.current = "waiting";
      setMatch(m.status === "matched" ? { status: "waiting", id: "", joinedAt: new Date(serverNow()).toISOString(), expiresAt: "" } : m);
      await refreshWallet();
      setNotice("");
      void refresh();
    } catch (e) {
      setNotice(socialMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (match.status !== "waiting" || !match.id || busy) return;
    setBusy(true);
    try {
      setMatch(await leaveMatch(match.id));
      prevStatus.current = "none";
      await refreshWallet();
      setNotice("매칭을 취소했어요. 배틀권은 돌려받았어요.");
    } catch (e) {
      setNotice(socialMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const buyTicket = async () => {
    setBusy(true);
    try { if (!await buyBattleTicket()) setNotice("톱니바퀴 또는 구매 한도를 확인해 주세요."); }
    finally { setBusy(false); }
  };

  const tickets = freeTickets + boughtTickets;
  const noTicket = !premium && tickets <= 0;
  const waitedSec = waiting ? Math.max(0, (now - Date.parse(match.joinedAt)) / 1000) : 0;
  const result = (b: Battle) => (b.status === "void" ? "무효" : !b.outcome?.winner ? "무승부" : b.outcome.winner === uid ? "승리" : "패배");

  const interests = prefs.interests.map(interestName);
  const opponent = match.status === "matched" ? (match.battle.from.uid === uid ? match.battle.to : match.battle.from) : null;

  /** 큰 카드 맨 아래 버튼: 상태에 따라 하나만 */
  const action = mode !== "user" ? (
    <View style={{ gap: 8 }}>
      <Btn title="회원가입 · 로그인하고 배틀하기" variant="accent" size="lg" onPress={() => router.push("/signup")} />
      <T size={13} color="muted" center>배틀은 서버에서 상대를 찾아서 회원만 할 수 있어요.</T>
    </View>
  ) : opponent && match.status === "matched" ? (
    <Btn title={`${opponent.nickname}님과 배틀 이어하기`} variant="accent" size="lg" icon={<Icon name="play" size={22} color="#ffffff" />}
      onPress={() => { if (match.status === "matched") router.push({ pathname: "/battle", params: { id: match.battle.id } }); }} />
  ) : noTicket ? (
    <View style={{ gap: 8 }}>
      <Btn title={`배틀권 사기 · 톱니바퀴 ${BATTLE_TICKET_COST}개`} variant="accent" size="lg" icon={<Icon name="gear" size={24} />}
        loading={busy} disabled={gears < BATTLE_TICKET_COST} onPress={buyTicket} />
      {gears < BATTLE_TICKET_COST && <T size={13} color="accent" center>톱니바퀴가 {BATTLE_TICKET_COST - gears}개 부족해요. 퀘스트로 모아 보세요.</T>}
    </View>
  ) : (
    <Btn title={busy ? "매칭 준비하는 중…" : premium ? "랜덤 매칭 시작" : "랜덤 매칭 시작 · 배틀권 1개"} variant="accent" size="lg"
      icon={<Icon name="swords" size={24} />} loading={busy} onPress={join} />
  );

  return (
    <Screen edges={["top"]} scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <Row gap={12} style={{ flexWrap: "nowrap", flexShrink: 1 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="뒤로">
            <Icon name="close" size={24} color={c.muted} />
          </Pressable>
          <T size={24} weight="bold" numberOfLines={1}>랜덤 매칭 배틀</T>
        </Row>
        <Pressable onPress={() => setIntro(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="배틀 설명 보기"
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.line2, alignItems: "center", justifyContent: "center", backgroundColor: c.paper }}>
          <T size={17} weight="bold" color="ink2">?</T>
        </Pressable>
      </Row>
      <BattleIntro open={intro || (firstTime && !introSeen)} onClose={() => { setIntro(false); setIntroSeen(true); }} />

      {/* 큰 카드 하나: 나 VS 상대 · 규칙 · 배틀권 · 시작 버튼 */}
      <Card style={{ gap: 16, paddingTop: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Face label={(prefs.nickname || "나").slice(0, 1)} name={prefs.nickname || "나"} sub={`${userLevel(xp).level}레벨`} mine />
          <View style={{ paddingTop: 26, alignItems: "center" }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.accent, ...(c.grad.accent ? { experimental_backgroundImage: c.grad.accent } : null), transform: [{ rotate: "-6deg" }] }}>
              <T size={20} weight="bold" style={{ color: c.accentInk }}>VS</T>
            </View>
          </View>
          <Face label={opponent ? opponent.nickname.slice(0, 1) : "?"} name={opponent ? opponent.nickname : "누구일까요?"} sub={opponent ? "배틀 중" : "매칭하면 공개"} mine={false} />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
          <Chip icon="hourglass" label={`공부 ${MATCH_STUDY_MIN}분`} />
          <Chip icon="target" label={`${MATCH_QUESTIONS}문제`} />
          <Chip icon="trophy" label={`최대 ${BATTLE_XP_MAX} XP`} />
        </View>

        <View style={{ height: 1, backgroundColor: c.line }} />

        {/* 배틀권 */}
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <Row gap={10} style={{ flexWrap: "nowrap", flexShrink: 1 }}>
            <Icon name="ticket" size={30} />
            <View style={{ flexShrink: 1 }}>
              <T size={15} weight="bold">남은 배틀권 {premium ? "무제한" : `${tickets}개`}</T>
              <T size={12} color="muted">{premium ? "프리미엄 멤버십 사용 중" : `이번 달 무료 ${freeTickets} / ${FREE_BATTLE_TICKETS} · 산 것 ${boughtTickets}개`}</T>
            </View>
          </Row>
          {!premium && mode === "user" && !noTicket && (
            <Pressable onPress={buyTicket} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="배틀권 더 사기">
              <T size={14} weight="semibold" color="accent">더 사기 ›</T>
            </Pressable>
          )}
        </Row>

        {action}
        {notice || walletNotice ? <T size={13} color="accent" center>{notice || walletNotice}</T> : null}
      </Card>

      {!premium && (
        <Btn title="프리미엄은 배틀 무제한" variant="premium" size="md" icon={<Icon name="crown" size={24} />} onPress={() => router.push("/shop")} />
      )}

      {/* 상대를 찾는 분야: 한 줄로만 */}
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
        <Icon name="globe" size={30} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={14} weight="bold">관심 분야 {interests.length}개에서 상대를 찾아요</T>
          <T size={12} color="muted" numberOfLines={1}>
            {interests.length ? `${interests.slice(0, 3).join(" · ")}${interests.length > 3 ? ` 외 ${interests.length - 3}개` : ""}` : "관심 분야를 먼저 골라 주세요"}
          </T>
        </View>
      </Card>

      {/* 최근 배틀 */}
      {mode === "user" && history.length > 0 && (
        <>
          <SectionTitle title="최근 배틀" />
          <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, backgroundColor: c.paper, overflow: "hidden" }}>
            {history.slice(0, 10).map((b, i) => {
              const r = result(b);
              return (
                <Pressable key={b.id} onPress={() => router.push({ pathname: "/battle", params: { id: b.id } })} accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14,
                    backgroundColor: pressed ? c.chip : c.paper, borderTopWidth: i ? 1 : 0, borderTopColor: c.line })}>
                  <Icon name={r === "승리" ? "trophy" : "swords"} size={26} />
                  <T size={15} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{(b.from.uid === uid ? b.to : b.from).nickname}</T>
                  <T size={14} weight="bold" style={{ color: r === "승리" ? c.success : r === "패배" ? c.accent : c.muted }}>{r}</T>
                  <T size={16} color="muted">›</T>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* 진행 순서 */}
      <SectionTitle title="배틀은 이렇게 진행돼요" />
      <Card style={{ paddingVertical: 6 }}>
        {STEPS.map((st, i) => (
          <View key={st.title} style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>
                <Icon name={st.icon} size={26} />
              </View>
            </View>
            <View style={{ flex: 1, gap: 2, justifyContent: "center" }}>
              <T size={15} weight="bold">{i + 1}. {st.title}</T>
              <T size={13} color="ink2">{st.body}</T>
            </View>
          </View>
        ))}
      </Card>

      <MatchOverlay
        visible={focused && (waiting || !!found)}
        me={prefs.nickname || "나"}
        myLevel={userLevel(xp).level}
        setting={`겹치는 관심 분야 · 공부 ${MATCH_STUDY_MIN}분 · 본 문제 ${MATCH_QUESTIONS}개`}
        waitedSec={waitedSec}
        maxSec={MATCH_WAIT_SEC}
        opponent={found}
        onCancel={cancel}
        cancelling={busy}
      />
    </Screen>
  );
}
