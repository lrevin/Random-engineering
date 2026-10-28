import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { FONT } from "@/components/ui";
import { useColors } from "@/theme";

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.paper, borderTopWidth: 0, boxShadow: `0px -3px 12px ${c.shadow}` },
        tabBarLabelStyle: { fontFamily: FONT.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "공부", tabBarIcon: ({ color, size }) => <Ionicons name="dice-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: "기록", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "설정", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
