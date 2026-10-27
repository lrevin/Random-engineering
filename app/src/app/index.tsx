import { Redirect } from "expo-router";
import { useApp } from "@/lib/app-state";

/** 상태에 맞는 첫 화면으로 보냅니다. */
export default function Index() {
  const { mode, onboarded, active } = useApp();
  if (mode === "none") return <Redirect href="/welcome" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  if (active) return <Redirect href={`/${active.stage}`} />; // 하던 공부 이어서
  return <Redirect href="/home" />;
}
