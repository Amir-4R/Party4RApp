// /app/frontend/app/dms.tsx — Phase 3 DM Inbox
// Lists all friends, last message preview, unread count.

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { apiGet } from "@/src/api/client";

interface Conversation {
  friend: { id: string; username: string; nickname: string; avatar: string; avatar_image?: string };
  last_message: { text: string; image?: string; from_id: string; created_at: string; read_at?: string | null } | null;
  unread: number;
  online: boolean;
}

export default function DMInboxScreen() {
  const router = useRouter();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ conversations: Conversation[] }>("/dms");
      setConvs(d.conversations);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>MESSAGES</Text>
          <Text style={styles.subtitle}>{convs.length} {convs.length === 1 ? "conversation" : "conversations"}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={convs}
          keyExtractor={(i) => i.friend.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySub}>Add friends to start messaging.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/dms/${item.friend.id}`)}
              activeOpacity={0.85}
              style={styles.row}
            >
              <View style={styles.avatarBox}>
                <Image source={{ uri: item.friend.avatar_image || getAvatarUrl(item.friend.avatar) }} style={styles.avatar} />
                <View style={[styles.friendRing, { borderColor: COLORS.brand }]} />
                {item.online && <View style={[styles.dot, { backgroundColor: COLORS.success }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.nick} numberOfLines={1}>{item.friend.nickname}</Text>
                  {item.last_message && <Text style={styles.time}>{formatTime(item.last_message.created_at)}</Text>}
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    style={[styles.preview, item.unread > 0 && { color: COLORS.textPrimary, fontWeight: "700" }]}
                    numberOfLines={1}
                  >
                    {item.last_message ?
                      (item.last_message.image ? "📷 Photo" : item.last_message.text || "—")
                      : "Say hi!"}
                  </Text>
                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread > 99 ? "99+" : item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", padding: 60, gap: 8 },
  emptyText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: 16, marginTop: 8 },
  emptySub: { color: COLORS.textMuted, fontSize: 13 },
  row: { flexDirection: "row", gap: 12, padding: 12, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  avatarBox: { width: 54, height: 54, position: "relative" },
  avatar: { width: 50, height: 50, borderRadius: 16, margin: 2 },
  friendRing: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 2 },
  dot: { position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.bg },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nick: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700", flex: 1 },
  time: { color: COLORS.textMuted, fontSize: 11 },
  rowBottom: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
  preview: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  badge: { backgroundColor: COLORS.brand, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeText: { color: COLORS.bg, fontSize: 11, fontWeight: "900" },
});
