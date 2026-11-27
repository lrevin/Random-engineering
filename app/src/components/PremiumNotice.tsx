import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable } from "react-native";
import { radius, shadow, useColors } from "@/theme";
import { T } from "./ui";
import { Icon } from "./Icon";

let show: (() => void) | null = null;

/** 무료 회원이 프리미엄 전용 기능을 눌렀을 때 화면 한가운데에 잠깐 띄우는 안내 */
export function showPremiumOnly() {
  if (show) show();
}

const VISIBLE_MS = 1600;

/** 루트 레이아웃에 한 번만 둠 (DialogHost 옆) */
export function PremiumNoticeHost() {
  const c = useColors();
  const [on, setOn] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hide = () => {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => { if (finished) setOn(false); });
    };
    show = () => {
      if (timer.current) clearTimeout(timer.current);
      setOn(true);
      fade.stopAnimation();
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, VISIBLE_MS);
    };
    return () => { show = null; if (timer.current) clearTimeout(timer.current); };
  }, [fade]);

  if (!on) return null;
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => setOn(false));
  };
  return (
    // 다른 모달(로드맵 등) 위에서도 보이도록 Modal로 띄움
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
    <Pressable onPress={close} style={{ flex: 1, alignItems: "center", justifyContent: "center" }} accessibilityRole="alert" accessibilityLabel="프리미엄 전용 기능이에요">
      <Animated.View style={{
        opacity: fade,
        transform: [{ scale }],
        alignItems: "center", gap: 10, paddingVertical: 22, paddingHorizontal: 28, borderRadius: radius.lg,
        backgroundColor: c.paper, borderWidth: 2, borderColor: c.gold, ...shadow(c, 3),
      }}>
        <Icon name="crown" size={44} />
        <T size={17} weight="bold" center>프리미엄 전용 기능이에요</T>
      </Animated.View>
    </Pressable>
    </Modal>
  );
}
