// /app/frontend/app/blocked.tsx — Phase 2 Blocked users list
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { apiGet, apiPost } from "@/src/api/client";

interface Blocked { id: string; username: string; nickname: string; avatar: string; avatar_image?: string }

export default function BlockedScreen() {
  const router = useRouter();
  const [list, setList] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ blocked: Blocked[] }>("/users/blocked");
      setList(d.blocked);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const unblock = (u: Blocked) => {
    Alert.alert("Unblock", `Unblock ${u.nickname}? They will be able to message you again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        style: "destructive",
        onPress: async () => {
          try { await apiPost(`/users/unblock/${u.id}`); await load(); } catch {}
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>BLOCKED USERS</Text>
          <Text style={styles.subtitle}>{list.length} blocked</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No blocked users</Text>
              <Text style={styles.emptySub}>You haven't blocked anyone yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Image
                source={{ uri: item.avatar_image || getAvatarUrl(item.avatar) }}
                style={styles.avatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.nick}>{item.nickname}</Text>
                <Text style={styles.user}>@{item.username}</Text>
              </View>
              <TouchableOpacity onPress={() => unblock(item)} style={styles.unblockBtn}>
                <Text style={styles.unblockText}>UNBLOCK</Text>
              </TouchableOpacity>
            </View>
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
  empty: { alignItems: "center", padding: 48, gap: 8 },
  emptyText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: 16, marginTop: 8 },
  emptySub: { color: COLORS.textMuted, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 46, height: 46, borderRadius: 14 },
  nick: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700" },
  user: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.brandDim, borderRadius: 12, borderWidth: 1, borderColor: COLORS.brand },
  unblockText: { color: COLORS.brand, fontWeight: "800", letterSpacing: 1, fontSize: 11 },
});
