// =============================================================================
// app/game/damma-lobby.tsx — Local 4-player lobby (Phase 2)
// =============================================================================
// Pre-game lobby screen with 4 slots. The host (slot 1) is the current user.
// Slots 2–4 can be filled with: Bot, Invited Friend (mock placeholder for now),
// or Public Player (mock placeholder for now). All slots show a "Ready" state.
// When all 4 slots are READY → host can press "Start Match" and we navigate
// to the Damma game in 4-player mode.
//
// NOTE: This is the LOCAL lobby (no backend). The actual online matchmaking
// will be wired in Phase 3 (WebSocket). For now, "Invite Friend" and
// "Find Public Player" instantly fill the slot with a randomised bot
// labelled appropriately so the host can see the UI flow.
// =============================================================================
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Modal, ActivityIndicator, Animated, Easing, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/context/LanguageContext";
import { getAvatarUrl } from "@/src/constants/avatars";
import { getDammaClient } from "@/src/games/damma/online";

const GOLD = "#D4AF37";
const GOLD_SOFT = "#B8860B";

type SlotKind = "host" | "empty" | "friend" | "public" | "bot";
interface Slot {
  kind: SlotKind;
  name: string;
  avatar: string;          // avatar id or "BOT"
  ready: boolean;
}

type FillMode = "friends" | "public" | "mixed" | "bots";

const MODE_OPTIONS: { id: FillMode; label: string; icon: string; hint: string }[] = [
  { id: "friends", label: "أصدقاء فقط",    icon: "people",          hint: "ادع 3 أصدقاء فقط" },
  { id: "public",  label: "عام فقط",        icon: "globe-outline",   hint: "ابحث عن 3 لاعبين عشوائيين" },
  { id: "mixed",   label: "مختلط",          icon: "shuffle",         hint: "أصدقاء + لاعبون عامون" },
  { id: "bots",    label: "بوتات",          icon: "hardware-chip",   hint: "املأ المقاعد ببوتات (تشغيل فوري)" },
];

const BOT_NAMES = ["Bot Alpha", "Bot Bravo", "Bot Charlie", "Bot Delta", "Bot Echo"];
const FRIEND_NAMES = ["Ahmed", "Mohamed", "Khalid", "Saif", "Yousef", "Omar"];
const PUBLIC_NAMES = ["Player_42", "GamerX", "DominoKing", "TileMaster", "Hexar99"];

