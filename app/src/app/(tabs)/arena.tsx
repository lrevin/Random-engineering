import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { MatchOverlay } from "@/components/MatchOverlay";
import { Btn, Card, Chip, Row, Screen, Segment, T } from "@/components/ui";
import { domainById, DOMAINS, TOPICS } from "@/data";
import { useApp } from "@/lib/app-state";
import { BATTLE_MINUTES, BATTLE_TICKET_COST, BATTLE_XP_MAX, FREE_BATTLE_TICKETS } from "@/lib/economy";
import { loadQuiz } from "@/lib/quiz";
import { userLevel } from "@/lib/rank";
import { getMatch, joinMatch, leaveMatch, serverNow, socialEnabled, socialMessage, type Battle, type MatchState } from "@/lib/social";
import { radius, useColors } from "@/theme";
import { DomainIcon, Icon } from "@/components/Icon";
import { battleOpponentLabel, isBattleRecord } from "@/lib/stats";

const MATCH_WAIT_SEC = 180;

/** 배틀 메뉴: 랜덤 상대와 1:1 매칭 배틀. 매칭을 돌리는 두 사람 모두 배틀권 1개씩 씀 */
export default function Arena() {
  const { premium, battleTickets, freeTickets, boughtTickets, buyBattleTicket, gears, records, spendBattleTicket, refundBattleTicket, claimOnce, uid, prefs, xp } = useApp();
  const focused = useIsFocused();
  const c = useColors();
  const [domain, setDomain] = useState("any");
  const [minutes, setMinutes] = useState<string>("10");
  const [match, setMatch] = useState<MatchState>({ status: "none" });
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
    const pool = domain === "any" ? TOPICS : TOPICS.filter((t) => t.domain === domain);
    if (!pool.length) return setNotice("이 분야에는 아직 주제가 없어요.");
    if (!spendBattleTicket()) return setNotice("배틀권이 없어요. 톱니바퀴로 사거나 다음 달 1일을 기다려 주세요.");
    setBusy(true);
    try {
      // 내가 먼저 기다리게 되면 이 주제·문제로 배틀이 열림 (상대가 분야를 정했으면 상대 것)
      const topic = pool[Math.floor(Math.random() * pool.length)];
      const quiz = await loadQuiz(topic);
      const m = await joinMatch({ domain, studySec: Number(minutes) * 60, topicId: topic.id, questions: quiz.questions });
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
  // 최근 배틀 기록 (배틀은 메모가 '…님과 배틀'로 남음)
  const recent = records.filter(isBattleRecord).slice(-5).reverse();

  return (
    <Screen edges={["top"]} scroll>
      <T size={26} weight="bold">배틀</T>

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
          <T size={13} color="muted">
            {premium ? "유료 멤버십 사용 중이에요." : `무료 배틀권은 매월 1일 00시에 ${FREE_BATTLE_TICKETS}개로 다시 채워지고, 산 배틀권은 사라지지 않아요. 유료 멤버십은 무제한 ›`}
          </T>
        </Card>
      </Pressable>

      {!socialEnabled ? (
        <Card><T size={15} color="ink2">배틀 서버가 아직 연결되지 않았어요. (개발용: app/.env.local 에 EXPO_PUBLIC_SOCIAL_URL)</T></Card>
      ) : (
        <Card style={{ gap: 12 }}>
          <Row gap={10}><Icon name="swords" size={34} /><T size={18} weight="bold">랜덤 매칭 배틀</T></Row>
          <T size={14} color="ink2">
            같은 조건으로 매칭을 돌린 다른 학습자와 1:1로 붙어요. 매칭되면 두 사람에게 같은 주제가 동시에 뽑혀요.
          </T>
          <T size={14} weight="semibold" color="ink2">분야</T>
          {/* 분야는 옆으로 넘기는 한 줄 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 18, paddingBottom: 4 }}>
            <Chip label="아무 분야" icon={<Icon name="dice" size={20} />} selected={domain === "any"} onPress={() => setDomain("any")} />
            {DOMAINS.filter((d) => d.available).map((d) => (
              <Chip key={d.id} label={d.name} icon={<DomainIcon id={d.id} size={20} />} selected={domain === d.id} onPress={() => setDomain(d.id)} />
            ))}
          </ScrollView>
          <Row style={{ justifyContent: "space-between" }}>
            <T size={14} weight="semibold" color="ink2">공부 시간</T>
            <Segment options={BATTLE_MINUTES.map((m) => ({ value: String(m), label: `${m}분` }))} value={minutes} onChange={setMinutes} />
          </Row>
          <View style={{ backgroundColor: c.chip, borderRadius: radius.md, padding: 12 }}>
            <T size={13} color="ink2">
              {premium ? "유료 멤버십이라 배틀권 걱정 없이 매칭할 수 있어요." : "매칭을 돌리는 두 사람 모두 배틀권을 1개씩 써요. 취소하거나 3분 안에 상대를 못 찾으면 돌려받아요."}
            </T>
          </View>
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
              <Btn title="유료 멤버십 알아보기 (무제한)" size="md" onPress={() => router.push("/shop")} />
            </View>
          ) : (
            <Btn title={busy ? "문제 준비하는 중…" : premium ? "랜덤 매칭 시작" : "랜덤 매칭 시작 (배틀권 1개)"} variant="accent" size="lg" loading={busy} onPress={start} />
          )}
        </Card>
      )}
      {notice ? <T size={13} color="accent" center>{notice}</T> : null}

      <MatchOverlay
        visible={focused && (waiting || !!found)}
        me={prefs.nickname || "나"}
        myLevel={userLevel(xp).level}
        setting={`${domain === "any" ? "아무 분야" : domainById(domain)?.name ?? ""} · 공부 ${minutes}분`}
        waitedSec={waitedSec}
        maxSec={MATCH_WAIT_SEC}
        opponent={found}
        onCancel={cancel}
        cancelling={busy}
      />

      {recent.length > 0 && (
        <Card style={{ gap: 8 }}>
          <T size={16} weight="bold">최근 배틀</T>
          {recent.map((r) => (
            <Row key={r.id} style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <T size={14} numberOfLines={1} style={{ flex: 1 }}>{r.topicKo} · {battleOpponentLabel(r)}</T>
              <T size={14} weight="semibold">{r.score} / {r.total}</T>
            </Row>
          ))}
        </Card>
      )}

      <View style={{ backgroundColor: c.chip, borderRadius: radius.md, padding: 14, gap: 4 }}>
        <T size={14} weight="semibold">배틀 규칙</T>
        <T size={13} color="ink2">
          같은 주제를 같은 시간 동안 공부한 뒤 같은 7문제를 풀어요. 배틀 중에는 시간을 추가할 수 없어요.
          점수가 높은 사람이 진 사람 경험치의 5%(최대 {BATTLE_XP_MAX} XP)를 가져가고, 같으면 그대로예요.
        </T>
      </View>
    </Screen>
  );
}
