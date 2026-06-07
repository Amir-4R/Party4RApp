// /app/frontend/app/tournaments.tsx
// =============================================================================
// PARTY4R — Tournaments listing screen.
// =============================================================================
// • Lists all tournaments grouped by status (Open / Running / Finished).
// • Tap a card → navigate to /tournaments/[id].
// • Floating button → navigate to /tournaments/create.
// • Pull-to-refresh.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet } from "@/src/api/client";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import GlowDivider from "@/src/components/futuristic/GlowDivider";

interface Tournament {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "running" | "finished";
  max_players: number;
  participants_count: number;
  prize?: string | null;
  starts_at?: string | null;
  created_by: string;
  created_at: string;
  winner_id?: string | null;
}

const STATUS_META: Record<Tournament["status"], { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  open: { label: "OPEN", color: FUTURISTIC.brand, icon: "radio-button-on-outline" },
  running: { label: "LIVE", color: "#FF8A50", icon: "flame" },
  finished: { label: "DONE", color: FUTURISTIC.textMuted, icon: "checkmark-circle" },
};

function StatusBadge({ status }: { status: Tournament["status"] }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.statusBadge, { borderColor: meta.color + "55", backgroundColor: meta.color + "15" }]}>
      <Ionicons name={meta.icon} size={10} color={meta.color} />
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function TournamentCard({ t, onPress }: { t: Tournament; onPress: () => void }) {
  const fillRatio = t.participants_count / Math.max(t.max_players, 1);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <MetallicCard accent={t.status === "running" ? "green" : "neutral"} radius={FUTURISTIC.radius.lg} padding={14}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
            {!!t.description && (
              <Text style={styles.cardDesc} numberOfLines={2}>{t.description}</Text>
            )}
          </View>
          <StatusBadge status={t.status} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="people" size={12} color={FUTURISTIC.brand} />
            <Text style={styles.metaText}>
              {t.participants_count}/{t.max_players}
            </Text>
          </View>
          {!!t.prize && (
            <View style={styles.metaPill}>
              <Ionicons name="gift" size={12} color="#FFD86B" />
              <Text style={styles.metaText}>{t.prize}</Text>
            </View>
          )}
        </View>

        {/* Capacity bar */}
        <View style={styles.barTrack}>
          <LinearGradient
            colors={[FUTURISTIC.brand, FUTURISTIC.accentGlow]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${Math.min(100, fillRatio * 100)}%` }]}
          />
        </View>
      </MetallicCard>
    </Pressable>
  );
}

export default function TournamentsScreen() {
  const router = useRouter();
  const { t } = useT();
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ items: Tournament[] }>("/tournaments?limit=50");
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Smart polling: refresh the list every 8s while screen is focused — keeps
  // OPEN/LIVE sections fresh without hammering the server.
  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => { load(); }, 8000);
      return () => clearInterval(interval);
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(); };

  // Group by status
  const open = items.filter((x) => x.status === "open");
  const running = items.filter((x) => x.status === "running");
  const finished = items.filter((x) => x.status === "finished");

  return (
    <View style={styles.bg}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-22} color={FUTURISTIC.brandSoft} speed={11500} thickness={210} intensity={0.5} />
      <LightBeam angle={18} color={FUTURISTIC.accentSoft} speed={13000} delay={2400} thickness={190} intensity={0.42} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="tour-back">
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{t("tournaments_kicker")}</Text>
            <Text style={styles.title}>{t("tournaments_title").toUpperCase()}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/tournament-create")}
            style={styles.createBtn}
            testID="tour-create"
          >
            <Ionicons name="add" size={26} color="#000" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          <GlowDivider color={FUTURISTIC.brand} speed={5200} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={FUTURISTIC.brand} />
            <Text style={styles.loadingText}>{t("loading")}</Text>
          </View>
        ) : (
          <FlatList
            data={[
              ...(running.length ? [{ type: "section", label: t("tour_section_live"), color: "#FF8A50" } as any] : []),
              ...running,
              ...(open.length ? [{ type: "section", label: t("tour_section_open"), color: FUTURISTIC.brand } as any] : []),
              ...open,
              ...(finished.length ? [{ type: "section", label: t("tour_section_finished"), color: FUTURISTIC.textMuted } as any] : []),
              ...finished,
            ]}
            keyExtractor={(item: any, idx) => (item.type ? `s-${idx}` : item.id)}
            renderItem={({ item }: any) =>
              item.type === "section" ? (
                <View style={styles.sectionRow}>
                  <View style={[styles.sectionDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.sectionLabel, { color: item.color }]}>{item.label}</Text>
                </View>
              ) : (
                <View style={{ marginBottom: 10 }}>
                  <TournamentCard t={item} onPress={() => router.push(`/tournament/${item.id}`)} />
                </View>
              )
            }
            contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 120 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FUTURISTIC.brand} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="trophy-outline" size={48} color={FUTURISTIC.brand} />
                </View>
                <Text style={styles.emptyTitle}>{t("tour_empty_title")}</Text>
                <Text style={styles.emptySub}>{t("tour_empty_sub")}</Text>
                <Pressable
                  onPress={() => router.push("/tournament-create")}
                  style={styles.emptyBtn}
                >
                  <Text style={styles.emptyBtnText}>{t("tour_create_first")}</Text>
                </Pressable>
              </View>
            }
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
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
    borderRadius: 14, backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  createBtn: {
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
    borderRadius: 14, backgroundColor: FUTURISTIC.brand,
    shadowColor: FUTURISTIC.brand, shadowOpacity: 0.6, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  kicker: {
    color: FUTURISTIC.textMuted, fontSize: 11, letterSpacing: 1.6,
    fontWeight: "700", marginBottom: 6, textTransform: "uppercase",
  },
  title: {
    ...TYPO.display, color: FUTURISTIC.textPrimary,
    textShadowColor: FUTURISTIC.brandSoft, textShadowRadius: 12,
  },
  sectionRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 8, marginBottom: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase",
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { color: FUTURISTIC.textPrimary, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  cardDesc: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1,
  },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.0 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: FUTURISTIC.surface2,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  metaText: { color: FUTURISTIC.textSecondary, fontSize: 11, fontWeight: "700" },
  barTrack: {
    height: 4, borderRadius: 2, backgroundColor: FUTURISTIC.surface2,
    marginTop: 12, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 2 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { ...TYPO.caption, color: FUTURISTIC.textMuted },
  empty: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, paddingVertical: 64,
  },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center",
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.brandEdge,
    marginBottom: 20,
  },
  emptyTitle: { color: FUTURISTIC.textPrimary, fontSize: 16, fontWeight: "900" },
  emptySub: {
    color: FUTURISTIC.textMuted, fontSize: 13, marginTop: 8,
    textAlign: "center", maxWidth: 240,
  },
  emptyBtn: {
    marginTop: 20, paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 12, backgroundColor: FUTURISTIC.brand,
    shadowColor: FUTURISTIC.brand, shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyBtnText: { color: "#000", fontWeight: "800", letterSpacing: 0.5, fontSize: 13 },
});
