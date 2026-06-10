// =============================================================================
// src/comms/ui/GameCommsBar.tsx — In-game comms cluster
// =============================================================================
// مجموعة أزرار عائمة داخل اللعبة: دردشة الخصم + أصدقاء + مايك.
//   • لا تغطّي اللوحة (عمود صغير على الحافة، يراعي SafeArea).
//   • Badge صغير عند وصول رسالة جديدة والدردشة مغلقة.
//   • تصميم زجاجي متناسق مع Party4R، مؤثّر ضغط خفيف.
//   • الحالة تُحفظ داخل هذا المكوّن (يبقى مُركَّباً مع اللعبة) فلا تضيع الدردشة
//     عند الإغلاق أو الخروج المؤقت.
// =============================================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import GameChatSheet, { ChatMessage } from "./GameChatSheet";
import FriendsQuickOverlay from "./FriendsQuickOverlay";
import MicButton from "./MicButton";

const BOT_REPLIES = ["👍", "حظ موفق!", "لعبة حلوة 😄", "هههه", "تمام", "ماشي 🔥"];

export default function GameCommsBar({
  opponentName = "Bot",
  opponentAvatar,
  showMic = true,
  botReplies = true,
  style,
  // ── Online-mode bridge: when provided, every "send" is routed through
  //    this callback (WS → server → broadcast) instead of the local bot
  //    simulator. Incoming messages should be piped in via `externalMessages`.
  onSendInGame,
  externalMessages,
}: {
  opponentName?: string;
  opponentAvatar?: string;
  showMic?: boolean;
  botReplies?: boolean;
  style?: ViewStyle;
  onSendInGame?: (text: string) => void;
  externalMessages?: { id: string; from: string; text: string; ts: number; fromMe?: boolean }[];
}) {
  const insets = useSafeAreaInsets();
  const [chatOpen, setChatOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalIdRef = useRef<string | null>(null);

  // When the screen wires `externalMessages` (e.g. online match) we mirror
  // them into the chat sheet's message list so the player sees everything in
  // ONE conversation panel. Local "fromMe" messages get tagged accordingly.
  useEffect(() => {
    if (!externalMessages || externalMessages.length === 0) return;
    const last = externalMessages[externalMessages.length - 1];
    if (lastExternalIdRef.current === last.id) return;
    lastExternalIdRef.current = last.id;
    const newOnes = externalMessages.filter((m) => {
      // De-dupe by id so we don't add the same message twice.
      return !messages.some((existing) => existing.id === m.id);
    });
    if (newOnes.length === 0) return;
    setMessages((prev) => [...prev, ...newOnes.map((m) => ({
      id: m.id,
      fromMe: !!m.fromMe,
      name: m.fromMe ? "" : m.from,
      text: m.text,
      ts: m.ts,
    } as ChatMessage))]);
    // Surface unread if the panel is closed and the message wasn't from me.
    setChatOpen((open) => {
      if (!open && !last.fromMe) setUnread((u) => u + 1);
      return open;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalMessages]);

  const handleSend = useCallback((text: string) => {
    // Online mode: route through the parent callback and DO NOT add a local
    // bubble — the server will echo it back via `externalMessages`.
    if (onSendInGame) {
      onSendInGame(text);
      return;
    }
    setMessages((prev) => [...prev, { id: `me_${Date.now()}`, fromMe: true, name: "", text, ts: Date.now() }]);
    // Light, local bot acknowledgement so chat feels alive in practice mode.
    if (botReplies) {
      if (replyTimer.current) clearTimeout(replyTimer.current);
      replyTimer.current = setTimeout(() => {
        const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        setMessages((prev) => [...prev, {
          id: `op_${Date.now()}`, fromMe: false, name: opponentName, avatar: opponentAvatar, text: reply, ts: Date.now(),
        }]);
        setChatOpen((open) => {
          if (!open) setUnread((u) => u + 1);
          return open;
        });
      }, 900 + Math.random() * 800);
    }
  }, [botReplies, opponentName, opponentAvatar, onSendInGame]);

  const openChat = () => { setChatOpen(true); setUnread(0); };

  return (
    <>
      <View style={[styles.bar, { top: insets.top + 120 }, style]} pointerEvents="box-none">
        <TouchableOpacity testID="comms-chat-button" style={styles.btn} onPress={openChat} activeOpacity={0.85}>
          <Ionicons name="chatbubbles" size={20} color={FUTURISTIC.brand} />
          {unread > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>
          )}
        </TouchableOpacity>

        <TouchableOpacity testID="comms-friends-button" style={styles.btn} onPress={() => setFriendsOpen(true)} activeOpacity={0.85}>
          <Ionicons name="people" size={20} color={FUTURISTIC.brand} />
        </TouchableOpacity>

        {showMic && (
          <View style={styles.micWrap}>
            <MicButton compact />
          </View>
        )}
      </View>

      <GameChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        onSend={handleSend}
      />
      <FriendsQuickOverlay visible={friendsOpen} onClose={() => setFriendsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute", right: 8,
    alignItems: "center", gap: 10, zIndex: 30,
  },
  btn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: FUTURISTIC.glassFill,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  micWrap: { marginTop: 2 },
  badge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#FF3B3B", alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: FUTURISTIC.bg,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
