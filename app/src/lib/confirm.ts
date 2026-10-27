import { Alert, Platform } from "react-native";
import { cancelTimerEnd } from "./notify";

/** 진행 중인 주제 그만두기 확인 */
export function confirmQuit(onQuit: () => void) {
  const run = () => {
    cancelTimerEnd().catch(() => {});
    onQuit();
  };
  if (Platform.OS === "web") {
    if (globalThis.confirm?.("이번 주제를 그만둘까요? 메모와 진행 상황은 기록되지 않아요.")) run();
    return;
  }
  Alert.alert("그만둘까요?", "이번 주제의 메모와 진행 상황은 기록되지 않아요.", [
    { text: "계속하기", style: "cancel" },
    { text: "그만두기", style: "destructive", onPress: run },
  ]);
}
