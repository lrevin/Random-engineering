import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { AD_DAILY_LIMIT, AD_REWARD, adsSimulated, showRewardedAd } from "@/lib/ads";
import { useApp } from "@/lib/app-state";
import { radius, raised, shadow, useColors } from "@/theme";
import { Icon } from "./Icon";
import { T, tap } from "./ui";

const SIM_SEC = 5;

/** Expo Go처럼 광고 SDK가 없을 때 대신 보여 주는 시험용 광고 화면 */
function SimulatedAd({ onDone }: { onDone: (earned: boolean) => void }) {
  const [left, setLeft] = useState(SIM_SEC);
  useEffect(() => {
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => onDone(false)}>
      <View style={{ flex: 1, backgroundColor: "#0f1630", alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
        <View style={{ position: "absolute", top: 54, right: 24 }}>
          {left > 0 ? (
            <T size={14} weight="bold" style={{ color: "#9aa3c0" }}>{left}초 뒤 보상</T>
          ) : (
            <Pressable onPress={() => onDone(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="광고 닫고 보상 받기">
              <Icon name="close" size={26} color="#fffaf0" />
            </Pressable>
          )}
        </View>
        <Icon name="slot" size={96} />
        <T size={22} weight="bold" center style={{ color: "#fffaf0" }}>시험용 광고</T>
        <T size={14} center style={{ color: "#9aa3c0" }}>
          Expo Go에는 구글 광고가 들어갈 수 없어서 이 화면이 대신 나와요.{"\n"}앱으로 설치하면 실제 구글 광고가 나와요.
        </T>
      </View>
    </Modal>
  );
}

/** "광고 보고 톱니바퀴 AD_REWARD개 받기" 버튼 (하루 AD_DAILY_LIMIT번) */
export function AdRewardButton() {
  const c = useColors();
  const { adViewsToday, grantAdReward } = useApp();
  const [loading, setLoading] = useState(false);
  const [sim, setSim] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const left = Math.max(0, AD_DAILY_LIMIT - adViewsToday);
  const disabled = loading || left === 0;

  const done = (earned: boolean) => {
    if (earned && grantAdReward()) setMsg({ text: `톱니바퀴 ${AD_REWARD}개를 받았어요!`, ok: true });
    else if (!earned) setMsg({ text: "광고를 끝까지 봐야 톱니바퀴를 받아요.", ok: false });
  };

  const press = async () => {
    if (disabled) return;
    tap();
    setMsg(null);
    if (adsSimulated) return setSim(true);
    setLoading(true);
    const r = await showRewardedAd();
    setLoading(false);
    if (r === "failed") setMsg({ text: "지금은 광고를 불러올 수 없어요. 잠시 뒤 다시 해 주세요.", ok: false });
    else done(r === "earned");
  };

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={press}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`광고 보고 톱니바퀴 ${AD_REWARD}개 받기, 오늘 ${left}번 남음`}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16,
          borderRadius: radius.lg, borderWidth: 2, borderColor: c.success, backgroundColor: c.successSoft,
          opacity: left === 0 ? 0.5 : 1, ...raised(c.successDeep, pressed && !disabled), ...(!pressed ? shadow(c, 1) : null),
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.success, alignItems: "center", justifyContent: "center" }}>
          <Icon name="play" size={22} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <T size={16} weight="bold">광고 보고 톱니바퀴 {AD_REWARD}개 받기</T>
          <T size={12} color="muted">{left ? `오늘 ${left}번 더 볼 수 있어요` : "오늘은 다 받았어요. 내일 다시 볼 수 있어요"}</T>
        </View>
        {loading ? <ActivityIndicator color={c.success} /> : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Icon name="gear" size={22} />
            <T size={15} weight="bold" color="success">+{AD_REWARD}</T>
          </View>
        )}
      </Pressable>
      {msg ? <T size={13} center color={msg.ok ? "success" : "accent"}>{msg.text}</T> : null}
      {sim && <SimulatedAd onDone={(e) => { setSim(false); done(e); }} />}
    </View>
  );
}
