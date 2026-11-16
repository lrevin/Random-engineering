import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Avatar, AVATARS, BACKDROPS, ProfileBackdrop } from "@/components/ProfileLook";
import { GearCount } from "@/components/TimeUpSheet";
import { Btn, Field, Row, Screen, T, tap } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { authErrorMessage } from "@/lib/auth";
import {
  addOwnedLook, isPaidLook, LOOK_PRICES, NICK_MAX, NICK_MIN, NICKNAME_CHANGE_COST, nicknameChangeCost, nicknameLengthOk, noteNicknameChanged,
  setProfileLook, useProfileLook, type AvatarId, type BackdropId,
} from "@/lib/profile-look";
import { radius, shadow, useColors } from "@/theme";

/** n개씩 한 줄로 묶음 (모자라면 빈칸으로 채워 칸 너비를 맞춤) */
function rows<X>(xs: X[], n: number): (X | null)[][] {
  const out: (X | null)[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(Array.from({ length: n }, (_, k) => xs[i + k] ?? null));
  return out;
}

/** 가격표: 톱니바퀴 + 숫자 (그림 위에 얹음) */
function PriceTag({ price }: { price: number }) {
  return (
    <View style={{ position: "absolute", top: 6, right: 6, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: radius.pill, backgroundColor: "rgba(14,20,36,0.72)" }}>
      <Icon name="gear" size={13} />
      <T size={11} weight="bold" style={{ color: "#fffaf0" }}>{price.toLocaleString()}</T>
    </View>
  );
}

/**
 * 프로필 수정: 닉네임 · 캐릭터 · 배경을 고르고 위에서 바로 미리 봄. 저장을 눌러야 바뀜.
 * 유료 그림도 눌러서 미리 입어 볼 수 있고, 사야 저장할 수 있음.
 */
export default function ProfileEdit() {
  const { prefs, updatePrefs, mode, gears, spendGears, purchaseItem, refreshWallet, walletNotice } = useApp();
  const c = useColors();
  const look = useProfileLook();
  const [nick, setNick] = useState(prefs.nickname);
  const [avatar, setAvatar] = useState<AvatarId>(look.avatar);
  const [backdrop, setBackdrop] = useState<BackdropId>(look.backdrop);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const name = nick.trim() || prefs.nickname || "나";
  useEffect(() => { if (mode === "user") void refreshWallet().catch(() => {}); }, [mode, refreshWallet]);

  const owns = (id: string) => !isPaidLook(id) || look.all.includes(id);
  /** 지금 고른 것 중 아직 안 산 유료 그림 */
  const unpaid = [avatar, backdrop].filter((id) => !owns(id));
  const nameOf = (id: string) => AVATARS.find((a) => a.id === id)?.name ?? BACKDROPS.find((b) => b.id === id)?.name ?? "";

  const buy = async (id: string) => {
    if (!isPaidLook(id) || owns(id) || busy) return;
    setBusy(true);
    try {
      if (mode === "user") { if (!await purchaseItem("skin:" + id)) return; }
      else { if (!await spendGears(LOOK_PRICES[id])) return; addOwnedLook(id); }
      setMsg(`${nameOf(id)}을(를) 샀어요! 저장하면 프로필에 적용돼요.`);
    } finally {
      setBusy(false);
    }
  };

  const nickChanged = nick.trim() !== prefs.nickname;
  /** 이번 저장으로 닉네임이 바뀌면 드는 톱니바퀴 (첫 변경은 무료) */
  const nickCost = nickChanged ? nicknameChangeCost(look.nickChanges) : 0;

  const save = async () => {
    const n = nick.trim();
    if (nickChanged && !nicknameLengthOk(n)) return setMsg(`닉네임은 ${NICK_MIN}~${NICK_MAX}자로 정해 주세요.`);
    if (unpaid.length) return setMsg("아직 사지 않은 그림이 있어요. 사거나 다른 걸 골라 주세요.");
    if (nickCost && gears < nickCost) return setMsg(`닉네임을 바꾸려면 톱니바퀴 ${nickCost}개가 필요해요.`);
    setBusy(true);
    try {
      if (nickChanged) {
        // 둘러보기: 이 휴대폰에서 먼저 톱니바퀴를 씀 · 회원: 서버가 저장하면서 차감하므로 저장 뒤 지갑을 다시 읽음
        if (mode !== "user" && nickCost && !await spendGears(nickCost)) return setMsg("톱니바퀴가 부족해요.");
        await updatePrefs({ nickname: n });
        noteNicknameChanged();
        if (mode === "user") void refreshWallet().catch(() => {});
      }
      setProfileLook({ avatar, backdrop });
      router.back();
    } catch (e) {
      setMsg(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const avatarCell = (a: (typeof AVATARS)[number] | null, key: string) => {
    if (!a) return <View key={key} style={{ flex: 1 }} />;
    const on = a.id === avatar;
    const paid = isPaidLook(a.id);
    const has = owns(a.id);
    return (
      <Pressable key={a.id} onPress={() => { tap(); setAvatar(a.id); setMsg(""); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
        accessibilityLabel={paid && !has ? `${a.name}, 톱니바퀴 ${a.price}개` : a.name}
        style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 2,
          borderColor: on ? c.accent : paid ? c.gold : c.line, backgroundColor: on ? c.accentSoft : c.paper }}>
        <Avatar id={a.id} name={name} size={68} />
        <T size={13} weight={on ? "bold" : "medium"} color={on ? "accent" : "ink2"} numberOfLines={1}>{a.name}</T>
        {paid && (has ? (
          <T size={11} weight="bold" color="success">보유 중</T>
        ) : a.price ? (
          <Row gap={3} style={{ flexWrap: "nowrap" }}><Icon name="gear" size={13} /><T size={12} weight="bold" color="ink2">{a.price.toLocaleString()}</T></Row>
        ) : null)}
      </Pressable>
    );
  };

  const backdropCell = (b: (typeof BACKDROPS)[number] | null, key: string) => {
    if (!b) return <View key={key} style={{ flex: 1 }} />;
    const on = b.id === backdrop;
    const paid = isPaidLook(b.id);
    const has = owns(b.id);
    return (
      <Pressable key={b.id} onPress={() => { tap(); setBackdrop(b.id); setMsg(""); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
        accessibilityLabel={paid && !has ? `${b.name}, 톱니바퀴 ${b.price}개` : b.name}
        style={{ flex: 1, borderRadius: radius.md, borderWidth: 2, borderColor: on ? c.accent : paid ? c.gold : c.line, backgroundColor: c.paper, overflow: "hidden" }}>
        <View style={{ height: 70 }}>
          <ProfileBackdrop id={b.id} />
          {paid && !has && b.price ? <PriceTag price={b.price} /> : null}
        </View>
        <Row style={{ justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8, flexWrap: "nowrap" }}>
          <T size={13} weight={on ? "bold" : "medium"} color={on ? "accent" : "ink2"} numberOfLines={1}>{b.name}</T>
          {on ? <Icon name="check" size={16} color={c.accent} /> : paid && has ? <Icon name="check" size={16} color={c.success} /> : null}
        </Row>
      </Pressable>
    );
  };

  const freeAvatars = AVATARS.filter((a) => !isPaidLook(a.id));
  const paidAvatars = AVATARS.filter((a) => isPaidLook(a.id));
  const freeBackdrops = BACKDROPS.filter((b) => !isPaidLook(b.id));
  const paidBackdrops = BACKDROPS.filter((b) => isPaidLook(b.id));

  return (
    <Screen scroll>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <Row gap={12} style={{ flexWrap: "nowrap" }}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
            <Icon name="close" size={24} color={c.muted} />
          </Pressable>
          <T size={24} weight="bold">프로필 수정</T>
        </Row>
        <GearCount n={gears} size={16} />
      </Row>

      {/* 미리 보기 */}
      <View style={{ borderRadius: radius.lg, overflow: "hidden", borderWidth: 2, borderColor: c.line, backgroundColor: c.paper, ...shadow(c, 2) }}>
        <View style={{ height: 130 }}>
          <ProfileBackdrop id={backdrop} />
        </View>
        <View style={{ alignItems: "center", marginTop: -52, paddingBottom: 16, gap: 6 }}>
          <View style={{ borderRadius: 60, borderWidth: 5, borderColor: c.paper, boxShadow: "0px 4px 0px rgba(0,0,0,0.18)" }}>
            <Avatar id={avatar} name={name} size={100} />
          </View>
          <T size={22} weight="bold" numberOfLines={1}>{name}</T>
        </View>
      </View>

      {/* 입어 보는 중인 유료 그림: 바로 살 수 있게 */}
      {unpaid.map((id) => {
        const price = isPaidLook(id) ? LOOK_PRICES[id] : 0;
        const short = gears < price;
        return (
          <View key={id} style={{ gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: 2, borderColor: c.gold, backgroundColor: c.goldSoft }}>
            <T size={14} weight="semibold">{nameOf(id)} 입어 보는 중이에요</T>
            <Btn title={`톱니바퀴 ${price.toLocaleString()}개로 사기`} variant="accent" icon={<Icon name="gear" size={22} />}
              disabled={busy || short} onPress={() => { void buy(id); }} />
            {short && <T size={13} color="accent" center>톱니바퀴가 {(price - gears).toLocaleString()}개 부족해요</T>}
          </View>
        );
      })}
      {(walletNotice || msg) ? <T size={14} color={msg.includes("샀어요") ? "success" : "accent"} weight="semibold" center>{walletNotice || msg}</T> : null}

      <View style={{ gap: 6 }}>
        <Field label="닉네임" value={nick} onChangeText={(t) => { setNick(t); setMsg(""); }} maxLength={Math.max(NICK_MAX, Array.from(prefs.nickname).length)}
          placeholder={`닉네임 (${NICK_MIN}~${NICK_MAX}자)`} returnKeyType="done" />
        <Row gap={4} style={{ flexWrap: "nowrap" }}>
          {look.nickChanges > 0 && <Icon name="gear" size={14} />}
          <T size={12} color={nickChanged && nickCost ? "accent" : "muted"} style={{ flexShrink: 1 }}>
            {look.nickChanges > 0
              ? `닉네임 변경은 톱니바퀴 ${NICKNAME_CHANGE_COST}개가 들어요 · ${NICK_MIN}~${NICK_MAX}자`
              : `첫 닉네임 변경은 무료, 그다음부터 톱니바퀴 ${NICKNAME_CHANGE_COST}개 · ${NICK_MIN}~${NICK_MAX}자`}
          </T>
        </Row>
      </View>

      <T size={17} weight="bold">캐릭터</T>
      <View style={{ gap: 10 }}>
        {rows(freeAvatars, 3).map((row, r) => <View key={r} style={{ flexDirection: "row", gap: 10 }}>{row.map((a, i) => avatarCell(a, `fa${r}-${i}`))}</View>)}
      </View>
      <Row gap={6}><Icon name="gear" size={18} /><T size={15} weight="bold" color="ink2">톱니바퀴 캐릭터</T></Row>
      <View style={{ gap: 10 }}>
        {rows(paidAvatars, 3).map((row, r) => <View key={r} style={{ flexDirection: "row", gap: 10 }}>{row.map((a, i) => avatarCell(a, `pa${r}-${i}`))}</View>)}
      </View>

      <T size={17} weight="bold">배경</T>
      <View style={{ gap: 10 }}>
        {rows(freeBackdrops, 2).map((row, r) => <View key={r} style={{ flexDirection: "row", gap: 10 }}>{row.map((b, i) => backdropCell(b, `fb${r}-${i}`))}</View>)}
      </View>
      <Row gap={6}><Icon name="gear" size={18} /><T size={15} weight="bold" color="ink2">톱니바퀴 배경</T></Row>
      <View style={{ gap: 10 }}>
        {rows(paidBackdrops, 2).map((row, r) => <View key={r} style={{ flexDirection: "row", gap: 10 }}>{row.map((b, i) => backdropCell(b, `pb${r}-${i}`))}</View>)}
      </View>

      <Btn title={busy ? "저장 중…" : unpaid.length ? "사야 저장할 수 있어요" : nickCost ? `저장 · 닉네임 변경 톱니바퀴 ${nickCost}개` : "저장"} variant="accent" size="lg" disabled={busy || unpaid.length > 0} onPress={() => { void save(); }} />
    </Screen>
  );
}
