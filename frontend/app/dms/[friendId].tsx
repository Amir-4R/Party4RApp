// /app/frontend/app/dms/[friendId].tsx — 1-on-1 DM chat
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { apiGet, apiPost, apiPatch, apiDelete, API_BASE, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/context/AuthContext";

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

export default function DMChatScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DM[]>([]);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);
  const otherTypingTimer = useRef<any>(null);

  const myId = user?.id || "";

  // Load history + friend info + connect WS
  useEffect(() => {
    if (!friendId) return;
    (async () => {
      try {
        const [history, friends] = await Promise.all([
          apiGet<{ messages: DM[] }>(`/dms/${friendId}`),
          apiGet<{ friends: Friend[] }>("/friends"),
        ]);
        setMessages(history.messages);
        const f = (friends.friends || []).find((x: any) => x.id === friendId);
        if (f) setFriend(f);
        // Mark as read
        apiPost(`/dms/${friendId}/read`).catch(() => {});
      } catch (e) {} finally { setLoading(false); }
    })();
    // Connect WebSocket
    (async () => {
      const token = (await storage.secureGet(TOKEN_KEY, "")) as string;
      const wsBase = API_BASE.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsBase}/ws/dms?token=${encodeURIComponent(token)}`);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "dm_new" && (data.message.from_id === friendId || data.message.to_id === friendId)) {
            setMessages(m => [...m, data.message]);
            // Auto-mark-read incoming
            if (data.message.from_id === friendId) {
              apiPost(`/dms/${friendId}/read`).catch(() => {});
            }
          } else if (data.type === "dm_edit") {
            setMessages(m => m.map(x => x.id === data.message.id ? data.message : x));
          } else if (data.type === "dm_delete") {
            setMessages(m => m.map(x => x.id === data.message.id ? data.message : x));
          } else if (data.type === "dm_typing" && data.from === friendId) {
            setOtherTyping(true);
            if (otherTypingTimer.current) clearTimeout(otherTypingTimer.current);
            otherTypingTimer.current = setTimeout(() => setOtherTyping(false), 3000);
          } else if (data.type === "dm_read" && data.by === friendId) {
            setMessages(m => m.map(x => x.to_id === friendId && !x.read_at ? { ...x, read_at: data.read_at } : x));
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

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending || !friendId) return;
    setSending(true);
    try {
      if (editId) {
        await apiPatch(`/dms/${editId}`, { text: t });
        setEditId(null);
      } else {
        await apiPost(`/dms/${friendId}`, { text: t });
      }
      setText("");
    } catch (e: any) { Alert.alert("Send failed", e.message || ""); } finally { setSending(false); }
  };

  const sendImage = async () => {
    if (!friendId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.5, allowsEditing: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    const b64 = `data:image/jpeg;base64,${res.assets[0].base64}`;
    if (b64.length > 720_000) { Alert.alert("Image too large", "Max ~500KB."); return; }
    try { await apiPost(`/dms/${friendId}`, { image: b64 }); } catch (e: any) { Alert.alert("Send failed", e.message || ""); }
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
    Alert.alert("Message", "What do you want to do?", [
      { text: "Cancel", style: "cancel" },
      { text: "Edit", onPress: () => { setEditId(m.id); setText(m.text); } },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await apiDelete(`/dms/${m.id}`); } catch {}
      } },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        {friend && (
          <>
            <Image source={{ uri: friend.avatar_image || getAvatarUrl(friend.avatar) }} style={styles.headerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{friend.nickname}</Text>
              <Text style={styles.subtitle}>
                {otherTyping ? "typing…" : otherOnline ? "online" : "offline"}
              </Text>
            </View>
          </>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
          renderItem={({ item }) => {
            const mine = item.from_id === myId;
            return (
              <TouchableOpacity activeOpacity={0.9} onLongPress={() => longPressMsg(item)} style={[styles.bubble, mine ? styles.bubMine : styles.bubTheirs]}>
                {item.deleted ? (
                  <Text style={styles.deletedText}>· message deleted ·</Text>
                ) : (
                  <>
                    {item.image && <Image source={{ uri: item.image }} style={styles.bubImage} />}
                    {!!item.text && <Text style={[styles.bubText, mine && { color: COLORS.bg }]}>{item.text}</Text>}
                  </>
                )}
                <View style={styles.metaRow}>
                  {item.edited && <Text style={[styles.meta, mine && { color: COLORS.bg }]}>edited</Text>}
                  <Text style={[styles.meta, mine && { color: COLORS.bg }]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {mine && (
                    <Ionicons
                      name={item.read_at ? "checkmark-done" : "checkmark"}
                      size={14}
                      color={item.read_at ? COLORS.bg : "rgba(7,7,16,0.6)"}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {editId && (
          <View style={styles.editBar}>
            <Ionicons name="pencil" size={14} color={COLORS.brand} />
            <Text style={styles.editText}>Editing message</Text>
            <TouchableOpacity onPress={() => { setEditId(null); setText(""); }} style={{ marginLeft: "auto" }}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composer}>
          <TouchableOpacity onPress={sendImage} style={styles.attachBtn}>
            <Ionicons name="image-outline" size={22} color={COLORS.brand} />
          </TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder={editId ? "Edit message…" : "Type a message…"}
            placeholderTextColor={COLORS.textDisabled}
            style={styles.input}
            multiline
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={send} disabled={!text.trim() || sending} style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}>
            <Ionicons name={editId ? "checkmark" : "send"} size={20} color={COLORS.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 36, height: 36, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.brand },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "800" },
  subtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  bubble: { maxWidth: "75%", padding: 10, borderRadius: 14, marginBottom: 6 },
  bubMine: { alignSelf: "flex-end", backgroundColor: COLORS.brand },
  bubTheirs: { alignSelf: "flex-start", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  bubText: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 20 },
  bubImage: { width: 220, height: 180, borderRadius: 8, marginBottom: 4 },
  deletedText: { color: COLORS.textMuted, fontStyle: "italic", fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, justifyContent: "flex-end" },
  meta: { color: COLORS.textSecondary, fontSize: 10 },
  editBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.brandDim, borderTopWidth: 1, borderTopColor: COLORS.brand },
  editText: { color: COLORS.brand, fontWeight: "700", fontSize: 13 },
  composer: { flexDirection: "row", alignItems: "flex-end", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg },
  attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.textPrimary, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" },
});
