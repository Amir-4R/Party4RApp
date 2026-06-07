// /app/frontend/app/leaderboard.tsx
// =============================================================================
// PARTY4R — Global Leaderboard
// =============================================================================
// 3 tabs: Honor Points · Watch Time · Top Hosts.
// • Pull-to-refresh.
// • Top-3 medals (🥇🥈🥉) with shimmering metallic ring.
// • Highlights the current user's row.
// • Pure FUTURISTIC design language (LightBeam + MetallicCard + GlowDivider).

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/context/LanguageContext";
import { getAvatarUrl } from "@/src/constants/avatars";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import GlowDivider from "@/src/components/futuristic/GlowDivider";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
type TabId = "honor" | "watch_time" | "hosts";

interface LBUserBase {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  rank: number;
}
interface HonorRow extends LBUserBase {
  honor: number;
}
interface WatchRow extends LBUserBase {
  total_seconds: number;
}
interface HostRow extends LBUserBase {
  rooms_hosted: number;
}
type AnyRow = HonorRow | WatchRow | HostRow;

interface LBResponse<T> {
  items: T[];
  total: number;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function formatHours(s: number): string {
  if (!s || s < 60) return "<1m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function getValueForTab(row: AnyRow, tab: TabId): { value: string; label: string } {
  if (tab === "honor") {
    return { value: String((row as HonorRow).honor ?? 0), label: "HP" };
  }
  if (tab === "watch_time") {
    return { value: formatHours((row as WatchRow).total_seconds ?? 0), label: "" };
  }
  return { value: String((row as HostRow).rooms_hosted ?? 0), label: "" };
}

const MEDAL_COLORS: Record<number, [string, string]> = {
  1: ["#FFD86B", "#B8860B"], // Gold
  2: ["#E8E8F0", "#8C8CA1"], // Silver
  3: ["#E29260", "#7A4218"], // Bronze
};

// ----------------------------------------------------------------------------
// Tab pill
// ----------------------------------------------------------------------------
function TabPill({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      {active ? (
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.50)",
            FUTURISTIC.brandGlow,
            FUTURISTIC.accentGlow,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tabEdge}
        >
          <View style={styles.tabFillActive}>
            <Ionicons name={icon} size={15} color={FUTURISTIC.brand} />
            <Text style={[styles.tabText, styles.tabTextActive]}>{label}</Text>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.tabFillInactive}>
          <Ionicons name={icon} size={15} color={FUTURISTIC.textMuted} />
          <Text style={styles.tabText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ----------------------------------------------------------------------------
// Row card
// ----------------------------------------------------------------------------
function LBRow({
  row,
  tab,
  isMe,
}: {
  row: AnyRow;
  tab: TabId;
  isMe: boolean;
}) {
  const medal = MEDAL_COLORS[row.rank];
  const { value, label } = getValueForTab(row, tab);

  return (
    <MetallicCard
      accent={isMe ? "green" : "neutral"}
      radius={FUTURISTIC.radius.lg}
      padding={12}
    >
      <View style={styles.rowInner}>
        {/* Rank badge / medal */}
        <View style={styles.rankWrap}>
          {medal ? (
            <LinearGradient
              colors={medal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.medalRing}
            >
              <View style={styles.medalInner}>
                <Text style={styles.medalText}>{row.rank}</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.rankPill}>
              <Text style={styles.rankPillText}>#{row.rank}</Text>
            </View>
          )}
        </View>

        {/* Avatar */}
        <LinearGradient
          colors={
            isMe
              ? [FUTURISTIC.brand, FUTURISTIC.accentGlow]
              : ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.04)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <Image source={{ uri: getAvatarUrl(row.avatar) }} style={styles.avatarImg} />
        </LinearGradient>

        {/* Identity */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.nickname} numberOfLines={1}>
            {row.nickname || row.username}
            {isMe && <Text style={styles.youTag}>  • YOU</Text>}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{row.username}
          </Text>
        </View>

        {/* Value */}
        <View style={styles.valueBox}>
          <Text style={styles.valueText}>{value}</Text>
          {!!label && <Text style={styles.valueLabel}>{label}</Text>}
        </View>
      </View>
    </MetallicCard>
  );
}

// ----------------------------------------------------------------------------
// Main screen
// ----------------------------------------------------------------------------
export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();

  const [tab, setTab] = useState<TabId>("honor");
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const endpoint =
    tab === "honor"
      ? "/leaderboard/honor"
      : tab === "watch_time"
      ? "/leaderboard/watch_time"
      : "/leaderboard/hosts";

  const load = useCallback(async () => {
    try {
      const data = await apiGet<LBResponse<AnyRow>>(`${endpoint}?limit=100`);
      setRows(data.items || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endpoint]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <View style={styles.bg}>
      <LinearGradient
        colors={GRADIENTS.appBg as unknown as string[]}
        style={StyleSheet.absoluteFill}
      />
      <LightBeam
        angle={-20}
        color={FUTURISTIC.brandSoft}
        speed={11000}
        thickness={210}
        intensity={0.5}
      />
      <LightBeam
        angle={18}
        color={FUTURISTIC.accentSoft}
        speed={13000}
        delay={2400}
        thickness={190}
        intensity={0.42}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="lb-back"
          >
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{t("lb_kicker")}</Text>
            <Text style={styles.title}>{t("lb_title").toUpperCase()}</Text>
          </View>
          <View style={styles.trophyBadge}>
            <Ionicons name="trophy" size={20} color={FUTURISTIC.brand} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          <GlowDivider color={FUTURISTIC.brand} speed={5200} />
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TabPill
            active={tab === "honor"}
            label={t("lb_tab_honor")}
            icon="ribbon-outline"
            onPress={() => setTab("honor")}
          />
          <View style={{ width: 8 }} />
          <TabPill
            active={tab === "watch_time"}
            label={t("lb_tab_watch")}
            icon="time-outline"
            onPress={() => setTab("watch_time")}
          />
          <View style={{ width: 8 }} />
          <TabPill
            active={tab === "hosts"}
            label={t("lb_tab_hosts")}
            icon="megaphone-outline"
            onPress={() => setTab("hosts")}
          />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={FUTURISTIC.brand} />
            <Text style={styles.loadingText}>{t("loading")}</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => `${tab}-${r.id}-${r.rank}`}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 10 }}>
                <LBRow row={item} tab={tab} isMe={item.id === user?.id} />
              </View>
            )}
            contentContainerStyle={{
              padding: 20,
              paddingTop: 14,
              paddingBottom: 120,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={FUTURISTIC.brand}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="trophy-outline"
                    size={48}
                    color={FUTURISTIC.brand}
                  />
                </View>
                <Text style={styles.emptyTitle}>{t("lb_empty_title")}</Text>
                <Text style={styles.emptySub}>{t("lb_empty_sub")}</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: FUTURISTIC.bg },

  // -------- Header --------
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
  },
  trophyBadge: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  kicker: {
    color: FUTURISTIC.textMuted,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  title: {
    ...TYPO.display,
    color: FUTURISTIC.textPrimary,
    textShadowColor: FUTURISTIC.brandSoft,
    textShadowRadius: 12,
  },

  // -------- Tabs --------
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  tabEdge: {
    borderRadius: 14,
    padding: 1,
  },
  tabFillActive: {
    borderRadius: 13,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(8,9,18,0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabFillInactive: {
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 10,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabText: {
    color: FUTURISTIC.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  tabTextActive: {
    color: FUTURISTIC.textPrimary,
  },

  // -------- Loading / Empty --------
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    ...TYPO.caption,
    color: FUTURISTIC.textMuted,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    marginBottom: 20,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyTitle: {
    color: FUTURISTIC.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  emptySub: {
    color: FUTURISTIC.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    maxWidth: 240,
  },

  // -------- Row --------
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rankWrap: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  medalRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 2,
  },
  medalInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(8,9,18,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  medalText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  rankPill: {
    minWidth: 36,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 14,
    backgroundColor: FUTURISTIC.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
  },
  rankPillText: {
    color: FUTURISTIC.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 14,
    padding: 2,
    marginLeft: 4,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface2,
  },
  nickname: {
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  youTag: {
    color: FUTURISTIC.brand,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  username: {
    color: FUTURISTIC.textMuted,
    fontSize: 12,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  valueBox: {
    alignItems: "flex-end",
    paddingHorizontal: 6,
    minWidth: 56,
  },
  valueText: {
    color: FUTURISTIC.brand,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.4,
    textShadowColor: FUTURISTIC.brandSoft,
    textShadowRadius: 6,
  },
  valueLabel: {
    color: FUTURISTIC.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.0,
    marginTop: 2,
  },
});
