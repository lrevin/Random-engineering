import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { AdRewardButton } from "@/components/AdRewardButton";
import { BattleIntro, useBattleIntroFirstTime } from "@/components/BattleIntro";
import { MatchOverlay } from "@/components/MatchOverlay";
import { Btn, Card, Row, Screen, T } from "@/components/ui";
import { certTopics, expandInterests, interestName, isCertId, TOPICS } from "@/data";
import { useApp } from "@/lib/app-state";
import { BATTLE_TICKET_COST, FREE_BATTLE_TICKETS } from "@/lib/economy";
import { BATTLE_QUIZ_LENGTH } from "@/lib/quiz";
import { userLevel } from "@/lib/rank";
import { getMatch, joinMatch, leaveMatch, serverNow, socialEnabled, socialMessage, type Battle, type MatchState } from "@/lib/social";
import { useColors } from "@/theme";
import { Icon } from "@/components/Icon";

const MATCH_WAIT_SEC = 180;
/** 매칭 배틀 공부 시간: 모두 10분으로 통일 */
const MATCH_STUDY_MIN = 10;

/** 매칭 후보 주제: 관심 분야마다 몇 개씩 무작위로 (서버가 두 사람 관심 분야가 겹치는 주제를 고름) */
function candidateTopics(interests: string[], perCategory = 3) {
  // 자격증 주제는 기존 주제를 그대로 쓰므로 세부 분야와 겹칠 수 있음: 이미 고른 주제는 건너뜀
  const out = new Set<string>();
  for (const cat of interests) {
    const ts = (isCertId(cat) ? certTopics(cat) : TOPICS.filter((t) => t.category === cat)).filter((t) => !out.has(t.id));
    for (let i = 0; i < perCategory && ts.length; i++) out.add(ts.splice(Math.floor(Math.random() * ts.length), 1)[0].id);
  }
  return [...out];
}

