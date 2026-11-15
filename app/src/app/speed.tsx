import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/StatTile";
import { Badge, Btn, Card, Row, Screen, T } from "@/components/ui";
import { topicById, type Topic } from "@/data";
import { useApp } from "@/lib/app-state";
import { speedQuestions, type ExamItem } from "@/lib/quiz";
import { speedNow, finishPractice, finishSpeed, readSpeed, startSpeed, answerSpeed, speedItem, speedMessage, type SpeedQuestion, SPEED_DAILY_XP_CAP, SPEED_SEC, SPEED_XP_PER_CORRECT, type SpeedStore } from "@/lib/speed";
import { sfx } from "@/lib/sfx";
import { radius, raised, shadow, useColors } from "@/theme";
import { answerText } from "./quiz";

type Phase = "ready" | "loading" | "play" | "done";
interface Answered { item: ExamItem; ok: boolean }

/** 스피드 퀴즈: 1분 동안 공부한 주제의 4지선다 문제를 최대한 많이 맞히기 */
export default function Speed() {
  const { records, mode, refreshSpeedXp } = useApp();
  const c = useColors();
  const [notice,setNotice]=useState("");
  const [practice,setPractice]=useState(mode!=="user");
  const [onlineRun,setOnlineRun]=useState<string|null>(null);
  const position=useRef(0),answerBusy=useRef(false),pendingAnswer=useRef<{position:number;answer:number}|null>(null);
  const finishing=useRef(false);
  const playEpoch=useRef(0);
  const [finishRetry,setFinishRetry]=useState(0);
  const [store, setStore] = useState<SpeedStore | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [pool, setPool] = useState<ExamItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState<Answered[]>([]);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(SPEED_SEC);
  const [flash, setFlash] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ xp: number; newBest: boolean; correct:number; total:number } | null>(null);
  const [shake] = useState(() => new Animated.Value(0));
  const endAt = useRef(0);

  useEffect(() => {readSpeed(mode==="user").then(setStore).catch(e=>setNotice(speedMessage(e)));}, [mode]);

  // 한 번 이상 공부한 주제 (배틀 기록 포함)
  const studied = useMemo(() => {
    const out: Topic[] = [];
    for (const id of new Set(records.map((r) => r.topicId))) {
      const t = topicById(id);
      if (t) out.push(t);
    }
    return out;
  }, [records]);

  // 1분 타이머
  useEffect(() => {
    if (phase !== "play") return;
    let lastTick = -1;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((endAt.current - speedNow()) / 1000));
      setLeft(s);
      // 마지막 5초는 째깍, 끝나면 종료음
      if (s !== lastTick && s > 0 && s <= 5) sfx("tick");
      lastTick = s;
      if (s <= 0) { sfx("go"); setPhase("done"); }
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  // 끝나면 경험치 지급 (한 번만)
  const displayedResult=result;
  const correct=displayedResult?.correct??log.filter(x=>x.ok).length;
  useEffect(()=>{
    if(phase!=="done"||result||finishing.current)return;
    if(practice){
      finishing.current=true;
      finishPractice(log.filter(x=>x.ok).length).then(value=>{setStore(value.store);setResult({...value,total:log.length});}).catch(e=>setNotice(speedMessage(e))).finally(()=>{finishing.current=false;});return;
    }
    if(!onlineRun)return;
    finishing.current=true;
    finishSpeed(onlineRun).then(async value=>{setStore(value.store);setResult(value);setNotice("");await refreshSpeedXp().catch(()=>{});}).catch(e=>setNotice(speedMessage(e))).finally(()=>{finishing.current=false;});
  },[phase,result,practice,onlineRun,log,refreshSpeedXp,finishRetry]);

  const start=async(practiceOnly=false)=>{
    if(!studied.length)return;
    playEpoch.current++;answerBusy.current=false;
    setNotice("");setPhase("loading");setResult(null);setLog([]);setIdx(0);setCombo(0);setFlash(null);setPicked(null);pendingAnswer.current=null;
    const local=practiceOnly||mode!=="user";setPractice(local);setOnlineRun(null);
    try{
      if(local){const qs=await speedQuestions(studied);if(!qs.length)throw new Error("empty");setPool(qs);endAt.current=speedNow()+SPEED_SEC*1000;}
      else{
        const sentAt=speedNow();const run=await startSpeed();setOnlineRun(run.runId);
        if(run.completed||!run.question){setPhase("done");return;}
        position.current=run.question.position;setPool([speedItem(run.question)]);
        endAt.current=sentAt+Math.max(0,Date.parse(run.deadlineAt)-Date.parse(run.serverNow));
      }
      setLeft(Math.max(0,Math.ceil((endAt.current-speedNow())/1000)));setPhase("play");sfx("go");
    }catch(e){setNotice(speedMessage(e));setPhase("ready");}
  };

  const answer=async(v:number)=>{
    if(phase!=="play"||flash!==null||answerBusy.current||speedNow()>=endAt.current)return;
    const epoch=playEpoch.current;
    answerBusy.current=true;setNotice("");
    const item=pool[idx%pool.length];let ok=item.q.answer===v,next:SpeedQuestion|null=null,answered=item;
    try{
      if(!practice&&onlineRun){
        pendingAnswer.current??={position:position.current,answer:v};
        v=pendingAnswer.current.answer;
        const value=await answerSpeed(onlineRun,pendingAnswer.current.position,v);if(playEpoch.current!==epoch)return;pendingAnswer.current=null;
        ok=value.correct;next=value.next;if(item.q.type!=="mc")throw new Error("invalid_question");answered={...item,q:{...item.q,answer:value.answer,explain:value.explain}};
        setPool(xs=>xs.map((x,i)=>i===idx?answered:x));
      }
      setPicked(v);sfx(ok?"correct":"wrong",0.8);
      if(Platform.OS!=="web")Haptics.notificationAsync(ok?Haptics.NotificationFeedbackType.Success:Haptics.NotificationFeedbackType.Error).catch(()=>{});
      if(!ok)Animated.sequence([Animated.timing(shake,{toValue:1,duration:50,useNativeDriver:true}),Animated.timing(shake,{toValue:-1,duration:50,useNativeDriver:true}),Animated.timing(shake,{toValue:0,duration:50,useNativeDriver:true})]).start();
      setFlash(ok);setLog(l=>[...l,{item:answered,ok}]);setCombo(k=>ok?k+1:0);
      setTimeout(()=>{
        if(playEpoch.current!==epoch)return;
        setFlash(null);setPicked(null);answerBusy.current=false;
        if(practice)setIdx(i=>i+1);
        else if(next){position.current=next.position;setPool(xs=>[...xs,speedItem(next!)]);setIdx(i=>i+1);}
        else setPhase("done");
      },ok?250:700);
    }catch(e){setNotice(speedMessage(e));answerBusy.current=false;}
  };

  // ───────── 준비 · 불러오는 중 ─────────
  if (phase === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <ActivityIndicator size="large" color={c.accent} />
        <T size={17} weight="semibold">공부한 주제에서 문제를 고르고 있어요</T>
      </SafeAreaView>
    );
  }

  // ───────── 게임 중 ─────────
  if (phase === "play") {
    const item = pool[idx % pool.length];
    const pct = left / SPEED_SEC;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: flash === null ? c.bg : flash ? c.successSoft : c.accentSoft }} edges={["top", "bottom"]}>
        <View style={{ padding: 20, gap: 14, flex: 1 }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <Row gap={6}><Icon name="clock" size={24} /><T size={26} weight="bold" color={left <= 10 ? "accent" : "ink"}>{left}초</T></Row>
            <Row gap={10}>
              {combo >= 3 && <Badge label={`${combo} 콤보!`} tone="accent" />}
              <T size={22} weight="bold" color="success">{correct}개</T>
            </Row>
          </Row>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: c.chip, overflow: "hidden" }}>
            <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: left <= 10 ? c.accent : c.gold }} />
          </View>

          {notice?<T color="accent">{notice}</T>:null}
          <Animated.View style={{ flex: 1, justifyContent: "center", gap: 12, transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }] }}>
            <View style={{ alignSelf: "center" }}><Badge label={`${item.topic.categoryName} · ${item.topic.ko}`} /></View>
            <T size={21} weight="bold" center style={{ lineHeight: 30 }}>{item.q.q}</T>
          </Animated.View>

          <View style={{ gap: 10 }}>
            {item.q.type === "mc" && item.q.choices.map((ch, i) => {
              const isAnswer = flash !== null && i === item.q.answer;
              const isWrongPick = flash === false && i === picked;
              return (
                <Pressable
                  key={i}
                  onPress={() => answer(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}번 ${ch}`}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 2,
                    borderColor: isAnswer ? c.success : isWrongPick ? c.accent : c.line2,
                    backgroundColor: isAnswer ? c.successSoft : isWrongPick ? c.accentSoft : c.paper,
                    ...raised(isAnswer ? c.successDeep : isWrongPick ? c.accentDeep : c.paperEdge, pressed && flash === null, 5),
                    ...(!pressed ? shadow(c, 1) : null),
                  })}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderBottomWidth: 3, borderColor: c.line2, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
                    <T size={13} weight="bold" color="ink2">{i + 1}</T>
                  </View>
                  <T size={15} style={{ flex: 1 }} numberOfLines={3}>{ch}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ───────── 결과 ─────────
  if (phase === "done") {
    const missed = log.filter((x) => !x.ok);
    return (
      <Screen scroll>
        <View style={{ alignItems: "center", gap: 6, paddingTop: 8 }}>
          <Icon name={displayedResult?.newBest ? "trophy" : "bolt"} size={72} />
          <T size={16} color="ink2">1분 동안</T>
          <T size={56} weight="bold" color="success" style={{ lineHeight: 64 }}>{correct}<T size={24} weight="bold" color="muted">개 정답</T></T>
          <T size={14} color="muted">{displayedResult?.total??log.length}문제 풂</T>
          {displayedResult?.newBest && <Badge label="최고 기록!" tone="accent" />}
          {displayedResult && (
            <Row gap={4}>
              <Icon name="star" size={20} />
              <T size={16} weight="bold" color={displayedResult.xp ? "accent" : "muted"}>
                {displayedResult.xp ? `+${displayedResult.xp} XP` : practice ? "연습 모드 · XP 미지급" : "이번 풀이에서 지급된 XP가 없어요"}
              </T>
            </Row>
          )}
          <T size={12} color="muted" center>사용자 경험치만 올라가요. 분야 랭크에는 들어가지 않아요.</T>
        </View>

        {missed.length > 0 && (
          <>
            <SectionTitle title={`틀린 문제 ${missed.length}개`} />
            {missed.slice(0, 10).map(({ item }, i) => (
              <Card key={i} style={{ gap: 6 }}>
                <T size={12} color="muted">{item.topic.categoryName} · {item.topic.ko}</T>
                <T size={15} weight="semibold">{item.q.q}</T>
                <T size={14} color="success" weight="semibold">정답: {answerText(item.q)}</T>
                <T size={14} color="ink2">{item.q.explain}</T>
              </Card>
            ))}
          </>
        )}

        {notice?<T color="accent">{notice}</T>:null}
        {!displayedResult?<Btn title="서버 결과 다시 확인" onPress={()=>setFinishRetry(n=>n+1)}/>:null}
        <Btn title="한 판 더" variant="accent" size="lg" onPress={()=>start(practice)} disabled={!displayedResult} />
        <Btn title="닫기" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  // ───────── 시작 화면 ─────────
  const xpLeft = store ? Math.max(0, SPEED_DAILY_XP_CAP - store.xpToday) : SPEED_DAILY_XP_CAP;
  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">스피드 퀴즈</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <T color="ink2">1분 동안 내가 공부한 주제의 4지선다 문제를 최대한 많이 맞혀 보세요.</T>

      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 22 }}>
        <Icon name="bolt" size={56} />
        <T size={14} color="muted">내 최고 기록</T>
        <T size={40} weight="bold">{store?.best ?? 0}<T size={18} weight="bold" color="ink2">개</T></T>
      </Card>

      {notice?<T color="accent">{notice}</T>:null}
      <T color="muted">회원 온라인 풀이는 서버에서 채점해요. 게스트·연습 모드는 XP를 지급하지 않아요.</T>
      <Card style={{ gap: 8 }}>
        <Row gap={8}><Icon name="star" size={20} /><T size={14}>정답 1개당 <T size={14} weight="bold">{SPEED_XP_PER_CORRECT} XP</T> · 오늘 남은 경험치 {xpLeft} XP</T></Row>
        <Row gap={8}><Icon name="book" size={20} /><T size={14}>출제 범위: 공부한 주제 {studied.length}개</T></Row>
        <T size={12} color="muted">분야 랭크와 공부 기록에는 들어가지 않아요.</T>
      </Card>

      <Btn title="연습 시작 (XP 없음)" onPress={()=>start(true)} disabled={!studied.length}/>
      <Btn
        title={studied.length ? "시작" : "먼저 주제를 하나 공부해 주세요"}
        variant="accent" size="lg" icon={studied.length ? <Icon name="play" size={22} color="#ffffff" /> : undefined}
        onPress={()=>start(false)} disabled={!studied.length}
      />
    </Screen>
  );
}
