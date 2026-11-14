import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { radius, shadow, useColors } from "@/theme";
import { Btn, T } from "./ui";
import { Icon, type IconName } from "./Icon";

export interface DialogButton {
  text: string;
  /** cancel: 닫기(테두리) · destructive: 위험한 동작(빨강) · default: 확인(남색) */
  style?: "cancel" | "destructive" | "default";
  onPress?: () => void;
}

export interface DialogOptions {
  title: string;
  message?: string;
  /** 위에 크게 보일 그림 */
  icon?: IconName;
  /** 없으면 "확인" 버튼 하나 */
  buttons?: DialogButton[];
}

let show: ((o: DialogOptions) => void) | null = null;

/**
 * 앱 기본 알림창(Alert) 대신 쓰는 뽑공 디자인 확인 창. 어디서든 부를 수 있음:
 * showDialog({ title: "그만둘까요?", buttons: [{ text: "계속하기", style: "cancel" }, { text: "그만두기", style: "destructive", onPress }] })
 */
export function showDialog(o: DialogOptions) {
  if (show) show(o);
}

/** 루트 레이아웃에 한 번만 둠 */
export function DialogHost() {
  const c = useColors();
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  useEffect(() => {
    show = setDialog;
    return () => { show = null; };
  }, []);

  if (!dialog) return null;
  const buttons = dialog.buttons?.length ? dialog.buttons : [{ text: "확인" }];
  const cancel = buttons.find((b) => b.style === "cancel");
  const destructive = buttons.some((b) => b.style === "destructive");
  const press = (b: DialogButton) => {
    setDialog(null);
    b.onPress?.();
  };
  // 바깥을 누르거나 뒤로 가기: 취소 버튼이 있으면 그것처럼, 없으면 닫기만
  const dismiss = () => (cancel ? press(cancel) : setDialog(null));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable onPress={dismiss} style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.55)", justifyContent: "center", padding: 24 }} accessibilityLabel="닫기">
        <Pressable onPress={() => {}} style={{
          backgroundColor: c.paper, borderRadius: radius.lg, padding: 22, gap: 16, maxWidth: 400, width: "100%", alignSelf: "center",
          borderTopWidth: 5, borderTopColor: destructive ? c.accent : c.gold, ...shadow(c, 3),
        }}>
          <View style={{ alignItems: "center", gap: 6 }}>
            {dialog.icon ? <Icon name={dialog.icon} size={56} style={{ marginBottom: 4 }} /> : null}
            <T size={20} weight="bold" center>{dialog.title}</T>
            {dialog.message ? <T size={15} color="ink2" center>{dialog.message}</T> : null}
          </View>
          <View style={{ flexDirection: buttons.length > 2 ? "column" : "row", gap: 10 }}>
            {buttons.map((b, i) => (
              <Btn
                key={i}
                title={b.text}
                variant={b.style === "destructive" ? "accent" : b.style === "cancel" ? "outline" : "primary"}
                onPress={() => press(b)}
                style={buttons.length > 2 ? undefined : { flex: 1 }}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
