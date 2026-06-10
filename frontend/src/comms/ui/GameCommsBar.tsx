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
import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { withAlpha } from "@/src/games/shared/gameTheme";
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
}: {
  opponentName?: string;
  opponentAvatar?: string;
  showMic?: boolean;
  botReplies?: boolean;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const [chatOpen, setChatOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = useCallback((text: string) => {
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
  }, [botReplies, opponentName, opponentAvatar]);

  const openChat = () => { setChatOpen(true); setUnread(0); };

  return (
    <>
      <View style={[styles.bar, { top: insets.top + 120 }, style]} pointerEvents="box-none">
        <TouchableOpacity style={styles.btn} onPress={openChat} activeOpacity={0.85}>
          <Ionicons name="chatbubbles" size={20} color={FUTURISTIC.brand} />
          {unread > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={() => setFriendsOpen(true)} activeOpacity={0.85}>
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
