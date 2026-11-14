import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { AdRewardButton } from "@/components/AdRewardButton";
import { BattleIntro, useBattleIntroFirstTime } from "@/components/BattleIntro";
import { Icon } from "@/components/Icon";
import { MatchOverlay } from "@/components/MatchOverlay";
import { SectionTitle } from "@/components/StatTile";
import { Btn, Card, Row, Screen, T } from "@/components/ui";
import { interestName } from "@/data";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, FREE_BATTLE_TICKETS } from "@/lib/economy";
import { userLevel } from "@/lib/rank";
import { sfx } from "@/lib/sfx";
import { getBattleHistory, getMatch, joinMatch, leaveMatch, serverNow, socialMessage, type Battle, type MatchState } from "@/lib/social";
import { radius, useColors } from "@/theme";

/** 매칭 대기 최대 시간 · 공부 시간 · 본 문제 수 (서버 규칙과 같음: docs/BATTLE_SYSTEM.md) */
const MATCH_WAIT_SEC = 180;
const MATCH_STUDY_MIN = 10;
const MATCH_QUESTIONS = 5;

/**
 * 콘텐츠 탭: 1:1 랜덤 매칭 배틀 + 스피드 퀴즈.
 * 매칭·배틀권·승패는 모두 서버가 처리하고, 이 화면은 상태를 2.5초마다 읽어 보여 줌.
 */
export default function Arena() {
  const { mode, uid, prefs, xp, premium, freeTickets, boughtTickets, gears, buyBattleTicket, refreshWallet, walletNotice } = useApp();
  const c = useColors();
  const focused = useIsFocused();
  const [match, setMatch] = useState<MatchState>({ status: "none" });
  const [history, setHistory] = useState<Battle[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(serverNow());
  // 배틀 탭을 처음 열면 설명을 한 번 보여 줌. ? 버튼으로 다시 볼 수 있음
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

  return (
    <Screen edges={["top"]} scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">콘텐츠</T>
        <Pressable onPress={() => setIntro(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="배틀 설명 보기"
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.line2, alignItems: "center", justifyContent: "center", backgroundColor: c.paper }}>
          <T size={17} weight="bold" color="ink2">?</T>
        </Pressable>
      </Row>
      <BattleIntro open={intro || (firstTime && !introSeen)} onClose={() => { setIntro(false); setIntroSeen(true); }} />

      {/* 배틀권 · 멤버십 */}
      <Pressable onPress={() => router.push("/shop")} accessibilityRole="button" accessibilityLabel="배틀권과 멤버십 보기">
        <Card style={{ gap: 6 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={8}><Icon name="ticket" size={30} /><T size={16} weight="bold">남은 배틀권</T></Row>
            <T size={20} weight="bold" color="accent">{premium ? "무제한" : `${tickets}개`}</T>
          </Row>
          {!premium && <T size={13} color="ink2">이번 달 무료 {freeTickets} / {FREE_BATTLE_TICKETS} · 톱니바퀴로 산 배틀권 {boughtTickets}개</T>}
          {premium && <T size={13} color="muted">프리미엄 멤버십 사용 중이에요.</T>}
        </Card>
      </Pressable>

      {/* 광고 보고 톱니바퀴 (배틀권은 톱니바퀴로 살 수 있음) */}
      <AdRewardButton />

      {mode !== "user" ? (
        <Card style={{ gap: 10 }}>
          <Row gap={10}><Icon name="swords" size={34} /><T size={18} weight="bold">랜덤 매칭 배틀</T></Row>
          <T size={14} color="ink2">배틀은 서버에서 상대를 찾아요. 로그인하면 할 수 있어요.</T>
          <Btn title="회원가입 · 로그인" variant="accent" onPress={() => router.push("/signup")} />
        </Card>
      ) : match.status === "matched" ? (
        <Card accent style={{ gap: 10 }}>
          <Row gap={10}><Icon name="swords" size={34} /><T size={18} weight="bold">진행 중인 배틀이 있어요</T></Row>
          <T size={14} color="ink2">{(match.battle.from.uid === uid ? match.battle.to : match.battle.from).nickname}님과 배틀 중 · 앱을 닫아도 제한 시간은 계속 흘러요.</T>
          <Btn title="배틀 이어하기" variant="accent" size="lg" icon={<Icon name="play" size={22} color="#ffffff" />}
            onPress={() => { if (match.status === "matched") router.push({ pathname: "/battle", params: { id: match.battle.id } }); }} />
        </Card>
      ) : (
        <Card style={{ gap: 12 }}>
          <Row gap={10}><Icon name="swords" size={34} /><T size={18} weight="bold">랜덤 매칭 배틀</T></Row>
          <T size={13} color="ink2">
            서로 겹치는 관심 분야에서 같은 주제로 {MATCH_STUDY_MIN}분 공부하고 {MATCH_QUESTIONS}문제 대결
            {prefs.interests.length ? ` · ${prefs.interests.slice(0, 3).map(interestName).join(", ")}${prefs.interests.length > 3 ? ` 외 ${prefs.interests.length - 3}개` : ""}` : ""}
          </T>
          {noTicket ? (
            <View style={{ gap: 10 }}>
              <Btn title={`배틀권 사기 (톱니바퀴 ${BATTLE_TICKET_COST}개)`} variant="accent" size="lg" icon={<Icon name="gear" size={24} />}
                loading={busy} disabled={gears < BATTLE_TICKET_COST} onPress={buyTicket} />
              {gears < BATTLE_TICKET_COST && <T size={13} color="accent" center>톱니바퀴가 {BATTLE_TICKET_COST - gears}개 부족해요. 퀘스트로 모아 보세요.</T>}
            </View>
          ) : (
            <>
              <Btn title={busy ? "매칭 준비하는 중…" : premium ? "랜덤 매칭 시작" : "랜덤 매칭 시작 (배틀권 1개)"} variant="accent" size="lg" loading={busy} onPress={join} />
              {!premium && <Btn title={`배틀권 더 사기 (톱니바퀴 ${BATTLE_TICKET_COST}개)`} size="sm" disabled={busy} onPress={buyTicket} />}
            </>
          )}
          {!premium && <Btn title="뽑공 프리미엄으로 무제한 매칭" variant="premium" size="md" icon={<Icon name="crown" size={24} />} onPress={() => router.push("/shop")} />}
        </Card>
      )}
      {notice || walletNotice ? <T size={13} color="accent" center>{notice || walletNotice}</T> : null}

      {/* 스피드 퀴즈 미니게임 */}
      <Pressable onPress={() => router.push("/speed")} accessibilityRole="button" accessibilityLabel="스피드 퀴즈 하러 가기">
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="bolt" size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={18} weight="bold">스피드 퀴즈</T>
            <T size={13} color="ink2">1분 동안 공부한 주제의 4지선다 풀기</T>
            <T size={12} color="muted">맞힌 만큼 경험치 · 배틀권 필요 없음</T>
          </View>
          <T size={22} color="muted">›</T>
        </Card>
      </Pressable>

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