export default function DammaLobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useT();
  const [fillMode, setFillMode] = useState<FillMode>("bots");

  // ── Phase 4: Online matchmaking state ─────────────────────────────────────
  const [searching, setSearching]   = useState(false);   // queue request in flight
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [queueSize, setQueueSize]   = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [matchedRid, setMatchedRid] = useState<string | null>(null);
  const searchCancelRef = useRef<boolean>(false);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Spinner / pulse animations for the modal
  const spinAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Slot 0 is always the host (current user)
  const [slots, setSlots] = useState<Slot[]>(() => [
    {
      kind: "host",
      name: user?.nickname || user?.username || (t("you") || "أنت"),
      avatar: user?.avatar || "avatar_ninja",
      ready: true,
    },
    { kind: "empty", name: "", avatar: "", ready: false },
    { kind: "empty", name: "", avatar: "", ready: false },
    { kind: "empty", name: "", avatar: "", ready: false },
  ]);

  // Fill slot with a chosen kind. The naming pool depends on the kind.
  const fillSlot = useCallback((idx: number, kind: SlotKind) => {
    if (idx === 0 || kind === "host") return;
    setSlots((prev) => {
      const next = [...prev];
      const used = next.map((s) => s.name);
      let name = "";
      let avatar = "";
      const pickUnique = (pool: string[]) =>
        pool.filter((n) => !used.includes(n))[Math.floor(Math.random() * (pool.length))] || pool[0];
      if (kind === "friend") {
        name = pickUnique(FRIEND_NAMES);
        avatar = ["avatar_ninja", "avatar_pirate", "avatar_robot", "avatar_alien"][Math.floor(Math.random() * 4)];
      } else if (kind === "public") {
        name = pickUnique(PUBLIC_NAMES);
        avatar = "avatar_robot";
      } else { // bot
        name = pickUnique(BOT_NAMES);
        avatar = "BOT";
      }
      next[idx] = { kind, name, avatar, ready: kind === "bot" /* bots are insta-ready */ };
      return next;
    });
  }, []);

  // Remove a slot back to empty
  const clearSlot = (idx: number) => {
    if (idx === 0) return;
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { kind: "empty", name: "", avatar: "", ready: false };
      return next;
    });
  };

  // Toggle ready (for friend / public stand-in slots only — bot is always ready)
  const toggleReady = (idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx].kind === "empty" || next[idx].kind === "host") return next;
      next[idx] = { ...next[idx], ready: !next[idx].ready };
      return next;
    });
  };

  // Auto-fill all empty slots according to fillMode
  const autoFill = () => {
    setSlots((prev) => prev.map((s, i) => {
      if (s.kind !== "empty") return s;
      const kind: SlotKind =
        fillMode === "bots"    ? "bot"
        : fillMode === "public" ? "public"
        : fillMode === "friends" ? "friend"
        : ((i % 2 === 0) ? "friend" : "public"); // mixed → alternate
      const pool = kind === "friend" ? FRIEND_NAMES
                  : kind === "public" ? PUBLIC_NAMES
                  : BOT_NAMES;
      const used = prev.map((p) => p.name);
      const name = pool.filter((n) => !used.includes(n))[0] || pool[0];
      return {
        kind,
        name,
        avatar: kind === "friend" ? "avatar_ninja" : kind === "public" ? "avatar_robot" : "BOT",
        ready: kind === "bot",
      };
    }));
  };

  const allFilled = slots.every((s) => s.kind !== "empty");
  const allReady = slots.every((s) => s.ready);

  // ── Phase 4: Spin + pulse animations for searching modal ──────────────────
  useEffect(() => {
    if (!searching && !matchedRid) return;
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    spinLoop.start();
    pulseLoop.start();
    return () => { spinLoop.stop(); pulseLoop.stop(); spinAnim.setValue(0); pulseAnim.setValue(1); };
  }, [searching, matchedRid]);

  // ── Phase 4: Find Match via backend matchmaking queue ─────────────────────
  const findMatchOnline = useCallback(async () => {
    if (!user) {
      Alert.alert("تسجيل الدخول مطلوب", "يجب تسجيل الدخول للعب أونلاين.");
      return;
    }
    const client = getDammaClient();
    const uid     = user.id;
    const uname   = user.nickname || user.username || "Player";
    const uavatar = user.avatar || "avatar_ninja";

    // Reset state
    searchCancelRef.current = false;
    setSearching(true);
    setMatchedRid(null);
    setQueuePosition(0);
    setQueueSize(0);
    setElapsedSec(0);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);

    try {
      // Join the queue
      const j = await client.queueJoin({
        user_id: uid, name: uname, avatar: uavatar, num_players: 4,
      });
      setQueuePosition(j.position);
      setQueueSize(j.queue_size);

      // Poll until matched or cancelled
      const rid = await client.waitForMatch(
        uid,
        ({ position, queue_size }) => {
          setQueuePosition(position);
          setQueueSize(queue_size);
          if (searchCancelRef.current) return false;
        },
        1800,
      );

      if (searchCancelRef.current) return;
      setMatchedRid(rid);
    } catch (e: any) {
      if (e?.message !== "cancelled") {
        Alert.alert("تعذر العثور على مباراة", String(e?.message || e));
      }
    } finally {
      if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      setSearching(false);
    }
  }, [user]);

  const cancelMatchmaking = useCallback(async () => {
    searchCancelRef.current = true;
    setSearching(false);
    setMatchedRid(null);
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    if (user) {
      try { await getDammaClient().queueLeave(user.id, user.nickname || user.username || ""); } catch {}
    }
  }, [user]);

  const enterMatchedRoom = useCallback(() => {
    if (!matchedRid) return;
    // Phase 5 will hook this room into damma-online gameplay. For now we
    // forward the room id as a query param so damma.tsx can read it later.
    router.replace({ pathname: "/game/damma", params: { rid: matchedRid, online: "1" } });
  }, [matchedRid, router]);

  // Cleanup on unmount: leave queue if still searching
  useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (searching && user) {
        try { getDammaClient().queueLeave(user.id, user.nickname || user.username || ""); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMatch = () => {
    // For Phase 2 we only need to land on the damma screen in 4-player mode.
    // Phase 3 will pass the lobby roster to a real online match.
    router.replace("/game/damma");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#0A1A14", "#070C0A"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>🎯 Lobby دومينو رباعي</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Mode selector */}
        <Text style={styles.sectionLabel}>نمط ملء المقاعد</Text>
        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((m) => {
            const sel = fillMode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setFillMode(m.id)}
                style={[styles.modeChip, sel && styles.modeChipActive]}
                activeOpacity={0.85}
              >
                <Ionicons name={m.icon as any} size={16} color={sel ? GOLD : FUTURISTIC.textMuted} />
                <Text style={[styles.modeChipText, sel && { color: GOLD }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.modeHint}>
          {MODE_OPTIONS.find((m) => m.id === fillMode)?.hint}
        </Text>

        {/* 4 slots */}
        <Text style={styles.sectionLabel}>اللاعبون (4/{slots.filter((s) => s.kind !== "empty").length})</Text>
        <View style={styles.slotsGrid}>
          {slots.map((slot, i) => (
            <View key={i} style={[styles.slotCard, slot.kind !== "empty" && styles.slotCardFilled]}>
              {/* Slot number badge */}
              <View style={styles.slotNumBadge}>
                <Text style={styles.slotNumText}>P{i + 1}</Text>
              </View>

              {/* Ready badge */}
              {slot.kind !== "empty" && slot.kind !== "host" && (
                <TouchableOpacity onPress={() => toggleReady(i)} style={styles.readyToggle}>
                  <Ionicons
                    name={slot.ready ? "checkmark-circle" : "time-outline"}
                    size={20}
                    color={slot.ready ? "#4ADE80" : "#F59E0B"}
                  />
                </TouchableOpacity>
              )}
              {slot.kind === "host" && (
                <View style={styles.hostBadge}>
                  <Ionicons name="star" size={14} color={GOLD} />
                </View>
              )}

              {/* Avatar */}
              <View style={styles.slotAvatarWrap}>
                {slot.kind === "empty" ? (
                  <View style={styles.emptyAvatar}>
                    <Ionicons name="add" size={36} color={withAlphaLocal(GOLD, 0.5)} />
                  </View>
                ) : slot.avatar === "BOT" ? (
                  <View style={[styles.slotAvatar, styles.botAvatarBg]}>
                    <Ionicons name="hardware-chip" size={36} color={GOLD} />
                  </View>
                ) : (
                  <Image source={{ uri: getAvatarUrl(slot.avatar) }} style={styles.slotAvatar} />
                )}
              </View>

              {/* Name + kind */}
              {slot.kind !== "empty" ? (
                <>
                  <Text style={styles.slotName} numberOfLines={1}>{slot.name}</Text>
                  <Text style={[styles.slotKind, { color: kindColor(slot.kind) }]}>
                    {kindLabel(slot.kind)}
                  </Text>
                  {slot.kind !== "host" && (
                    <TouchableOpacity onPress={() => clearSlot(i)} style={styles.removeBtn}>
                      <Ionicons name="close" size={14} color="#EF4444" />
                      <Text style={styles.removeText}>إزالة</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => fillSlot(i, "friend")} style={[styles.actionPill, { borderColor: "#60A5FA" }]}>
                    <Ionicons name="person-add" size={12} color="#60A5FA" />
                    <Text style={[styles.actionPillText, { color: "#60A5FA" }]}>دعوة صديق</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => fillSlot(i, "public")} style={[styles.actionPill, { borderColor: "#A78BFA" }]}>
                    <Ionicons name="globe-outline" size={12} color="#A78BFA" />
                    <Text style={[styles.actionPillText, { color: "#A78BFA" }]}>لاعب عام</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => fillSlot(i, "bot")} style={[styles.actionPill, { borderColor: GOLD }]}>
                    <Ionicons name="hardware-chip" size={12} color={GOLD} />
                    <Text style={[styles.actionPillText, { color: GOLD }]}>بوت</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Auto-fill */}
        <TouchableOpacity onPress={autoFill} style={styles.autoFillBtn} activeOpacity={0.85}>
          <Ionicons name="sparkles" size={16} color={GOLD} />
          <Text style={styles.autoFillText}>ملء المقاعد تلقائيًا بنمط: {MODE_OPTIONS.find((m) => m.id === fillMode)?.label}</Text>
        </TouchableOpacity>

        {/* Phase 4: Find online match via backend matchmaking queue */}
        <TouchableOpacity
          onPress={findMatchOnline}
          style={styles.findMatchBtn}
          activeOpacity={0.9}
          disabled={searching}
        >
          <LinearGradient
            colors={["#7C3AED", "#4F46E5"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.findMatchGrad}
          >
            <Ionicons name="globe-outline" size={18} color="#FFF" />
            <Text style={styles.findMatchText}>
              {searching ? "جاري البحث..." : "🌐 ابحث عن مباراة أونلاين (4 لاعبين)"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.findMatchHint}>
          ينضم إلى طابور المباريات العامة على السيرفر — تبدأ المباراة فور انضمام 4 لاعبين.
        </Text>
      </ScrollView>

      {/* ── Searching / Matched modal overlay ─────────────────────────────── */}
      <Modal
        visible={searching || !!matchedRid}
        transparent
        animationType="fade"
        onRequestClose={cancelMatchmaking}
      >
        <View style={styles.modalBackdrop}>
          <LinearGradient
            colors={["#0F1F18", "#070C0A"]}
            style={styles.modalCard}
          >
            {!matchedRid ? (
              <>
                {/* Animated pulsing/spinning ring */}
                <Animated.View
                  style={[
                    styles.spinnerRing,
                    {
                      transform: [
                        { scale: pulseAnim },
                        { rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[GOLD, "transparent", GOLD_SOFT, "transparent"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.spinnerRingInner}
                  />
                </Animated.View>
                <View style={styles.spinnerCenter}>
                  <Ionicons name="search" size={34} color={GOLD} />
                </View>

                <Text style={styles.modalTitle}>🔍 البحث عن مباراة...</Text>
                <Text style={styles.modalSubtitle}>
                  جاري البحث عن 3 لاعبين آخرين للانضمام إليك
                </Text>

                <View style={styles.statRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>#{queuePosition || "–"}</Text>
                    <Text style={styles.statLabel}>موقعك</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{queueSize}</Text>
                    <Text style={styles.statLabel}>في الطابور</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{formatMmSs(elapsedSec)}</Text>
                    <Text style={styles.statLabel}>المدة</Text>
                  </View>
                </View>

                <ActivityIndicator color={GOLD} style={{ marginTop: 12 }} />

                <TouchableOpacity onPress={cancelMatchmaking} style={styles.modalCancelBtn} activeOpacity={0.85}>
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                  <Text style={styles.modalCancelText}>إلغاء البحث</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Match Found state */}
                <Animated.View style={[styles.successBadge, { transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name="checkmark-circle" size={64} color="#4ADE80" />
                </Animated.View>
                <Text style={styles.matchedTitle}>✅ تم العثور على مباراة!</Text>
                <Text style={styles.matchedSubtitle}>
                  4 لاعبين جاهزون. اضغط للدخول إلى الطاولة.
                </Text>
                <Text style={styles.ridText}>غرفة: {matchedRid.slice(0, 8)}…</Text>

                <TouchableOpacity onPress={enterMatchedRoom} style={styles.enterBtn} activeOpacity={0.9}>
                  <LinearGradient
                    colors={[GOLD, GOLD_SOFT]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.enterBtnGrad}
                  >
                    <Ionicons name="play" size={20} color="#000" />
                    <Text style={styles.enterBtnText}>ادخل المباراة</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={cancelMatchmaking} style={styles.modalCancelBtn} activeOpacity={0.85}>
                  <Text style={styles.modalCancelText}>إلغاء</Text>
                </TouchableOpacity>
              </>
            )}
          </LinearGradient>
        </View>
      </Modal>

      {/* Footer bar */}
      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Ionicons name="close-circle" size={18} color="#EF4444" />
          <Text style={styles.cancelText}>إلغاء</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!allFilled || !allReady}
          onPress={startMatch}
          style={[
            styles.startBtn,
            (!allFilled || !allReady) && styles.startBtnDisabled,
          ]}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={(!allFilled || !allReady) ? ["#555", "#333"] : [GOLD, GOLD_SOFT]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.startBtnGrad}
          >
            <Ionicons name="play" size={20} color="#000" />
            <Text style={styles.startBtnText}>
              {!allFilled ? "املأ كل المقاعد" : !allReady ? "بانتظار الجاهزية" : "ابدأ المباراة"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function kindLabel(k: SlotKind): string {
  switch (k) {
    case "host":   return "المضيف";
    case "friend": return "صديق";
    case "public": return "لاعب عام";
    case "bot":    return "بوت";
    default:       return "";
  }
}
function kindColor(k: SlotKind): string {
  switch (k) {
    case "host":   return GOLD;
    case "friend": return "#60A5FA";
    case "public": return "#A78BFA";
    case "bot":    return "#4ADE80";
    default:       return "#888";
  }
}
function withAlphaLocal(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return hex.length === 7 ? `${hex}${a}` : hex;
}
function formatMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.textPrimary, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },

  sectionLabel: {
    color: GOLD, fontSize: 12, fontWeight: "800",
    paddingHorizontal: 16, marginTop: 14, marginBottom: 8,
    letterSpacing: 0.6,
  },

  modeRow: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, paddingHorizontal: 16,
  },
  modeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  modeChipActive: {
    backgroundColor: withAlphaLocal(GOLD, 0.10),
    borderColor: GOLD,
  },
  modeChipText: { color: FUTURISTIC.textMuted, fontSize: 12, fontWeight: "700" },
  modeHint: {
    color: FUTURISTIC.textMuted, fontSize: 11,
    paddingHorizontal: 16, marginTop: 6,
    fontStyle: "italic",
  },

  slotsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 10, paddingHorizontal: 12,
  },
  slotCard: {
    width: "47%", aspectRatio: 0.82,
    backgroundColor: FUTURISTIC.surface1,
    borderRadius: 16, padding: 10,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    alignItems: "center", justifyContent: "flex-start",
    gap: 6,
    position: "relative",
  },
  slotCardFilled: {
    borderColor: withAlphaLocal(GOLD, 0.55),
    shadowColor: GOLD, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  slotNumBadge: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: withAlphaLocal(GOLD, 0.18),
    borderWidth: 1, borderColor: withAlphaLocal(GOLD, 0.45),
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  slotNumText: { color: GOLD, fontSize: 10, fontWeight: "900" },
  readyToggle: {
    position: "absolute", top: 6, right: 6, padding: 2,
  },
  hostBadge: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: withAlphaLocal(GOLD, 0.18),
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: withAlphaLocal(GOLD, 0.55),
  },

  slotAvatarWrap: { marginTop: 18 },
  slotAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: FUTURISTIC.surface2 },
  botAvatarBg: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: GOLD },
  emptyAvatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderStyle: "dashed",
    borderColor: withAlphaLocal(GOLD, 0.4),
    alignItems: "center", justifyContent: "center",
  },

  slotName: { color: FUTURISTIC.textPrimary, fontSize: 13, fontWeight: "800", marginTop: 4 },
  slotKind: { fontSize: 10, fontWeight: "700", marginTop: 1 },

  actionPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  actionPillText: { fontSize: 10, fontWeight: "800" },

  removeBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)",
    marginTop: 4,
  },
  removeText: { color: "#EF4444", fontSize: 10, fontWeight: "700" },

  autoFillBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginHorizontal: 16, marginTop: 14,
    paddingVertical: 11, borderRadius: 12,
    backgroundColor: withAlphaLocal(GOLD, 0.10),
    borderWidth: 1, borderColor: withAlphaLocal(GOLD, 0.45),
  },
  autoFillText: { color: GOLD, fontSize: 12, fontWeight: "800" },

  // ── Phase 4: Find Match button + searching modal styles ───────────────────
  findMatchBtn: {
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 14, overflow: "hidden",
    shadowColor: "#7C3AED", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  findMatchGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14,
  },
  findMatchText: { color: "#FFF", fontSize: 14, fontWeight: "900", letterSpacing: 0.3 },
  findMatchHint: {
    color: FUTURISTIC.textMuted, fontSize: 11,
    paddingHorizontal: 24, marginTop: 6, marginBottom: 6,
    fontStyle: "italic", textAlign: "center",
  },

  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%", maxWidth: 380,
    borderRadius: 22, padding: 24,
    alignItems: "center",
    borderWidth: 1, borderColor: withAlphaLocal(GOLD, 0.4),
    shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  spinnerRing: {
    width: 130, height: 130, borderRadius: 65,
    alignItems: "center", justifyContent: "center",
    marginBottom: -100, // overlap with center icon
  },
  spinnerRingInner: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 3, borderColor: "transparent",
  },
  spinnerCenter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: withAlphaLocal(GOLD, 0.10),
    borderWidth: 1.5, borderColor: withAlphaLocal(GOLD, 0.5),
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "900",
    marginTop: 8, letterSpacing: 0.3,
  },
  modalSubtitle: {
    color: FUTURISTIC.textMuted, fontSize: 12,
    marginTop: 6, textAlign: "center", lineHeight: 18,
  },
  statRow: {
    flexDirection: "row", gap: 10,
    marginTop: 18, width: "100%",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1, paddingVertical: 12,
    backgroundColor: withAlphaLocal(GOLD, 0.08),
    borderRadius: 12,
    borderWidth: 1, borderColor: withAlphaLocal(GOLD, 0.30),
    alignItems: "center",
  },
  statValue: { color: GOLD, fontSize: 18, fontWeight: "900" },
  statLabel: { color: FUTURISTIC.textMuted, fontSize: 10, fontWeight: "700", marginTop: 3 },

  modalCancelBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.4)",
    marginTop: 18,
  },
  modalCancelText: { color: "#EF4444", fontSize: 12, fontWeight: "800" },

  // Matched-found state
  successBadge: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(74,222,128,0.10)",
    borderWidth: 2, borderColor: "rgba(74,222,128,0.45)",
    marginBottom: 16,
  },
  matchedTitle: {
    color: "#4ADE80", fontSize: 20, fontWeight: "900", letterSpacing: 0.3,
  },
  matchedSubtitle: {
    color: FUTURISTIC.textMuted, fontSize: 12,
    marginTop: 6, textAlign: "center", lineHeight: 18,
  },
  ridText: {
    color: FUTURISTIC.textMuted, fontSize: 11,
    fontFamily: "monospace", marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  enterBtn: {
    width: "100%", borderRadius: 12, overflow: "hidden", marginTop: 18,
  },
  enterBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14,
  },
  enterBtnText: { color: "#000", fontSize: 14, fontWeight: "900" },

  footer: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: FUTURISTIC.borderSoft,
    backgroundColor: FUTURISTIC.surface1,
  },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.4)",
  },
  cancelText: { color: "#EF4444", fontSize: 13, fontWeight: "800" },
  startBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  startBtnDisabled: { opacity: 0.6 },
  startBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14,
  },
  startBtnText: { color: "#000", fontSize: 14, fontWeight: "900" },
});
