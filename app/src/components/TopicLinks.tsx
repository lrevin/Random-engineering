import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";
import { topicLinks, type Topic } from "@/data";
import { radius, useColors } from "@/theme";
import { Row, T, tap } from "./ui";

const open = (url: string) => {
  tap();
  // createTask: false → 안드로이드에서 브라우저를 닫으면 앱으로 바로 돌아오게 함
  WebBrowser.openBrowserAsync(url, { createTask: false }).catch(() => {});
};

function LinkButton({ icon, title, sub, onPress, primary }: { icon: string; title: string; sub: string; onPress: () => void; primary?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minWidth: 140, flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
        borderRadius: radius.md, borderWidth: 1,
        borderColor: primary ? c.navy : c.line2, backgroundColor: c.paper, opacity: pressed ? 0.7 : 1,
      })}
    >
      <T size={22}>{icon}</T>
      <View style={{ flex: 1 }}>
        <T size={14} weight="semibold" numberOfLines={1}>{title} ↗</T>
        <T size={12} color="muted" numberOfLines={1}>{sub}</T>
      </View>
    </Pressable>
  );
}

/** 주제 공부 자료: 한국어 위키백과 문서 + 공식 문서 (있으면) + 기타 */
export function TopicLinks({ topic, compact }: { topic: Topic; compact?: boolean }) {
  const l = topicLinks(topic);
  return (
    <View style={{ gap: 8, alignSelf: "stretch" }}>
      <Row gap={8} style={{ alignItems: "stretch" }}>
        {l.koWiki ? (
          <LinkButton primary icon="📖" title="한국어 위키백과" sub={l.koWiki.title} onPress={() => open(l.koWiki!.url)} />
        ) : (
          <LinkButton primary icon="📖" title="영어 위키피디아" sub={`${l.enWiki.title} (한국어 문서 없음)`} onPress={() => open(l.enWiki.url)} />
        )}
        {l.official && <LinkButton icon="📄" title="공식 문서" sub={l.official.label} onPress={() => open(l.official!.url)} />}
      </Row>
      {!compact && (
        <Row gap={14} style={{ justifyContent: "center" }}>
          {l.koWiki && (
            <Pressable onPress={() => open(l.enWiki.url)} hitSlop={6}>
              <T size={13} color="muted" style={{ textDecorationLine: "underline" }}>영어 위키피디아</T>
            </Pressable>
          )}
          <Pressable onPress={() => open(l.namu)} hitSlop={6}>
            <T size={13} color="muted" style={{ textDecorationLine: "underline" }}>나무위키 검색</T>
          </Pressable>
        </Row>
      )}
    </View>
  );
}
