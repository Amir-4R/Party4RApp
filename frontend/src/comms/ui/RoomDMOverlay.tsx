// =============================================================================
// src/comms/ui/RoomDMOverlay.tsx — Private messages (DM) inside a room
// =============================================================================
// نافذة رسائل خاصة تُفتح فوق الغرفة دون مغادرتها:
//   • قائمة المحادثات (GET /dms) → اختيار صديق.
//   • محادثة فردية (GET /dms/{id})، إرسال (POST /dms/{id})، تعليم كمقروء.
//   • اتصال WebSocket مستقل تماماً (/ws/dms) — اتصال الغرفة لا يُغلق ولا يُعاد
//     تحميله، وحالة المشغّل/الفيديو تبقى كما هي.
//   • الإغلاق يعيدك للغرفة فوراً بدون فقدان الحالة.
//   • مدخل النص موحَّد عبر ChatComposer (memoized + auto-refocus + RTL).
// تصميم متناسق مع Party4R، ولا يغيّر أي شيء في باقي التطبيق.
// =============================================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, ActivityIndicator, Modal, Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost, API_BASE, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { getAvatarUrl } from "@/src/constants/avatars";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import ChatComposer, { ChatComposerHandle } from "@/src/comms/ui/ChatComposer";

interface DM {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  image?: string | null;
  edited?: boolean;
  deleted?: boolean;
  created_at: string;
  read_at?: string | null;
}

interface Conversation {
  friend: { id: string; nickname: string; avatar: string; avatar_image?: string };
  last_message: { text: string; from_id: string; created_at: string } | null;
  unread: number;
  online: boolean;
}

