import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { radius, useColors } from "@/theme";
import { T, tap } from "./ui";

export type ReaderPage = { url: string; title: string };

const mmss = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * 공부 시간 동안 위키·공식 문서를 앱 안에서 보여 주는 창.
 * 앱 밖 브라우저는 앱이 닫을 수 없어서(안드로이드), 시간이 끝나면 이 창을 닫고 바로 퀴즈로 넘어간다.
 */
export function StudyReader({ page, left, total, running, onClose }: {
  page: ReaderPage | null; left: number; total: number; running: boolean; onClose: () => void;
}) {
  const c = useColors();
  const progress = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const urgent = left <= 60;
  return (
    <Modal visible={!!page} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Pressable onPress={() => { tap(); onClose(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="문서 닫기">
            <T size={15} weight="semibold" color="accent">✕ 닫기</T>
          </Pressable>
          <T size={15} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{page?.title}</T>
          <View style={{ backgroundColor: urgent ? c.accent : c.navy, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 }}>
            <T size={14} weight="bold" color={urgent ? "accentInk" : "navyInk"}>⏱ {mmss(left)}{running ? "" : " ⏸"}</T>
          </View>
        </View>
        <View style={{ height: 4, backgroundColor: c.chip }}>
          <View style={{ width: `${progress * 100}%`, height: "100%", backgroundColor: urgent ? c.accent : c.gold }} />
        </View>
        <T size={12} color="muted" center style={{ paddingVertical: 4 }}>공부 시간이 끝나면 이 창은 자동으로 닫혀요</T>
        {page && (
          <WebView
            source={{ uri: page.url }}
            style={{ flex: 1, backgroundColor: c.paper }}
            setSupportMultipleWindows={false}
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={c.navy} />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
