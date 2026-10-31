import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as NotificationsModule from "expo-notifications";
import { Platform } from "react-native";
import { calcStreak, studiedToday } from "./stats";
import type { Prefs, StudyRecord } from "./types";

// 안드로이드용 Expo Go(SDK 53+)에는 알림 모듈이 빠져 있어서 불러오기만 해도 앱이 멈춥니다.
// 그래서 지원되는 환경에서만 불러옵니다. (실제 설치한 앱·개발 빌드에서는 정상 작동)
const inAndroidExpoGo = Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const notificationsSupported = Platform.OS !== "web" && !inAndroidExpoGo;
const enabled = notificationsSupported;

const Notifications: typeof NotificationsModule = enabled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("expo-notifications")
  : (null as never);

if (enabled) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelsReady = false;
async function ensureChannels() {
  if (!enabled || channelsReady || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("reminders", {
    name: "매일 공부 알림",
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync("timer", {
    name: "타이머 종료",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
  });
  channelsReady = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!enabled) return false;
  await ensureChannels();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

async function cancelKind(kind: "reminder" | "timer") {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.content.data?.kind === kind).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

const LATER_MESSAGES = [
  ["오늘의 주제가 기다리고 있어요 🎲", "15분 공부하고 퀴즈 7문제면 오늘 공부 끝!"],
  ["딱 17분이면 돼요 ⏱", "주제 하나 뽑아서 설명할 수 있게 만들어 볼까요?"],
  ["어제보다 하나 더 아는 사람 📚", "오늘의 랜덤 주제를 뽑아 보세요."],
  ["오늘의 퀴즈로 경험치 모으기 🏅", "오늘은 어떤 주제가 나올까요?"],
];

/**
 * 듀오링고식 매일 알림: 앞으로 7일 치를 날짜별로 예약합니다.
 * 오늘 이미 공부했으면 오늘 알림은 건너뛰고, 아니면 연속 기록을 지키라고 알려 줍니다.
 * 앱을 열거나 기록을 저장할 때마다 다시 예약합니다.
 */
export async function rescheduleReminders(prefs: Prefs, records: StudyRecord[]) {
  if (!enabled) return;
  await cancelKind("reminder");
  if (!prefs.reminderEnabled) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannels();

  const [hh, mm] = prefs.reminderTime.split(":").map(Number);
  const now = new Date();
  const doneToday = studiedToday(records, now);
  const { streak } = calcStreak(records, now);
  const name = prefs.nickname ? `${prefs.nickname}님, ` : "";

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    date.setHours(hh, mm, 0, 0);
    if (date <= now) continue;
    if (i === 0 && doneToday) continue;

    let title: string, body: string;
    if (i === 0 && streak > 0) {
      title = `🔥 ${streak}일 연속 기록이 오늘 끊겨요!`;
      body = `${name}주제 하나만 공부하면 ${streak + 1}일째가 돼요.`;
    } else if (i === 1 && doneToday && streak > 0) {
      title = `🔥 ${streak}일 연속 공부 중`;
      body = `${name}내일도 이어 가 볼까요? 오늘의 주제를 뽑아 보세요.`;
    } else {
      const [t, b] = LATER_MESSAGES[(date.getDate() + i) % LATER_MESSAGES.length];
      title = t;
      body = name + b;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { kind: "reminder" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: "reminders" },
    });
  }
}

/** 타이머가 끝나는 순간 알림 (앱이 백그라운드여도 울림) */
export async function scheduleTimerEnd(seconds: number, title: string, body: string) {
  if (!enabled) return;
  await cancelKind("timer");
  if (seconds < 1) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { kind: "timer" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: "timer" },
  });
}

export async function cancelTimerEnd() {
  if (!enabled) return;
  await cancelKind("timer");
}

export async function cancelAllNotifications() {
  if (!enabled) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
