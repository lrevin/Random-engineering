import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { GearCount } from "@/components/TimeUpSheet";
import { Row, Screen, T } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { PAID_AVATARS, PAID_BACKDROPS, useProfileLook } from "@/lib/profile-look";
import { Avatar } from "@/components/ProfileLook";
import { TITLES, titleById, useCosmetics, useThemes } from "@/lib/skins";
import { inset, radius, raised, shadow, useColors } from "@/theme";

/** 꾸미기 상점: 앱 전체 색을 바꾸는 테마 · 프로필에 다는 칭호 */
export default function Cosmetics() {
  const { gears, prefs } = useApp();
  const look = useProfileLook();
  const c = useColors();
  const themes = useThemes();
  const cos = useCosmetics();
  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <T size={26} weight="bold">꾸미기 상점</T>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Icon name="close" size={24} color={c.muted} />
        </Pressable>
      </Row>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.chip, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, ...inset(c) }}>
        <T size={15} color="ink2">내 톱니바퀴</T>
        <GearCount n={gears} size={18} />
      </View>
      <Pressable
        onPress={() => router.push("/skins")}
        accessibilityRole="button"
        accessibilityLabel="테마 보러 가기"
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 2,
          borderColor: c.line, backgroundColor: c.paper, ...raised(c.paperEdge, pressed, 5), ...(!pressed ? shadow(c, 2) : null),
        })}
      >
        {/* 지금 테마의 그라데이션 견본 (클래식은 단색) */}
        <View style={{ width: 58, height: 58, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: c.line2, flexDirection: "row" }}>
          {[{ backgroundColor: c.bg, ...(c.grad.bg ? { experimental_backgroundImage: c.grad.bg } : null) },
            { backgroundColor: c.slot, ...(c.grad.hero ? { experimental_backgroundImage: c.grad.hero } : null) },
            { backgroundColor: c.accent, ...(c.grad.accent ? { experimental_backgroundImage: c.grad.accent } : null) }].map((st, i) => <View key={i} style={{ flex: 1, ...st }} />)}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={19} weight="bold">테마</T>
          <T size={13} color="ink2">지금 {themes.active.name}</T>
          <T size={12} color="muted">앱 전체 색을 바꾸는 테마 4종</T>
        </View>
        <T size={22} color="muted">›</T>
      </Pressable>
      <Pressable
        onPress={() => router.push("/profile-edit")}
        accessibilityRole="button"
        accessibilityLabel="프로필 꾸미기"
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 2,
          borderColor: c.line, backgroundColor: c.paper, ...raised(c.paperEdge, pressed, 5), ...(!pressed ? shadow(c, 2) : null),
        })}
      >
        <View style={{ width: 58, height: 58, borderRadius: 29, overflow: "hidden" }}>
          <Avatar id={look.avatar} name={prefs.nickname || "나"} size={58} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={19} weight="bold">프로필 꾸미기</T>
          <T size={13} color="ink2">캐릭터 · 배경 (무료 + 톱니바퀴 한정판)</T>
          <T size={12} color="muted">톱니바퀴 캐릭터 {PAID_AVATARS.length}종 · 배경 {PAID_BACKDROPS.length}종</T>
        </View>
        <T size={22} color="muted">›</T>
      </Pressable>
      <Pressable
        onPress={() => router.push("/titles")}
        accessibilityRole="button"
        accessibilityLabel="칭호 보러 가기"
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 2,
          borderColor: c.line, backgroundColor: c.paper, ...raised(c.paperEdge, pressed, 5), ...(!pressed ? shadow(c, 2) : null),
        })}
      >
        <View style={{ width: 58, height: 58, borderRadius: radius.md, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>
          <Icon name="medal" size={40} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={19} weight="bold">칭호</T>
          <T size={13} color="ink2">{titleById(cos.title) ? `지금 "${titleById(cos.title)?.name}"` : "아직 단 칭호가 없어요"}</T>
          <T size={12} color="muted">연속 기록 · 업적 보상 {TITLES.length}종 · 받은 칭호 {cos.titles.length}개</T>
        </View>
        <T size={22} color="muted">›</T>
      </Pressable>

    </Screen>
  );
}
