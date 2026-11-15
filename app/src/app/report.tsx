import { router } from "expo-router";
import { Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { Row, Screen, T } from "@/components/ui";
import { WeeklyReport } from "@/components/WeeklyReport";
import { useColors } from "@/theme";

/** 학습 리포트 (공부 기록 화면 안에도 같은 내용이 들어감) */
export default function Report() {
  const c = useColors();
  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">학습 리포트</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <WeeklyReport />
    </Screen>
  );
}
