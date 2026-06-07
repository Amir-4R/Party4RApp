// =============================================================================
// app/(tabs)/play.tsx — Party4R Game Hub
// =============================================================================
// PHASE 1: Navigation skeleton + data wiring.
// Emergent will replace the placeholder UI with the real design.
//
// What this file provides for Emergent:
//   - `games`       → array of { id, name, available } to render game cards
//   - `myStats`     → PlayerStats[] for current user (wins/losses/rating)
//   - `dailyMissions` → DailyMission[] for the missions widget
//   - `pendingInvitations` → GameInvitation[] for the invite badge/list
//   - `totalBadgeCount` → number shown on tab badge
//   - `onSelectGame(game)` → navigate to game lobby screen
//   - `onOpenLeaderboard()` → navigate to leaderboard
//   - `onOpenAchievements()` → navigate to achievements
//   - `onOpenTournaments()` → navigate to tournaments
//   - `onOpenInvitations()` → navigate to invitations list
//   - `isBackendReady` → false until game backend is deployed (shows "Coming Soon")
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/src/context/AuthContext";
import { useGame } from "@/src/context/GameContext";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { GameType } from "@/src/api/games";

// ---------------------------------------------------------------------------
// Game catalog — static definitions (availability controlled by backend later)
// ---------------------------------------------------------------------------
const GAME_CATALOG: Array<{
  id: GameType;
  nameKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  available: boolean; // false = coming soon
}> = [
  {
    id: "chess",
    nameKey: "play_chess",
    icon: "grid-outline",
    color: "#E8C97A",
    available: true,
  },
  {
    id: "carrom",
    nameKey: "play_carrom",
    icon: "ellipse-outline",
    color: "#7AE8C9",
    available: true,
  },
  {
    id: "damma",
    nameKey: "play_damma",
    icon: "disc-outline",
    color: "#C97AE8",
    available: true,
  },
];

