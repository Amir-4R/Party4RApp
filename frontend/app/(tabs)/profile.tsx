import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { AVATARS, COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { apiGet, apiPost } from "@/src/api/client";
import React, { useState } from "react";

function formatMemberSince(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatHours(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 60) return "<1m";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );


  const selectAvatar = async (avatarId: string) => {
    if (!user || avatarId === user.avatar) return;
    setSaving(true);
    try {
      await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/profile?avatar=${avatarId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${await getToken()}` },
        }
      );
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.header}>
          <Image
            source={{ uri: getAvatarUrl(user?.avatar || "") }}
            style={styles.avatar}
            testID="profile-avatar"
          />
          <Text style={styles.nickname} testID="profile-nickname">
            {user?.nickname}
          </Text>
          <Text style={styles.username} testID="profile-username">
            @{user?.username}
          </Text>

          {/* Analytics row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard} testID="stat-member-since">
              <Text style={styles.statLabel}>MEMBER SINCE</Text>
              <Text style={styles.statValue}>{formatMemberSince(user?.created_at)}</Text>
            </View>
            <View style={styles.statCard} testID="stat-hours-spent">
              <Text style={styles.statLabel}>TOTAL HOURS</Text>
              <Text style={styles.statValue}>{formatHours(user?.total_seconds || 0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CHANGE AVATAR</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((a) => (
              <TouchableOpacity
                key={a.id}
                testID={`profile-avatar-${a.id}`}
                onPress={() => selectAvatar(a.id)}
                disabled={saving}
                style={[
                  styles.avatarTile,
                  user?.avatar === a.id && styles.avatarTileActive,
                ]}
              >
                <Image source={{ uri: a.url }} style={styles.avatarImg} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          testID="logout-button"
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

async function getToken() {
  const { storage } = await import("@/src/utils/storage");
  const { TOKEN_KEY } = await import("@/src/api/client");
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { alignItems: "center", paddingVertical: 24 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.brand,
  },
  nickname: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 16,
  },
  username: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  section: { marginTop: 24 },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  avatarTile: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 4,
  },
  avatarTileActive: {
    borderColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 10 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 40,
  },
  logoutText: { color: COLORS.error, fontWeight: "800", letterSpacing: 1 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    width: "100%",
    paddingHorizontal: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  statValue: { color: COLORS.brand, fontSize: 18, fontWeight: "800" },
});
