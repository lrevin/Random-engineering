import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Prefs } from "@/lib/types";
import { radius, raised, shadow, useColors } from "@/theme";
import { LevelPicker } from "./LevelPicker";
import { T, tap } from "./ui";

const LABEL: Record<Prefs["level"], string> = { 0: "전체", 1: "Lv.1 기초", 2: "Lv.2 중급", 3: "Lv.3 심화" };

/** "현재 난이도 : Lv.2 중급" 버튼. 누르면 아래에서 난이도(1~3) 고르는 창이 올라옴 */
export function LevelButton({ value, onChange, interests }: {
  value: Prefs["level"]; onChange: (v: Prefs["level"]) => void; interests: string[];
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`현재 난이도 ${LABEL[value]}, 바꾸기`}
        onPress={() => { tap(); setOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 14,
          borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.navy, backgroundColor: c.paper,
          ...raised(c.navy, pressed, 3), ...(!pressed ? shadow(c, 1) : null),
        })}
      >
        <T size={14} color="ink2">현재 난이도 :</T>
        <T size={15} weight="bold">{LABEL[value]}</T>
        <Ionicons name="chevron-down" size={16} color={c.ink} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.45)" }} onPress={() => setOpen(false)} accessibilityLabel="닫기" />
        <SafeAreaView edges={["bottom"]} style={{
          backgroundColor: c.bg, borderTopLeftRadius: radius.lg + 6, borderTopRightRadius: radius.lg + 6,
          paddingHorizontal: 20, paddingTop: 10, gap: 14, ...shadow(c, 3),
        }}>
          <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: c.line2 }} />
          <View style={{ gap: 2 }}>
            <T size={20} weight="bold">난이도를 골라 주세요</T>
            <T size={14} color="muted">고른 난이도의 주제만 뽑혀요. 설정에도 함께 저장돼요.</T>
          </View>
          <LevelPicker
            value={value}
            interests={interests}
            onlyLevels
            onChange={(v) => { onChange(v); setOpen(false); }}
          />
          <View style={{ height: 12 }} />
        </SafeAreaView>
      </Modal>
    </>
  );
}