/** 배틀 메뉴: 랜덤 상대와 1:1 매칭 배틀. 매칭을 돌리는 두 사람 모두 배틀권 1개씩 씀 */
export default function Arena() {
  const { premium, battleTickets, freeTickets, boughtTickets, buyBattleTicket, gears, spendBattleTicket, refundBattleTicket, claimOnce, uid, prefs, xp } = useApp();
  const focused = useIsFocused();
  const c = useColors();
  const [match, setMatch] = useState<MatchState>({ status: "none" });
  // 배틀 탭을 처음 열면 설명(온보딩)을 한 번 보여 줌. ? 버튼으로 다시 볼 수 있음
  const firstTime = useBattleIntroFirstTime();
  const [intro, setIntro] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(serverNow());
  const waitingId = useRef<string | null>(null);
  /** 매칭되면 잠깐 상대를 보여 준 뒤 배틀 화면으로 */
  const [found, setFound] = useState<string | null>(null);
  const goBattle = useCallback((b: Battle) => {
    if (revealing.current) return;
    revealing.current = true;
    setFound((b.from.uid === uid ? b.to : b.from).nickname);
    setTimeout(() => {
      revealing.current = false;
      setFound(null);
      router.push({ pathname: "/battle", params: { id: b.id } });
    }, 1800);
  }, [uid]);
  const revealing = useRef(false);

  /** 기다리다 매칭이 안 되면(시간 초과 · 취소) 배틀권 돌려받기 (한 번만) */
  const refund = useCallback((id: string | null) => {
    if (id && claimOnce("match:" + id)) refundBattleTicket();
  }, [claimOnce, refundBattleTicket]);

  const poll = useCallback(() => {
    if (!socialEnabled) return;
    getMatch().then((m) => {
      if (m.status === "matched") {
        waitingId.current = null;
        goBattle(m.battle);
      } else if (m.status === "none" && waitingId.current) {
        refund(waitingId.current);
        waitingId.current = null;
        setNotice("3분 동안 상대를 찾지 못했어요. 배틀권은 돌려받았어요.");
      } else if (m.status === "waiting") {
        waitingId.current = m.id;
      }
      setMatch(m.status === "matched" ? { status: "none" } : m);
    }).catch(() => {});
  }, [refund, goBattle]);

  // 이 탭을 보는 동안 3초마다 매칭 상태 확인
  useFocusEffect(useCallback(() => {
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [poll]));

  const waiting = match.status === "waiting";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  const start = async () => {
    if (busy) return;
    setNotice("");
    const candidates = candidateTopics(prefs.interests);
    if (!candidates.length) return setNotice("관심 분야를 먼저 골라 주세요. (설정 › 관심 분야)");
    if (!spendBattleTicket()) return setNotice("배틀권이 없어요. 톱니바퀴로 사거나 다음 달 1일을 기다려 주세요.");
    setBusy(true);
    try {
      // 문제는 매칭된 뒤 공부하는 동안 AI가 만듦 (기다리는 동안 미리 만들지 않음)
      const m = await joinMatch({ interests: expandInterests(prefs.interests), candidates });
      if (m.status === "matched") {
        goBattle(m.battle);
        setMatch({ status: "none" });
      } else {
        if (m.status === "waiting") waitingId.current = m.id;
        setMatch(m);
      }
    } catch (e) {
      refundBattleTicket();
      setNotice(socialMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await leaveMatch();
      refund(waitingId.current);
      waitingId.current = null;
      setMatch({ status: "none" });
      setNotice("매칭을 취소했어요. 배틀권은 돌려받았어요.");
    } catch (e) {
      setNotice(socialMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const noTicket = !premium && battleTickets <= 0;
  const waitedSec = waiting ? Math.max(0, (now - Date.parse(match.joinedAt)) / 1000) : 0;

  return (
    <Screen edges={["top"]} scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">콘텐츠</T>
        <Pressable onPress={() => setIntro(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="배틀 설명 보기"
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.line2, alignItems: "center", justifyContent: "center", backgroundColor: c.paper }}>
          <T size={17} weight="bold" color="ink2">?</T>
        </Pressable>
      </Row>
      <BattleIntro open={intro || firstTime && !introSeen} onClose={() => { setIntro(false); setIntroSeen(true); }} />

      {/* 배틀권 · 멤버십 */}
      <Pressable onPress={() => router.push("/shop")} accessibilityRole="button" accessibilityLabel="배틀권과 멤버십 보기">
        <Card style={{ gap: 6 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={8}><Icon name="ticket" size={30} /><T size={16} weight="bold">남은 배틀권</T></Row>
            <T size={20} weight="bold" color="accent">{premium ? "무제한" : `${battleTickets}개`}</T>
          </Row>
          {!premium && (
            <T size={13} color="ink2">이번 달 무료 {freeTickets} / {FREE_BATTLE_TICKETS} · 톱니바퀴로 산 배틀권 {boughtTickets}개</T>
          )}
          {premium && <T size={13} color="muted">유료 멤버십 사용 중이에요.</T>}
        </Card>
      </Pressable>

      {/* 광고 보고 톱니바퀴 (배틀권은 톱니바퀴로 살 수 있음) */}
      <AdRewardButton />

      {!socialEnabled ? (
        <Card><T size={15} color="ink2">배틀 서버가 아직 연결되지 않았어요. (개발용: app/.env.local 에 EXPO_PUBLIC_SOCIAL_URL)</T></Card>
      ) : (
        <Card style={{ gap: 12 }}>
          <Row gap={10}><Icon name="swords" size={34} /><T size={18} weight="bold">랜덤 매칭 배틀</T></Row>
          <T size={13} color="ink2">
            내 관심 분야에서만 출제돼요{prefs.interests.length ? ` · ${prefs.interests.slice(0, 3).map(interestName).join(", ")}${prefs.interests.length > 3 ? ` 외 ${prefs.interests.length - 3}개` : ""}` : ""}
          </T>
          {noTicket ? (
            <View style={{ gap: 10 }}>
              <Btn
                title={`톱니바퀴 ${BATTLE_TICKET_COST}개로 매칭 시작`}
                variant="accent"
                size="lg"
                icon={<Icon name="gear" size={24} />}
                loading={busy}
                disabled={gears < BATTLE_TICKET_COST}
                onPress={() => { if (buyBattleTicket()) start(); }}
              />
              {gears < BATTLE_TICKET_COST && <T size={13} color="accent" center>톱니바퀴가 {BATTLE_TICKET_COST - gears}개 부족해요. 퀘스트로 모아 보세요.</T>}
            </View>
          ) : (
            <Btn title={busy ? "매칭 준비하는 중…" : premium ? "랜덤 매칭 시작" : "랜덤 매칭 시작 (배틀권 1개)"} variant="accent" size="lg" loading={busy} onPress={start} />
          )}
          {!premium && <Btn title="뽑공 프리미엄으로 무제한 매칭" variant="premium" size="md" icon={<Icon name="crown" size={24} />} onPress={() => router.push("/shop")} />}
        </Card>
      )}
      {notice ? <T size={13} color="accent" center>{notice}</T> : null}

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

      <MatchOverlay
        visible={focused && (waiting || !!found)}
        me={prefs.nickname || "나"}
        myLevel={userLevel(xp).level}
        setting={`관심 분야 ${prefs.interests.length}개 · 공부 ${MATCH_STUDY_MIN}분 · AI 문제 ${BATTLE_QUIZ_LENGTH}개`}
        waitedSec={waitedSec}
        maxSec={MATCH_WAIT_SEC}
        opponent={found}
        onCancel={cancel}
        cancelling={busy}
      />

    </Screen>
  );
}
