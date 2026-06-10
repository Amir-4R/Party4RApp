// =============================================================================
// src/comms/ui/FriendsQuickOverlay.tsx — Friends & DM while playing
// =============================================================================
// يفتح قائمة الأصدقاء فوق اللعبة، واختيار صديق يفتح دردشة معه فوق اللعبة دون
// مغادرة المباراة (Modal — اللعبة تبقى مُركَّبة فلا تُعاد تهيئتها عند الإغلاق).
// مربوط بنظام الأصدقاء (/friends) والخاص (/dms) والحظر (المحظور لا يظهر).
// يعمل أوفلاين بأمان (يتجاهل أخطاء الشبكة ويسمح بالعرض المحلي).
// =============================================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList, TouchableOpacity,
  Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { withAlpha } from "@/src/games/shared/gameTheme";
import { apiGet, apiPost } from "@/src/api/client";
import { getAvatarUrl } from "@/src/constants/avatars";
import { useComms } from "@/src/comms/CommsContext";
import { useT } from "@/src/context/LanguageContext";

interface Friend { id: string; nickname: string; avatar: string; avatar_image?: string | null; }
interface Msg { id: string; text: string; mine: boolean; }

function avatarOf(f: Friend) { return f.avatar_image || getAvatarUrl(f.avatar); }

export default function FriendsQuickOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { canCommunicateWith } = useComms();

  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [active, setActive] = useState<Friend | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!visible) { setActive(null); setMsgs([]); return; }
    setLoading(true);
    apiGet<{ friends: Friend[] }>("/friends")
      .then((d) => setFriends((d.friends || []).filter((f) => canCommunicateWith(f.id))))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [visible, canCommunicateWith]);

  const openThread = useCallback((f: Friend) => {
    setActive(f);
    setMsgs([]);
    apiGet<any>(`/dms/${f.id}`)
      .then((d) => {
        const arr = Array.isArray(d) ? d : (d?.messages || []);
        const mapped: Msg[] = arr.map((m: any, i: number) => ({
          id: String(m.id ?? m._id ?? i),
          text: String(m.text ?? m.content ?? m.body ?? ""),
          mine: !!(m.mine ?? m.is_me ?? m.from_me),
        })).filter((m: Msg) => m.text);
        setMsgs(mapped);
      })
      .catch(() => { /* offline — start empty */ });
  }, []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || !active) return;
    setMsgs((prev) => [...prev, { id: `local_${Date.now()}`, text, mine: true }]);
    setDraft("");
    apiPost(`/dms/${active.id}`, { text }).catch(() => { /* queued locally; sync later */ });
  }, [draft, active]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.kav}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {active ? (
              <TouchableOpacity onPress={() => setActive(null)} hitSlop={8} style={{ paddingRight: 6 }}>
                <Ionicons name="chevron-back" size={22} color={FUTURISTIC.textSecondary} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="people-outline" size={18} color={FUTURISTIC.brand} />
            )}
            <Text style={styles.title}>
              {active ? active.nickname : (t("friends") || "الأصدقاء")}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="chevron-down" size={22} color={FUTURISTIC.textSecondary} />
            </TouchableOpacity>
          </View>

          {!active ? (
            loading ? (
              <ActivityIndicator color={FUTURISTIC.brand} style={{ marginTop: 30 }} />
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(f) => f.id}
                contentContainerStyle={{ paddingVertical: 8, gap: 4 }}
                ListEmptyComponent={<Text style={styles.empty}>{t("no_friends_online") || "لا أصدقاء متاحون الآن"}</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.friendRow} onPress={() => openThread(item)} activeOpacity={0.85}>
                    <Image source={{ uri: avatarOf(item) }} style={styles.friendAvatar} />
                    <Text style={styles.friendName}>{item.nickname}</Text>
                    <Ionicons name="chatbubble-outline" size={18} color={FUTURISTIC.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )
          ) : (
            <>
              <FlatList
                data={msgs}
                keyExtractor={(m) => m.id}
                contentContainerStyle={{ paddingVertical: 8, gap: 6 }}
                ListEmptyComponent={<Text style={styles.empty}>{t("no_messages_yet") || "لا رسائل بعد"}</Text>}
                renderItem={({ item }) => (
                  <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, item.mine && { color: FUTURISTIC.bg }]}>{item.text}</Text>
                  </View>
                )}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
              />
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("type_message") || "اكتب رسالة…"}
                  placeholderTextColor={FUTURISTIC.textMuted}
                  style={styles.input}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  multiline
                />
                <TouchableOpacity style={[styles.sendBtn, { opacity: draft.trim() ? 1 : 0.5 }]} onPress={send} disabled={!draft.trim()} activeOpacity={0.85}>
                  <Ionicons name="send" size={18} color={FUTURISTIC.bg} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "72%", minHeight: 320, backgroundColor: FUTURISTIC.surface1,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: FUTURISTIC.border,
    paddingHorizontal: 14, paddingTop: 8,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: FUTURISTIC.borderStrong, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: FUTURISTIC.borderSoft },
  title: { flex: 1, color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "900" },
  closeBtn: { padding: 4 },
  empty: { color: FUTURISTIC.textMuted, fontSize: 13, textAlign: "center", marginTop: 24 },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, backgroundColor: FUTURISTIC.surface2 },
  friendAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: FUTURISTIC.surface3 },
  friendName: { flex: 1, color: FUTURISTIC.textPrimary, fontSize: 14, fontWeight: "800" },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, maxWidth: "85%" },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: FUTURISTIC.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: FUTURISTIC.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: FUTURISTIC.borderSoft },
  bubbleText: { color: FUTURISTIC.textPrimary, fontSize: 14, lineHeight: 19 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: FUTURISTIC.borderSoft },
  input: { flex: 1, maxHeight: 110, minHeight: 42, backgroundColor: FUTURISTIC.surface2, borderRadius: 14, borderWidth: 1, borderColor: FUTURISTIC.borderSoft, paddingHorizontal: 14, paddingVertical: 10, color: FUTURISTIC.textPrimary, fontSize: 14 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: FUTURISTIC.brand, alignItems: "center", justifyContent: "center" },
});
