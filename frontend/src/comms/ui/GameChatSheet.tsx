// =============================================================================
// src/comms/ui/GameChatSheet.tsx — In-game chat (bottom sheet)
// =============================================================================
// دردشة نصية داخل اللعبة:
//   • Bottom sheet مرتّب لا يغطّي اللوحة بالكامل ويُغلق بسهولة.
//   • رسائل باسم اللاعب وصورته وبترتيب واضح (الأحدث أسفل).
//   • مدخل النص موحَّد عبر ChatComposer (memoized + auto-refocus + RTL).
//     يحافظ على الـ focus عبر جميع الأجهزة (Samsung/Pixel/Xiaomi…).
//   • يحترم SafeArea والكيبورد على Android/iOS باستخدام
//     react-native-keyboard-controller.
// =============================================================================
import React, { useRef } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  TouchableOpacity, Platform, Image,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";
import ChatComposer, { ChatComposerHandle } from "@/src/comms/ui/ChatComposer";

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  name: string;
  avatar?: string;
  text: string;
  ts: number;
}

export default function GameChatSheet({
  visible, onClose, messages, onSend, title,
}: {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  title?: string;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const composerRef = useRef<ChatComposerHandle | null>(null);

  const handleSend = (text: string) => {
    onSend(text);
    return true; // tell composer to clear & refocus
  };

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.row, item.fromMe ? styles.rowMine : styles.rowTheirs]}>
      {!item.fromMe && (
        item.avatar
          ? <Image source={{ uri: item.avatar }} style={styles.avatar} />
          : <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={14} color={FUTURISTIC.textMuted} /></View>
      )}
      <View style={[styles.bubble, item.fromMe ? styles.bubbleMine : styles.bubbleTheirs]}>
        {!item.fromMe && <Text style={styles.bubbleName}>{item.name}</Text>}
        <Text style={[styles.bubbleText, item.fromMe && { color: FUTURISTIC.bg }]}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        // Chat-app behavior — keyboard-controller library handles iOS,
        // Android (Samsung/Pixel/Xiaomi), edge-to-edge, predictive back,
        // and split-screen consistently.
        behavior={Platform.OS === "ios" ? "padding" : "translate-with-padding"}
        style={styles.kav}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Ionicons name="chatbubbles-outline" size={18} color={FUTURISTIC.brand} />
            <Text style={styles.title}>{title || (t("game_chat") || "الدردشة")}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="chevron-down" size={22} color={FUTURISTIC.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={{ paddingVertical: 8, gap: 6 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={styles.empty}>{t("no_messages_yet") || "لا رسائل بعد — ابدأ المحادثة"}</Text>
            }
            keyboardShouldPersistTaps="always"
          />

          <ChatComposer
            ref={composerRef}
            onSend={handleSend}
            placeholder={t("type_message") || "اكتب رسالة…"}
            multiline
            testIDInput="comms-chat-input"
            testIDSend="comms-chat-send"
            containerStyle={styles.composerOverride}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "70%", minHeight: 320,
    backgroundColor: FUTURISTIC.surface1,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: FUTURISTIC.border,
    paddingHorizontal: 14, paddingTop: 8,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: FUTURISTIC.borderStrong, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: FUTURISTIC.borderSoft },
  title: { flex: 1, color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "900" },
  closeBtn: { padding: 4 },
  list: { flex: 1 },
  empty: { color: FUTURISTIC.textMuted, fontSize: 13, textAlign: "center", marginTop: 24 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6, maxWidth: "85%" },
  rowMine: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  rowTheirs: { alignSelf: "flex-start" },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: FUTURISTIC.surface2 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleMine: { backgroundColor: FUTURISTIC.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: FUTURISTIC.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: FUTURISTIC.borderSoft },
  bubbleName: { color: FUTURISTIC.brand, fontSize: 11, fontWeight: "800", marginBottom: 2 },
  bubbleText: { color: FUTURISTIC.textPrimary, fontSize: 14, lineHeight: 19 },
  // Slim composer override for the bottom-sheet variant — drop the heavy
  // top-border the universal composer applies by default since the
  // sheet already provides its own visual separator above the input.
  composerOverride: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FUTURISTIC.borderSoft,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 6,
  },
});
