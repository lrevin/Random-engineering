import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, View } from "react-native";
import { RESTORE_COST_PER_DAY } from "@/lib/economy";
import { useApp } from "@/lib/app-state";
import { inset, radius, shadow, useColors } from "@/theme";
import { GearCount } from "./TimeUpSheet";
import { Btn, T } from "./ui";

const md = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`;

/**
 * 앱을 열었을 때 연속 기록이 끊길 뻔했으면 뜨는 창.
 * 보호권을 자동으로 쓴 날을 알려 주고, 보호권이 모자라 빠진 날이 남았으면 톱니바퀴로 복구할지 묻습니다.
 */
export function StreakSheet() {
  const { rescue, restoreStreak, dismissRescue, gears } = useApp();
  const c = useColors();
  if (!rescue) return null;
  const cost = rescue.restore.length * RESTORE_COST_PER_DAY;
  const enough = gears >= cost;
  const saved = !rescue.restore.length;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissRescue} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.55)", justifyContent: "center", padding: 24 }}>
        <View style={{
          backgroundColor: c.paper, borderRadius: radius.lg, padding: 22, gap: 14, maxWidth: 420, width: "100%", alignSelf: "center",
          borderTopWidth: 5, borderTopColor: saved ? c.gold : c.flame, ...shadow(c, 3),
        }}>
          <View style={{ alignItems: "center", gap: 4 }}>
            <T size={40}>{saved ? "🛡️" : "🔥"}</T>
            <T size={21} weight="bold" center>
              {saved ? `보호권으로 ${rescue.streak}일 연속 기록을 지켰어요` : `${rescue.streak}일 연속 기록이 끊기기 직전이에요`}
            </T>
            {rescue.auto.length > 0 && (
              <T size={14} color="ink2" center>
                공부하지 않은 {rescue.auto.map(md).join(", ")}에 보호권 {rescue.auto.length}개를 자동으로 썼어요.
              </T>
            )}
            {!saved && (
              <T size={14} color="ink2" center>
                보호권이 없어서 {rescue.restore.map(md).join(", ")}이(가) 비어 있어요.{"\n"}
                톱니바퀴로 복구하면 연속 기록이 그대로 이어져요.
              </T>
            )}
          </View>

          {!saved && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, ...inset(c) }}>
              <T size={14} color="ink2">내 톱니바퀴</T>
              <GearCount n={gears} />
            </View>
          )}

          <View style={{ gap: 10 }}>
            {!saved && (
              <>
                <Btn
                  title={`${rescue.restore.length}일 복구하기 (톱니바퀴 ${cost}개)`}
                  variant="accent"
                  size="lg"
                  icon={<Ionicons name="cog" size={20} color={c.accentInk} />}
                  onPress={restoreStreak}
                  disabled={!enough}
                />
                {!enough && <T size={13} color="accent" center>톱니바퀴가 {cost - gears}개 부족해요</T>}
              </>
            )}
            <Btn title={saved ? "확인" : "괜찮아요, 처음부터 다시 할게요"} variant={saved ? "primary" : "outline"} size="lg" onPress={dismissRescue} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