export default function RoomDMOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const myId = user?.id || "";

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [active, setActive] = useState<Conversation["friend"] | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList<DM>>(null);
  const composerRef = useRef<ChatComposerHandle | null>(null);

  // ── Load conversation list whenever the overlay opens ──────────────────
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const d = await apiGet<{ conversations: Conversation[] }>("/dms");
      setConvs(d.conversations || []);
    } catch { /* offline — ignore */ } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadList();
    // When the overlay closes, drop back to the list view and tear down the
    // dedicated DM socket so it never lingers behind the room.
    if (!visible) {
      setActive(null);
      setMessages([]);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    }
  }, [visible, loadList]);

  // ── Open a single conversation: history + its own DM WebSocket ─────────
  const openChat = useCallback(async (friend: Conversation["friend"]) => {
    setActive(friend);
    setLoadingChat(true);
    setMessages([]);
    try {
      const history = await apiGet<{ messages: DM[] }>(`/dms/${friend.id}`);
      setMessages(history.messages || []);
      apiPost(`/dms/${friend.id}/read`).catch(() => {});
    } catch { /* ignore */ } finally {
      setLoadingChat(false);
    }

    // Dedicated DM socket — completely separate from the room socket.
    try { wsRef.current?.close(); } catch {}
    const token = (await storage.secureGet(TOKEN_KEY, "")) as string;
    const wsBase = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/ws/dms?token=${encodeURIComponent(token)}`);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (
          data.type === "dm_new" &&
          (data.message.from_id === friend.id || data.message.to_id === friend.id)
        ) {
          setMessages((m) => [...m, data.message]);
          if (data.message.from_id === friend.id) {
            apiPost(`/dms/${friend.id}/read`).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    };
    wsRef.current = ws;
  }, []);

  const backToList = useCallback(() => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    setActive(null);
    setMessages([]);
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  // Universal send handler used by the memoized ChatComposer. Returns `true`
  // on success (so the composer clears + refocuses), `false` otherwise.
  const handleSendDM = useCallback(
    async (text: string): Promise<boolean> => {
      if (sending || !active) return false;
      setSending(true);
      try {
        await apiPost(`/dms/${active.id}`, { text });
        // Optimistic local echo so the sender sees the message instantly
        // even if the WS round-trip lags.
        setMessages((m) => [
          ...m,
          {
            id: `local-${Date.now()}`,
            from_id: myId,
            to_id: active.id,
            text,
            created_at: new Date().toISOString(),
          },
        ]);
        return true;
      } catch {
        return false;
      } finally {
        setSending(false);
      }
    },
    [sending, active, myId],
  );

  const avatarFor = (f: { avatar?: string; avatar_image?: string | null }) =>
    f.avatar_image || getAvatarUrl(f.avatar || "");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => (active ? backToList() : onClose())}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.head}>
          {active ? (
            <TouchableOpacity testID="room-dm-back" onPress={backToList} style={styles.headBtn}>
              <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headBtn} />
          )}
          <Text style={styles.headTitle} numberOfLines={1}>
            {active ? active.nickname : (t("messages") || "الرسائل")}
          </Text>
          <TouchableOpacity testID="room-dm-close" onPress={onClose} style={styles.headBtn}>
            <Ionicons name="close" size={24} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* ───────── Conversation list ───────── */}
        {!active && (
          loadingList ? (
            <View style={styles.center}><ActivityIndicator color={FUTURISTIC.brand} /></View>
          ) : (
            <FlatList
              data={convs}
              keyExtractor={(c) => c.friend.id}
              contentContainerStyle={{ padding: 12 }}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>{t("no_conversations") || "لا توجد محادثات بعد"}</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.convRow}
                  activeOpacity={0.85}
                  onPress={() => openChat(item.friend)}
                >
                  <Image source={{ uri: avatarFor(item.friend) }} style={styles.convAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.convName} numberOfLines={1}>{item.friend.nickname}</Text>
                    <Text style={styles.convPreview} numberOfLines={1}>
                      {item.last_message?.text || (t("say_hi") || "ابدأ المحادثة")}
                    </Text>
                  </View>
                  {item.unread > 0 && (
                    <View style={styles.unread}><Text style={styles.unreadText}>{item.unread}</Text></View>
                  )}
                </TouchableOpacity>
              )}
            />
          )
        )}

        {/* ───────── Single conversation ───────── */}
        {active && (
          <KeyboardAvoidingView
            // Chat-optimized behavior — keyboard-controller animates the
            // entire panel up in lockstep with the OS keyboard. Works on
            // iOS, Android (Samsung/Pixel/Xiaomi), edge-to-edge & web.
            behavior={Platform.OS === "ios" ? "padding" : "translate-with-padding"}
            keyboardVerticalOffset={0}
            style={{ flex: 1 }}
          >
            {loadingChat ? (
              <View style={styles.center}><ActivityIndicator color={FUTURISTIC.brand} /></View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages.filter((m) => !m.deleted)}
                keyExtractor={(m) => m.id}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ padding: 12, paddingBottom: 6 }}
                renderItem={({ item }) => {
                  const mine = item.from_id === myId;
                  return (
                    <View style={[styles.msgRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                        <Text style={[styles.msgText, mine && { color: FUTURISTIC.bg }]}>{item.text}</Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={styles.emptyText}>{t("say_hi") || "ابدأ المحادثة"} 👋</Text>
                  </View>
                }
              />
            )}
            <ChatComposer
              ref={composerRef}
              onSend={handleSendDM}
              placeholder={t("send_message") || "اكتب رسالة…"}
              disabled={sending}
              testIDInput="dm-chat-input"
              testIDSend="dm-chat-send"
            />
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FUTURISTIC.bg },
  head: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: FUTURISTIC.borderSoft,
  },
  headBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headTitle: { flex: 1, textAlign: "center", color: FUTURISTIC.textPrimary, fontSize: 16, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: FUTURISTIC.textMuted, fontSize: 14 },
  convRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
    paddingHorizontal: 10, borderRadius: 14, marginBottom: 6,
    backgroundColor: FUTURISTIC.surface1, borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  convAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: FUTURISTIC.surface2 },
  convName: { color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "700" },
  convPreview: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 2 },
  unread: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: "#FF3B3B", alignItems: "center", justifyContent: "center",
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  msgRow: { flexDirection: "row", marginVertical: 3 },
  bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: { backgroundColor: FUTURISTIC.brand, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: FUTURISTIC.surface2, borderBottomLeftRadius: 4 },
  msgText: { color: FUTURISTIC.textPrimary, fontSize: 14 },
});
