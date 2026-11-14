import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { FREE_MAX_STUDY_MIN } from "@/lib/economy";
import { LOCAL_KEYS } from "@/lib/local-data";
import { RECALL_DAYS } from "@/lib/recall";
import { radius, shadow, useColors } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Btn, T, tap } from "./ui";

const SEEN_KEY = LOCAL_KEYS.homeIntroSeen.key;

const PAGES: { icon: IconName; title: string; body: string }[] = [
  { icon: "slot", title: "레버를 당겨 주제 뽑기", body: "관심 분야와 준비 중인 자격증 안에서 랜덤 주제 하나가 뽑혀요. 마음에 안 들면 다시 뽑아도 돼요." },
  { icon: "book", title: `${FREE_MAX_STUDY_MIN}분 공부`, body: "AI 없이 위키백과·나무위키로 공부해요. 시간이 끝나면 바로 퀴즈로 넘어가요." },
  { icon: "star", title: "퀴즈로 레벨 · 분야 랭크", body: "퀴즈 7문제를 맞힌 만큼 경험치가 쌓여 레벨이 오르고, 분야마다 브론즈부터 엔지니어까지 랭크가 올라가요." },
  { icon: "chest", title: "퀘스트 · 오늘의 주제 · 복습", body: `홈 위 세 칸에서 퀘스트 보상, 오늘의 주제(+톱니바퀴), ${RECALL_DAYS}일 지난 주제 복습을 챙겨요.` },
  { icon: "gear", title: "톱니바퀴로 꾸미고 도전", body: "모은 톱니바퀴로 상점에서 보호권 · 스킨 · 부스터를 사고, 콘텐츠 탭에서 배틀과 스피드 퀴즈를 즐겨요." },
];

/** 처음 설정을 마치고 홈에 처음 왔을 때 한 번 보여 주는 사용법. open을 주면 다시 보여 줌 (설정의 "사용법 다시 보기") */
export function HomeIntro({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const p = PAGES[page];
  const close = () => {
    AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
    setPage(0);
    onClose();
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(10,14,26,0.6)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: c.paper, borderRadius: radius.lg, padding: 24, gap: 16, maxWidth: 420, width: "100%", alignSelf: "center", borderTopWidth: 5, borderTopColor: c.gold, ...shadow(c, 3) }}>
          <T size={13} weight="semibold" color="muted" center>뽑공 사용법 {page + 1} / {PAGES.length}</T>
          <View style={{ alignItems: "center", gap: 10, minHeight: 220 }}>
            <Icon name={p.icon} size={84} />
            <T size={22} weight="bold" center>{p.title}</T>
            <T size={15} color="ink2" center>{p.body}</T>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            {PAGES.map((_, i) => (
              <Pressable key={i} onPress={() => { tap(); setPage(i); }} hitSlop={6} accessibilityLabel={`${i + 1}번째 설명`}>
                <View style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? c.gold : c.line2 }} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {page > 0 ? <Btn title="이전" onPress={() => setPage(page - 1)} style={{ flex: 1 }} /> : <Btn title="건너뛰기" variant="ghost" onPress={close} style={{ flex: 1 }} />}
            <Btn title={last ? "시작하기" : "다음"} variant={last ? "accent" : "primary"} onPress={() => (last ? close() : setPage(page + 1))} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** 홈 사용법을 아직 안 봤으면 true */
export function useHomeIntroFirstTime() {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((v) => setFirst(v !== "1")).catch(() => {});
  }, []);
  return [first, () => setFirst(false)] as const;
}
