import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "@/components/ui";
import { useColors } from "@/theme";

export default function TabLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.paper, borderTopWidth: 0, elevation: 0, height: 64 + bottomPadding, paddingTop: 6, paddingBottom: bottomPadding },
        tabBarLabelStyle: { fontFamily: FONT.medium, fontSize: 12, lineHeight: 20, includeFontPadding: false },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "공부", tabBarIcon: ({ color, size }) => <Ionicons name="dice-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="friends" options={{ title: "친구", tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="arena" options={{ title: "콘텐츠", tabBarIcon: ({ color, size }) => <Ionicons name="game-controller-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="shop" options={{ title: "상점", tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "설정", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