// ---------------------------------------------------------------------------
// PlayScreen
// ---------------------------------------------------------------------------
export default function PlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useT();
  const {
    myStats,
    dailyMissions,
    pendingInvitations,
    pendingInvitationsCount,
    totalBadgeCount,
    completedMissionsToday,
    refreshInvitations,
    refreshStats,
    refreshMissions,
    loading,
  } = useGame();

  const [refreshing, setRefreshing] = useState(false);

  // Phase 2: flip this to true once game backend is deployed
  const isBackendReady = false;

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshInvitations(), refreshStats(), refreshMissions()]);
    setRefreshing(false);
  }, [refreshInvitations, refreshStats, refreshMissions]);

  // ---------------------------------------------------------------------------
  // Navigation handlers (routes will be created in later phases)
  // ---------------------------------------------------------------------------
  const onSelectGame = useCallback(
    (gameId: GameType) => {
      // Navigate to the in-game lobby — works offline for training mode.
      router.push(`/game/lobby?game=${gameId}` as any);
    },
    [router]
  );

  const onOpenLeaderboard = useCallback(() => {
    // Phase 4: router.push("/game/leaderboard");
  }, []);

  const onOpenAchievements = useCallback(() => {
    // Phase 6: router.push("/game/achievements");
  }, []);

  const onOpenTournaments = useCallback(() => {
    // Phase 8: router.push("/game/tournaments");
  }, []);

  const onOpenInvitations = useCallback(() => {
    // Phase 3: router.push("/game/invitations");
  }, []);

  const onOpenMissions = useCallback(() => {
    // Phase 7: router.push("/game/missions");
  }, []);

  // ---------------------------------------------------------------------------
  // Render — Phase 1 placeholder (Emergent replaces this entire JSX block)
  // The data, context hooks, and handler functions above are the real output
  // of this phase. The UI below is just a functional placeholder so the tab
  // renders correctly without crashing.
  // ---------------------------------------------------------------------------
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: FUTURISTIC.bg, paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={FUTURISTIC.brand}
            colors={[FUTURISTIC.brand]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("play_hub_title")}</Text>
          <Text style={styles.headerSub}>{t("play_hub_subtitle")}</Text>
        </View>

        {/* ── Pending invitations banner ── */}
        {pendingInvitationsCount > 0 && (
          <TouchableOpacity
            style={styles.inviteBanner}
            onPress={onOpenInvitations}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[FUTURISTIC.brandSoft, "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons
              name="game-controller"
              size={20}
              color={FUTURISTIC.brand}
            />
            <Text style={styles.inviteText}>
              {pendingInvitationsCount} game{" "}
              {pendingInvitationsCount === 1 ? "invitation" : "invitations"}{" "}
              waiting
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={FUTURISTIC.textMuted}
            />
          </TouchableOpacity>
        )}

        {/* ── Game Cards ── */}
        {/* Emergent: replace this section with the final game card design */}
        <View style={styles.gamesSection}>
          {GAME_CATALOG.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={styles.gameCard}
              onPress={() => onSelectGame(game.id)}
              activeOpacity={0.85}
              disabled={!game.available}
            >
              <View style={[styles.gameIcon, { borderColor: game.color }]}>
                <Ionicons name={game.icon} size={32} color={game.color} />
              </View>
              <Text style={styles.gameName}>{t(game.nameKey)}</Text>
              {!game.available && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>
                    {t("play_coming_soon")}
                  </Text>
                </View>
              )}
              {game.available && (() => {
                const stat = myStats.find((s) => s.game_type === game.id);
                return stat ? (
                  <Text style={styles.gameRating}>
                    ★ {stat.rating} · {stat.wins}W
                  </Text>
                ) : null;
              })()}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Quick Access ── */}
        {/* Emergent: replace with final quick-access row design */}
        <View style={styles.quickRow}>
          {[
            {
              icon: "trophy-outline" as const,
              label: t("play_leaderboard"),
              onPress: onOpenLeaderboard,
            },
            {
              icon: "ribbon-outline" as const,
              label: t("play_achievements"),
              onPress: onOpenAchievements,
            },
            {
              icon: "flag-outline" as const,
              label: t("play_tournaments"),
              onPress: onOpenTournaments,
            },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.quickBtn}
              onPress={item.onPress}
              activeOpacity={0.8}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={FUTURISTIC.brand}
              />
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Daily Missions Widget ── */}
        {/* Emergent: replace with final missions widget design */}
        <TouchableOpacity
          style={styles.missionsCard}
          onPress={onOpenMissions}
          activeOpacity={0.85}
        >
          <View style={styles.missionsHeader}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={FUTURISTIC.brand}
            />
            <Text style={styles.missionsTitle}>{t("play_missions")}</Text>
          </View>
          <Text style={styles.missionsSub}>
            {dailyMissions.length === 0
              ? t("play_coming_soon")
              : `${completedMissionsToday} / ${dailyMissions.length} completed`}
          </Text>
          {dailyMissions.length > 0 && (
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      (completedMissionsToday / dailyMissions.length) * 100
                    }%`,
                  },
                ]}
              />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Loading overlay */}
      {loading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={FUTURISTIC.brand} size="large" />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — Phase 1 placeholder styles
// Emergent will override most of these with the real design system.
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: FUTURISTIC.text,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 13,
    color: FUTURISTIC.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  inviteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: FUTURISTIC.brand,
    overflow: "hidden",
  },
  inviteText: {
    flex: 1,
    color: FUTURISTIC.text,
    fontSize: 14,
    fontWeight: "700",
  },
  gamesSection: {
    flexDirection: "row",
    gap: 12,
  },
  gameCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: FUTURISTIC.layer2,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: FUTURISTIC.border,
  },
  gameIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FUTURISTIC.layer3,
  },
  gameName: {
    color: FUTURISTIC.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  comingSoonBadge: {
    backgroundColor: FUTURISTIC.layer3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    color: FUTURISTIC.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  gameRating: {
    color: FUTURISTIC.brand,
    fontSize: 11,
    fontWeight: "700",
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: FUTURISTIC.layer2,
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: FUTURISTIC.border,
  },
  quickLabel: {
    color: FUTURISTIC.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  missionsCard: {
    backgroundColor: FUTURISTIC.layer2,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: FUTURISTIC.border,
  },
  missionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  missionsTitle: {
    color: FUTURISTIC.text,
    fontSize: 15,
    fontWeight: "800",
  },
  missionsSub: {
    color: FUTURISTIC.textMuted,
    fontSize: 13,
  },
  progressBar: {
    height: 4,
    backgroundColor: FUTURISTIC.layer3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: FUTURISTIC.brand,
    borderRadius: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});
