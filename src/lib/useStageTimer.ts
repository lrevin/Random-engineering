import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useApp } from "./app-state";
import { cancelTimerEnd, requestNotificationPermission, scheduleTimerEnd } from "./notify";
import { useCountdown } from "./useCountdown";

const MESSAGES = {
  study: { title: "⏰ 공부 시간 끝!", body: "이제 메모를 덮고 2분 동안 설명해 보세요." },
  explain: { title: "🗣 설명 시간 끝!", body: "오늘 설명은 몇 점이었나요? 기록을 남겨 주세요." },
};

/**
 * 공부/설명 단계 타이머.
 * 진행 상태를 저장해 두어서 앱을 껐다 켜도 이어지고, 끝나는 시각에 알림이 울립니다.
 */
export function useStageTimer(stage: "study" | "explain", onEnd: () => void) {
  const { active, setActive } = useApp();
  const totalKey = stage === "study" ? "studyTotal" : "explainTotal";
  const leftKey = stage === "study" ? "studyLeft" : "explainLeft";

  const total = active?.[totalKey] ?? 0;
  // 화면에 들어온 순간의 상태 (한 번만 계산)
  const [initialLeft] = useState(() =>
    active?.endAt ? Math.max(0, (active.endAt - Date.now()) / 1000) : (active?.[leftKey] ?? 0),
  );
  const [wasRunning] = useState(() => !!active?.endAt);

  const ended = useRef(false);
  const handleEnd = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setActive((a) => (a ? { ...a, endAt: null, [leftKey]: 0 } : a));
    onEnd();
  }, [leftKey, onEnd, setActive]);

  const cd = useCountdown(initialLeft, handleEnd);

  const start = useCallback(async () => {
    if (cd.running || cd.left <= 0) return;
    cd.start();
    const left = cd.read();
    setActive((a) => (a ? { ...a, endAt: Date.now() + left * 1000 } : a));
    if (await requestNotificationPermission()) {
      scheduleTimerEnd(left, MESSAGES[stage].title, MESSAGES[stage].body).catch(() => {});
    }
  }, [cd, setActive, stage]);

  const pause = useCallback(() => {
    if (!cd.running) return;
    const left = cd.read();
    cd.pause();
    setActive((a) => (a ? { ...a, endAt: null, [leftKey]: left } : a));
    cancelTimerEnd().catch(() => {});
  }, [cd, leftKey, setActive]);

  /** 다음 단계로 넘어갈 때: 쓴 시간을 돌려주고 타이머 정리 */
  const stop = useCallback(() => {
    const left = cd.read();
    if (cd.running) cd.pause();
    cancelTimerEnd().catch(() => {});
    return { left, used: Math.round(total - left) };
  }, [cd, total]);

  // 첫 화면 진입: 저장된 상태에 따라 이어서 실행하거나, 이미 끝났으면 바로 다음 단계로
  useEffect(() => {
    if (wasRunning && initialLeft <= 0) handleEnd();
    else if (wasRunning) {
      cd.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    left: cd.left, total, running: cd.running, start, pause,
    toggle: cd.running ? pause : start, stop,
    fresh: !wasRunning && initialLeft >= total - 0.5,
  };
}
