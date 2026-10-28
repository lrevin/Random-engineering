import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * 끝나는 시각을 기준으로 계산하는 카운트다운.
 * 앱이 백그라운드에 있다 돌아와도 남은 시간이 정확합니다.
 */
export function useCountdown(initialLeft: number, onEnd: () => void) {
  const [left, setLeft] = useState(initialLeft);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const leftRef = useRef(initialLeft);
  const onEndRef = useRef(onEnd);
  useLayoutEffect(() => {
    onEndRef.current = onEnd;
  });

  const read = useCallback(() => (running ? Math.max(0, (endAt.current - Date.now()) / 1000) : leftRef.current), [running]);

  /** from을 주면 그 초부터 시작 (reset 직후 같은 틱에서 쓰려고) */
  const start = useCallback((from?: number) => {
    if (from !== undefined) leftRef.current = from;
    if (running || leftRef.current <= 0) return;
    endAt.current = Date.now() + leftRef.current * 1000;
    setRunning(true);
  }, [running]);

  const pause = useCallback(() => {
    if (!running) return;
    leftRef.current = Math.max(0, (endAt.current - Date.now()) / 1000);
    setLeft(leftRef.current);
    setRunning(false);
  }, [running]);

  const reset = useCallback((sec: number) => {
    leftRef.current = sec;
    setLeft(sec);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const l = Math.max(0, (endAt.current - Date.now()) / 1000);
      leftRef.current = l;
      setLeft(l);
      if (l <= 0) {
        setRunning(false);
        onEndRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  return { left, running, start, pause, toggle: running ? pause : start, reset, read };
}
