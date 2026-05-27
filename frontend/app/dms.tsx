// /app/frontend/app/dms.tsx — Phase 3 DM Inbox (futuristic redesign)
//
// Lists all friends with last-message preview + unread count.
// Visual upgrades:
//   • Ambient LightBeams (subtle green + purple).
//   • Header: chevron back + "MESSAGES" caps display + count subtitle.
//   • Conversations use MetallicCard with iridescent border (green when unread/online).
//   • Avatar wrapped in chrome+brand gradient ring; online dot is glowing.
//   • Unread badge: red glow circle.
//   • Empty state: neon-bordered icon ring.

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getAvatarUrl } from "@/src/constants/avatars";
import { apiGet } from "@/src/api/client";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import GlowDivider from "@/src/components/futuristic/GlowDivider";
import LightBeam from "@/src/components/futuristic/LightBeam";
import { useT } from "@/src/context/LanguageContext";

interface Conversation {
  friend: { id: string; username: string; nickname: string; avatar: string; avatar_image?: string };
  last_message: { text: string; image?: string; from_id: string; created_at: string; read_at?: string | null } | null;
  unread: number;
  online: boolean;
}

export default function DMInboxScreen() {
  const router = useRouter();
  const { t } = useT();
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
    <View style={styles.bg}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-20} color="rgba(34,255,136,0.12)" speed={10000} thickness={200} intensity={0.45} />
      <LightBeam angle={18} color="rgba(168,85,247,0.10)" speed={12000} delay={2500} thickness={180} intensity={0.4} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.kicker}>DIRECT</Text>
            <Text style={styles.title}>{(t("messages") || "MESSAGES").toUpperCase()}</Text>
          </View>
          <View style={styles.countPill}>
            <Ionicons name="chatbubbles" size={12} color={FUTURISTIC.brand} />
            <Text style={styles.countText}>{convs.length}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <GlowDivider color={FUTURISTIC.brand} speed={5400} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={FUTURISTIC.brand} />
            <Text style={styles.loadingText}>LOADING CONVERSATIONS…</Text>
          </View>
        ) : (
          <FlatList
            data={convs}
            keyExtractor={(i) => i.friend.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FUTURISTIC.brand} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconRing}>
                  <Ionicons name="chatbubbles-outline" size={42} color={FUTURISTIC.brand} />
                </View>
                <Text style={styles.emptyTitle}>{t("no_conversations_yet") || "No conversations yet"}</Text>
                <Text style={styles.emptySub}>
                  {t("add_friends_to_message") || "Add friends and say hi to start chatting."}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isUnread = item.unread > 0;
              const accent: "green" | "purple" | "neutral" = isUnread ? "green" : item.online ? "purple" : "neutral";
              return (
                <TouchableOpacity
                  onPress={() => router.push(`/dms/${item.friend.id}`)}
                  activeOpacity={0.85}
                  style={{ marginBottom: 10 }}
                >
                  <MetallicCard accent={accent} padding={12} radius={FUTURISTIC.radius.md}>
                    <View style={styles.row}>
                      <View style={styles.avatarBox}>
                        <LinearGradient
                          colors={
                            item.online
                              ? ["rgba(34,255,136,0.85)", "rgba(168,85,247,0.55)"]
                              : ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)"]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.avatarRing}
                        >
                          <Image
                            source={{ uri: item.friend.avatar_image || getAvatarUrl(item.friend.avatar) }}
                            style={styles.avatar}
                          />
                        </LinearGradient>
                        {item.online && <View style={styles.onlineDot} />}
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.rowTop}>
                          <Text style={styles.nick} numberOfLines={1}>
                            {item.friend.nickname}
                          </Text>
                          {item.last_message && (
                            <Text style={styles.time}>
                              {formatTime(item.last_message.created_at)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.rowBottom}>
                          <Text
                            style={[
                              styles.preview,
                              isUnread && { color: FUTURISTIC.textPrimary, fontWeight: "800" },
                            ]}
                            numberOfLines={1}
                          >
                            {item.last_message
                              ? item.last_message.image
                                ? "📷 Photo"
                                : item.last_message.text || "—"
                              : t("say_hi") || "Say hi!"}
                          </Text>
                          {isUnread && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>
                                {item.unread > 99 ? "99+" : item.unread}
                              </Text>
                            </View>
                          )}
                          {!isUnread && item.online && (
                            <View style={styles.onlinePill}>
                              <View style={styles.onlinePillDot} />
                              <Text style={styles.onlinePillText}>LIVE</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </MetallicCard>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  kicker: {
    ...TYPO.micro,
    color: FUTURISTIC.textMuted,
  },
  title: {
    ...TYPO.h1,
    color: FUTURISTIC.textPrimary,
    textShadowColor: "rgba(34,255,136,0.30)",
    textShadowRadius: 10,
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: FUTURISTIC.brandSoft,
    borderColor: FUTURISTIC.brandEdge,
    borderWidth: 1,
    borderRadius: 999,
  },
  countText: {
    color: FUTURISTIC.brand,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { ...TYPO.caption, color: FUTURISTIC.textMuted },
  // ----- Row -----
  row: { flexDirection: "row", alignItems: "center" },
  avatarBox: { width: 54, height: 54, position: "relative" },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 16,
    padding: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: FUTURISTIC.surface2,
  },
  onlineDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FUTURISTIC.brand,
    borderWidth: 2,
    borderColor: FUTURISTIC.bg,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.95,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowBottom: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
  nick: {
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
    flex: 1,
  },
  time: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  preview: {
    color: FUTURISTIC.textSecondary,
    fontSize: 13,
    flex: 1,
    letterSpacing: 0.2,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FUTURISTIC.brand,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  badgeText: { color: "#001A0C", fontSize: 11, fontWeight: "900" },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: FUTURISTIC.accentSoft,
    borderWidth: 1,
    borderColor: FUTURISTIC.accentEdge,
  },
  onlinePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: FUTURISTIC.accent,
  },
  onlinePillText: {
    color: FUTURISTIC.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  // ----- Empty -----
  empty: { alignItems: "center", padding: 32, marginTop: 24 },
  emptyIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: FUTURISTIC.surface1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyTitle: {
    ...TYPO.h2,
    color: FUTURISTIC.textPrimary,
    marginTop: 22,
  },
  emptySub: {
    color: FUTURISTIC.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    letterSpacing: 0.3,
    maxWidth: 260,
  },
});
