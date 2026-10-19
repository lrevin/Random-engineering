import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";

/**
 * 타이머 화면에서 화면이 꺼지지 않게 합니다.
 * 켜기가 끝난 뒤에만 끄도록 순서를 맞춰서, 화면을 빨리 벗어나도 오류가 나지 않습니다.
 */
export function useKeepScreenOn(tag: string) {
  useEffect(() => {
    const activated = activateKeepAwakeAsync(tag).then(() => true, () => false);
    return () => {
      activated.then((ok) => {
        if (!ok) return;
        try {
          Promise.resolve(deactivateKeepAwake(tag)).catch(() => {});
        } catch {
          // 이미 해제된 경우 무시
        }
      });
    };
  }, [tag]);
}
