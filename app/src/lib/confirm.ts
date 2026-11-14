import { showDialog } from "@/components/Dialog";
import { cancelTimerEnd } from "./notify";

/** 진행 중인 주제 그만두기 확인 */
export function confirmQuit(onQuit: () => void) {
  showDialog({
    icon: "door",
    title: "그만둘까요?",
    message: "이번 주제의 진행 상황은 기록되지 않아요.",
    buttons: [
      { text: "계속하기", style: "cancel" },
      { text: "그만두기", style: "destructive", onPress: () => { cancelTimerEnd().catch(() => {}); onQuit(); } },
    ],
  });
}
