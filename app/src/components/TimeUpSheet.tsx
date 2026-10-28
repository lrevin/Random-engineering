import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, View } from "react-native";
import { inset, radius, shadow, useColors } from "@/theme";
import { Btn, Row, T } from "./ui";

/** 공부 시간 추가: 2분에 톱니바퀴 10개 */
export const EXTEND_SECONDS = 120;
export const EXTEND_COST = 10;

/** 톱니바퀴 개수 표시 */
export function GearCount({ n, size = 15 }: { n: number; size?: number }) {
  const c = useColors();
  return (
    <Row gap={4} style={{ flexWrap: "nowrap" }}>
      <Ionicons name="cog" size={size + 3} color={c.gold} />
      <T size={size} weight="bold">{n.toLocaleString()}</T>
    </Row>
  );
}

/**
 * 공부 시간이 끝나면 뜨는 창. 닫기 없이 둘 중 하나를 골라야 함:
 * 톱니바퀴로 2분 더 공부하기 / 퀴즈 풀러 가기
 */
export function TimeUpSheet({ visible, gears, onExtend, onQuiz }: {
  visible: boolean; gears: number; onExtend: () => void; onQuiz: () => void;
}) {
  const c = useColors();
  const enough = gears >= EXTEND_COST;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.55)", justifyContent: "center", padding: 24 }}>
        <View style={{
          backgroundColor: c.paper, borderRadius: radius.lg, padding: 22, gap: 14, maxWidth: 420, width: "100%", alignSelf: "center",
          borderTopWidth: 5, borderTopColor: c.gold, ...shadow(c, 3),
        }}>
          <View style={{ alignItems: "center", gap: 4 }}>
            <T size={40}>⏰</T>
            <T size={22} weight="bold" center>공부 시간이 끝났어요</T>
            <T size={15} color="ink2" center>조금 더 볼까요, 아니면 바로 퀴즈를 풀까요?</T>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, ...inset(c) }}>
            <T size={14} color="ink2">내 톱니바퀴</T>
            <GearCount n={gears} />
          </View>

          <View style={{ gap: 10 }}>
            <Btn
              title={`2분 추가 (톱니바퀴 ${EXTEND_COST}개)`}
              variant="accent"
              size="lg"
              icon={<Ionicons name="cog" size={20} color={c.accentInk} />}
              onPress={onExtend}
              disabled={!enough}
            />
            {!enough && <T size={13} color="accent" center>톱니바퀴가 {EXTEND_COST - gears}개 부족해요</T>}
            <Btn title="퀴즈 풀러 가기" variant="primary" size="lg" onPress={onQuiz} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
