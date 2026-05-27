// /app/frontend/app/dms/[friendId].tsx — 1-on-1 DM chat (futuristic redesign)
//
// Visual highlights:
//   - Chrome back arrow + avatar with iridescent ring + kicker subtitle.
//   - Subtitle line shows typing / online · shared time with animated dot.
//   - Ambient LightBeams in background (subtle).
//   - My bubbles: neon-green gradient with chrome edge + brand glow shadow,
//     bottom-right curl. Others: glass surface with iridescent border, bottom-left curl.
//   - Image bubbles: rounded with chrome ring.
//   - Read receipts: animated checkmarks (single → double on read).
//   - Composer: brand-glow circular send button, chrome attach button,
//     glass input field with brand focus state.
//   - Empty state: neon icon ring + "Say hi" prompt.
//   - Edit bar: brand-soft pill with pencil icon.
//
// Animations are GPU-accelerated (Reanimated) — three subtle dots for "typing",
// a pulse on the brand-glow send button.

import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { getAvatarUrl } from "@/src/constants/avatars";
import { apiGet, apiPost, apiPatch, apiDelete, API_BASE, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/context/AuthContext";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import { useT } from "@/src/context/LanguageContext";

interface DM {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  image?: string | null;
  edited: boolean;
  deleted: boolean;
  created_at: string;
  read_at?: string | null;
}

interface Friend { id: string; nickname: string; avatar: string; avatar_image?: string }

function formatSharedTime(s: number): string {
  if (!s || s < 60) return "<1m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

// -----------------------------------------------------------------------------
// PulseSendButton — circular send button with persistent soft brand glow halo.
// -----------------------------------------------------------------------------
function PulseSendButton({
  disabled,
  onPress,
  icon = "send",
}: {
  disabled: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (disabled) return;
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [v, disabled]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + v.value * 0.45,
    transform: [{ scale: 1 + v.value * 0.10 }],
  }));
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{ width: 46, height: 46 }}
    >
      {!disabled && <Animated.View pointerEvents="none" style={[styles.sendHalo, haloStyle]} />}
      <LinearGradient
        colors={["rgba(255,255,255,0.55)", "rgba(34,255,136,0.55)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 23, padding: 1, opacity: disabled ? 0.5 : 1 }}
      >
        <LinearGradient
          colors={["#26FF93", "#10C66D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sendInner}
        >
          <Ionicons name={icon} size={20} color="#001A0C" />
        </LinearGradient>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// TypingDots — three brand-green dots that fade in/out staggered.
// -----------------------------------------------------------------------------
function TypingDots() {
  return (
    <View style={styles.typingDots}>
      <Dot delay={0} />
      <Dot delay={160} />
      <Dot delay={320} />
    </View>
  );
}
function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 480, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 480, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [v, delay]);
  const s = useAnimatedStyle(() => ({
    opacity: 0.3 + v.value * 0.7,
    transform: [{ scale: 0.85 + v.value * 0.3 }],
  }));
  return <Animated.View style={[styles.typingDot, s]} />;
}

// -----------------------------------------------------------------------------
// MessageBubble — futuristic chat bubble. Mine = neon-green gradient with
// chrome edge + brand-glow shadow. Others = surface with iridescent border.
// -----------------------------------------------------------------------------
function MessageBubble({
  item,
  mine,
  onLongPress,
}: {
  item: DM;
  mine: boolean;
  onLongPress: () => void;
}) {
  const time = new Date(item.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const mineFg = "#001A0C";
  if (item.deleted) {
    return (
      <View style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
        <View style={styles.deletedBubble}>
          <Ionicons name="trash-outline" size={12} color={FUTURISTIC.textMuted} />
          <Text style={styles.deletedText}>message deleted</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
      <TouchableOpacity activeOpacity={0.9} onLongPress={onLongPress} style={{ maxWidth: "78%" }}>
        {mine ? (
          // ---- MY bubble: gradient brand + chrome edge ----
          <LinearGradient
            colors={["rgba(255,255,255,0.55)", "rgba(34,255,136,0.55)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubEdgeMine]}
          >
            <LinearGradient
              colors={["#26FF93", "#10C66D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.bubInner}
            >
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.bubImage} />
              )}
              {!!item.text && (
                <Text style={[styles.bubText, { color: mineFg }]}>{item.text}</Text>
              )}
              <View style={styles.metaRow}>
                {item.edited && (
                  <Text style={[styles.meta, { color: "rgba(0,26,12,0.65)" }]}>
                    edited
                  </Text>
                )}
                <Text style={[styles.meta, { color: "rgba(0,26,12,0.75)" }]}>{time}</Text>
                <Ionicons
                  name={item.read_at ? "checkmark-done" : "checkmark"}
                  size={14}
                  color={item.read_at ? mineFg : "rgba(0,26,12,0.6)"}
                />
              </View>
            </LinearGradient>
          </LinearGradient>
        ) : (
          // ---- Other bubble: glass surface with iridescent border ----
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.20)",
              "rgba(168,85,247,0.20)",
              "rgba(255,255,255,0.05)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubEdgeOther}
          >
            <View style={styles.bubInnerOther}>
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.bubImage} />
              )}
              {!!item.text && (
                <Text style={[styles.bubText, { color: FUTURISTIC.textPrimary }]}>
                  {item.text}
                </Text>
              )}
              <View style={styles.metaRow}>
                {item.edited && (
                  <Text style={[styles.meta, { color: FUTURISTIC.textMuted }]}>
                    edited
                  </Text>
                )}
                <Text style={[styles.meta, { color: FUTURISTIC.textMuted }]}>{time}</Text>
              </View>
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Main screen
// =============================================================================
export default function DMChatScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();

  const [messages, setMessages] = useState<DM[]>([]);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [sharedSeconds, setSharedSeconds] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);
  const otherTypingTimer = useRef<any>(null);

  const myId = user?.id || "";

  // --------------------- Load history + connect WS ---------------------
  useEffect(() => {
    if (!friendId) return;
    (async () => {
      try {
        const [history, friends, shared] = await Promise.all([
          apiGet<{ messages: DM[] }>(`/dms/${friendId}`),
          apiGet<{ friends: Friend[] }>("/friends"),
          apiGet<{ seconds: number; hidden: boolean }>(
            `/users/${friendId}/shared_time`
          ).catch(() => ({ seconds: 0, hidden: true })),
        ]);
        setMessages(history.messages);
        const f = (friends.friends || []).find((x: any) => x.id === friendId);
        if (f) setFriend(f);
        if (shared && !shared.hidden) setSharedSeconds(shared.seconds || 0);
        apiPost(`/dms/${friendId}/read`).catch(() => {});
      } catch {} finally {
        setLoading(false);
      }
    })();

    (async () => {
      const token = (await storage.secureGet(TOKEN_KEY, "")) as string;
      const wsBase = API_BASE.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsBase}/ws/dms?token=${encodeURIComponent(token)}`);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (
            data.type === "dm_new" &&
            (data.message.from_id === friendId || data.message.to_id === friendId)
          ) {
            setMessages((m) => [...m, data.message]);
            if (data.message.from_id === friendId) {
              apiPost(`/dms/${friendId}/read`).catch(() => {});
            }
          } else if (data.type === "dm_edit") {
            setMessages((m) =>
              m.map((x) => (x.id === data.message.id ? data.message : x))
            );
          } else if (data.type === "dm_delete") {
            setMessages((m) =>
              m.map((x) => (x.id === data.message.id ? data.message : x))
            );
          } else if (data.type === "dm_typing" && data.from === friendId) {
            setOtherTyping(true);
            if (otherTypingTimer.current) clearTimeout(otherTypingTimer.current);
            otherTypingTimer.current = setTimeout(() => setOtherTyping(false), 3000);
          } else if (data.type === "dm_read" && data.by === friendId) {
            setMessages((m) =>
              m.map((x) =>
                x.to_id === friendId && !x.read_at ? { ...x, read_at: data.read_at } : x
              )
            );
          } else if (data.type === "presence" && data.user_id === friendId) {
            setOtherOnline(!!data.online);
          }
        } catch {}
      };
      wsRef.current = ws;
    })();

    return () => {
      try { wsRef.current?.close(); } catch {}
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (otherTypingTimer.current) clearTimeout(otherTypingTimer.current);
    };
  }, [friendId]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  // --------------------- Actions ---------------------
  const send = async () => {
    const tt = text.trim();
    if (!tt || sending || !friendId) return;
    setSending(true);
    try {
      if (editId) {
        await apiPatch(`/dms/${editId}`, { text: tt });
        setEditId(null);
      } else {
        await apiPost(`/dms/${friendId}`, { text: tt });
      }
      setText("");
    } catch (e: any) {
      Alert.alert(t("send_failed") || "Send failed", e.message || "");
    } finally {
      setSending(false);
    }
  };

  const sendImage = async () => {
    if (!friendId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
      allowsEditing: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    const b64 = `data:image/jpeg;base64,${res.assets[0].base64}`;
    if (b64.length > 720_000) {
      Alert.alert(t("image_too_large") || "Image too large", "Max ~500KB.");
      return;
    }
    try { await apiPost(`/dms/${friendId}`, { image: b64 }); }
    catch (e: any) {
      Alert.alert(t("send_failed") || "Send failed", e.message || "");
    }
  };

  const onChangeText = (v: string) => {
    setText(v);
    if (!friendId) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    apiPost(`/dms/${friendId}/typing`).catch(() => {});
    typingTimer.current = setTimeout(() => {}, 2000);
  };

  const longPressMsg = (m: DM) => {
    if (m.from_id !== myId || m.deleted) return;
    Alert.alert(t("message") || "Message", t("what_to_do") || "What do you want to do?", [
      { text: t("cancel") || "Cancel", style: "cancel" },
      { text: t("edit") || "Edit", onPress: () => { setEditId(m.id); setText(m.text); } },
      {
        text: t("delete") || "Delete",
        style: "destructive",
        onPress: async () => {
          try { await apiDelete(`/dms/${m.id}`); } catch {}
        },
      },
    ]);
  };

  // --------------------- Render ---------------------
  if (loading) {
    return (
      <View style={styles.safe}>
        <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["top"]}>
          <ActivityIndicator color={FUTURISTIC.brand} style={{ marginTop: 80 }} />
        </SafeAreaView>
      </View>
    );
  }

  // -- Build the subtitle: typing > online + shared > offline + shared --
  const subtitleParts: React.ReactNode[] = [];
  if (otherTyping) {
    subtitleParts.push(
      <View
        key="typing"
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Text style={styles.subtitleTyping}>{t("typing")}</Text>
        <TypingDots />
      </View>
    );
  } else {
    subtitleParts.push(
      <View key="presence" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={[
            styles.presenceDot,
            otherOnline
              ? {
                  backgroundColor: FUTURISTIC.brand,
                  shadowColor: FUTURISTIC.brand,
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                }
              : { backgroundColor: FUTURISTIC.textDisabled },
          ]}
        />
        <Text style={styles.subtitle}>
          {otherOnline ? t("online_caps") : t("offline_caps")}
          {sharedSeconds && sharedSeconds > 0 ? `  ·  ${formatSharedTime(sharedSeconds)} ${t("shared")}` : ""}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-20} color="rgba(34,255,136,0.08)" speed={11000} thickness={200} intensity={0.4} />
      <LightBeam angle={18} color="rgba(168,85,247,0.08)" speed={13000} delay={2500} thickness={180} intensity={0.36} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* ----- Header ----- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>

          {friend && (
            <>
              <View style={styles.avatarBox}>
                <LinearGradient
                  colors={
                    otherOnline
                      ? ["rgba(34,255,136,0.85)", "rgba(168,85,247,0.55)"]
                      : ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.05)"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRing}
                >
                  <Image
                    source={{ uri: friend.avatar_image || getAvatarUrl(friend.avatar) }}
                    style={styles.avatar}
                  />
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{friend.nickname}</Text>
                <View style={styles.subtitleRow}>{subtitleParts}</View>
              </View>
            </>
          )}
        </View>

        {/* ----- Chrome divider under header ----- */}
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255,255,255,0.18)",
            "rgba(34,255,136,0.35)",
            "rgba(168,85,247,0.35)",
            "rgba(255,255,255,0.18)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerEdge}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyRing}>
                <Ionicons name="chatbubbles-outline" size={42} color={FUTURISTIC.brand} />
              </View>
              <Text style={styles.emptyTitle}>{t("say_hi") || "Say hi!"}</Text>
              <Text style={styles.emptySub}>
                {t("start_conversation_with") || "Start a conversation with"} {friend?.nickname || ""}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 12 }}
              renderItem={({ item }) => (
                <MessageBubble
                  item={item}
                  mine={item.from_id === myId}
                  onLongPress={() => longPressMsg(item)}
                />
              )}
            />
          )}

          {/* ----- Edit bar ----- */}
          {editId && (
            <View style={styles.editBar}>
              <Ionicons name="pencil" size={14} color={FUTURISTIC.brand} />
              <Text style={styles.editText}>{t("editing_message") || "EDITING MESSAGE"}</Text>
              <TouchableOpacity
                onPress={() => { setEditId(null); setText(""); }}
                style={{ marginLeft: "auto" }}
              >
                <Ionicons name="close" size={18} color={FUTURISTIC.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* ----- Composer ----- */}
          <View style={styles.composer}>
            <TouchableOpacity onPress={sendImage} style={styles.attachBtn} activeOpacity={0.8}>
              <Ionicons name="image-outline" size={22} color={FUTURISTIC.brand} />
            </TouchableOpacity>
            <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
              <TextInput
                value={text}
                onChangeText={onChangeText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={editId ? (t("edit_message_dots") || "Edit message…") : (t("type_message_dots") || "Type a message…")}
                placeholderTextColor={FUTURISTIC.textDisabled}
                style={styles.input}
                multiline
                onSubmitEditing={send}
                returnKeyType="send"
              />
            </View>
            <PulseSendButton
              disabled={!text.trim() || sending}
              onPress={send}
              icon={editId ? "checkmark" : "send"}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FUTURISTIC.bg },
  // ----- Header -----
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
  },
  avatarBox: { width: 46, height: 46 },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 14,
    padding: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface2,
  },
  title: {
    color: FUTURISTIC.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.4,
    textShadowColor: "rgba(34,255,136,0.25)",
    textShadowRadius: 6,
  },
  subtitleRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  subtitle: {
    color: FUTURISTIC.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  subtitleTyping: {
    color: FUTURISTIC.brand,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  presenceDot: { width: 6, height: 6, borderRadius: 3 },
  // ----- Chrome divider under header -----
  headerEdge: { height: 1, width: "100%" },
  // ----- Typing dots -----
  typingDots: { flexDirection: "row", gap: 3, alignItems: "center" },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: FUTURISTIC.brand,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  // ----- Empty state -----
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: FUTURISTIC.surface1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyTitle: {
    color: FUTURISTIC.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 20,
    letterSpacing: 0.6,
  },
  emptySub: {
    color: FUTURISTIC.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  // ----- Bubbles -----
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: 6 },
  bubEdgeMine: {
    padding: 1,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  bubEdgeOther: {
    padding: 1,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  bubInner: {
    borderRadius: 17,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden",
  },
  bubInnerOther: {
    borderRadius: 17,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: FUTURISTIC.surface1,
  },
  bubText: { fontSize: 15, lineHeight: 20, letterSpacing: 0.15 },
  bubImage: {
    width: 220,
    height: 180,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: FUTURISTIC.surface2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    justifyContent: "flex-end",
  },
  meta: { fontSize: 10, letterSpacing: 0.4, fontWeight: "700" },
  // ----- Deleted bubble -----
  deletedBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: FUTURISTIC.surface1,
    borderColor: FUTURISTIC.borderSoft,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  deletedText: {
    color: FUTURISTIC.textMuted,
    fontStyle: "italic",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  // ----- Edit bar -----
  editBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: FUTURISTIC.brandSoft,
    borderTopWidth: 1,
    borderTopColor: FUTURISTIC.brandEdge,
  },
  editText: {
    color: FUTURISTIC.brand,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.6,
  },
  // ----- Composer -----
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: FUTURISTIC.borderSoft,
    backgroundColor: "rgba(8, 9, 18, 0.85)",
  },
  attachBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    backgroundColor: FUTURISTIC.surface1,
  },
  inputWrap: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    backgroundColor: FUTURISTIC.surface1,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  inputWrapFocused: {
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    maxHeight: 110,
  },
  // ----- Send button -----
  sendHalo: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 36,
    backgroundColor: "rgba(34,255,136,0.35)",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  sendInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
