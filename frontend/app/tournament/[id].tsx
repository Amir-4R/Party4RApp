// /app/frontend/app/tournament/[id].tsx
// =============================================================================
// PARTY4R — Tournament details + Bracket viewer.
// =============================================================================
// • Header with title, status, prize, host info.
// • Participants list with avatars.
// • Bracket view organized by rounds (horizontal scroll for many rounds).
// • Host-only "Start Tournament" button when status=open and 2+ players.
// • Host-only "Submit Score" tap on running match cards.
// • Winner celebration banner when finished.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet, apiPost } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/context/LanguageContext";
import { getAvatarUrl } from "@/src/constants/avatars";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import MetallicCard from "@/src/components/futuristic/MetallicCard";

interface Participant {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  avatar_image?: string | null;
}

interface Tournament {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "running" | "finished";
  max_players: number;
  participants: string[];
  participants_info: Participant[];
  prize?: string | null;
  starts_at?: string | null;
  created_by: string;
  host?: Participant;
  winner_id?: string | null;
  winner?: Participant;
}

interface Match {
  id: string;
  round: number;
  match_number: number;
  player1_id?: string | null;
  player2_id?: string | null;
  player1?: Participant | null;
  player2?: Participant | null;
  winner_id?: string | null;
  score_p1: number;
  score_p2: number;
  finished: boolean;
}

interface BracketRound {
  round: number;
  matches: Match[];
}

interface Bracket {
  tournament_id: string;
  status: string;
  winner_id?: string | null;
  rounds: BracketRound[];
}

const STATUS_COLOR: Record<string, string> = {
  open: FUTURISTIC.brand,
  running: "#FF8A50",
  finished: FUTURISTIC.textMuted,
};

function PlayerSlot({
  player,
  isWinner,
  score,
  onPress,
  highlight,
}: {
  player?: Participant | null;
  isWinner?: boolean;
  score?: number;
  onPress?: () => void;
  highlight?: boolean;
}) {
  const empty = !player;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || empty}
      style={[
        styles.slot,
        highlight && styles.slotHighlight,
        isWinner && styles.slotWinner,
        empty && styles.slotEmpty,
      ]}
    >
      {empty ? (
        <Text style={styles.slotBye}>—</Text>
      ) : (
        <>
          <Image
            source={{ uri: getAvatarUrl(player!.avatar) }}
            style={styles.slotAvatar}
          />
          <Text
            style={[styles.slotName, isWinner && { color: FUTURISTIC.brand, fontWeight: "900" }]}
            numberOfLines={1}
          >
            {player!.nickname || player!.username}
          </Text>
          {typeof score === "number" && (
            <Text style={[styles.slotScore, isWinner && { color: FUTURISTIC.brand }]}>
              {score}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

function MatchCard({
  match,
  isHost,
  tournamentStatus,
  onScore,
}: {
  match: Match;
  isHost: boolean;
  tournamentStatus: string;
  onScore: (m: Match) => void;
}) {
  const canScore =
    isHost &&
    tournamentStatus === "running" &&
    !match.finished &&
    match.player1_id &&
    match.player2_id;

  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchNumber}>M{match.match_number}</Text>
      <PlayerSlot
        player={match.player1}
        isWinner={match.finished && match.winner_id === match.player1_id}
        score={match.finished ? match.score_p1 : undefined}
        onPress={canScore ? () => onScore(match) : undefined}
        highlight={!!canScore}
      />
      <View style={styles.vsRow}>
        <Text style={styles.vsText}>vs</Text>
      </View>
      <PlayerSlot
        player={match.player2}
        isWinner={match.finished && match.winner_id === match.player2_id}
        score={match.finished ? match.score_p2 : undefined}
        onPress={canScore ? () => onScore(match) : undefined}
        highlight={!!canScore}
      />
      {canScore && (
        <Text style={styles.tapHint}>Tap a player to declare winner</Text>
      )}
    </View>
  );
}

export default function TournamentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();

  const [tour, setTour] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const tdata = await apiGet<Tournament>(`/tournaments/${id}`);
      setTour(tdata);
      if (tdata.status !== "open") {
        const bdata = await apiGet<Bracket>(`/tournaments/${id}/bracket`);
        setBracket(bdata);
      } else {
        setBracket(null);
      }
    } catch (e) {
      // noop
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Smart polling: refresh every 5s while screen is focused AND the
  // tournament is not finished (no point polling completed brackets).
  useFocusEffect(
    useCallback(() => {
      if (!tour || tour.status === "finished") return;
      const interval = setInterval(() => { load(); }, 5000);
      return () => clearInterval(interval);
    }, [tour?.status, load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const isHost = !!tour && user?.id === tour.created_by;
  const isJoined = !!tour && !!user && tour.participants.includes(user.id);

  const onJoin = async () => {
    if (!tour) return;
    setBusy(true);
    try {
      await apiPost(`/tournaments/${tour.id}/join`, {});
      load();
    } catch (e: any) {
      Alert.alert(t("err_title"), e?.message || "Failed to join");
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    if (!tour) return;
    setBusy(true);
    try {
      await apiPost(`/tournaments/${tour.id}/leave`, {});
      load();
    } catch (e: any) {
      Alert.alert(t("err_title"), e?.message || "Failed to leave");
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (!tour) return;
    setBusy(true);
    try {
      await apiPost(`/tournaments/${tour.id}/start`, {});
      load();
    } catch (e: any) {
      Alert.alert(t("err_title"), e?.message || "Failed to start");
    } finally {
      setBusy(false);
    }
  };

  const onScoreMatch = (m: Match) => {
    if (!tour) return;
    Alert.alert(
      t("tour_score_title"),
      `${m.player1?.nickname || "Player 1"} vs ${m.player2?.nickname || "Player 2"}`,
      [
        {
          text: m.player1?.nickname || "Player 1",
          onPress: () => submitScore(m, m.player1_id!),
        },
        {
          text: m.player2?.nickname || "Player 2",
          onPress: () => submitScore(m, m.player2_id!),
        },
        { text: t("cancel"), style: "cancel" },
      ],
    );
  };

  const submitScore = async (m: Match, winner_id: string) => {
    if (!tour) return;
    setBusy(true);
    try {
      await apiPost(`/tournaments/${tour.id}/matches/${m.id}/score`, {
        winner_id,
        score_p1: m.player1_id === winner_id ? 1 : 0,
        score_p2: m.player2_id === winner_id ? 1 : 0,
      });
      load();
    } catch (e: any) {
      Alert.alert(t("err_title"), e?.message || "Failed to submit score");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.bg, { alignItems: "center", justifyContent: "center" }]}>
        <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={FUTURISTIC.brand} />
      </View>
    );
  }

  if (!tour) {
    return (
      <View style={[styles.bg, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: FUTURISTIC.textMuted }}>{t("tour_not_found")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-20} color={FUTURISTIC.brandSoft} speed={12000} thickness={200} intensity={0.5} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
          </Pressable>
          {tour.status === "running" && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { borderColor: STATUS_COLOR[tour.status] + "55", backgroundColor: STATUS_COLOR[tour.status] + "15" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[tour.status] }]}>
              {tour.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FUTURISTIC.brand} />
          }
        >
          {/* Winner celebration banner */}
          {tour.status === "finished" && tour.winner && (
            <MetallicCard accent="purple" radius={FUTURISTIC.radius.lg} padding={16}>
              <View style={styles.winnerRow}>
                <Ionicons name="trophy" size={42} color="#FFD86B" />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.winnerKicker}>{t("tour_champion")}</Text>
                  <Text style={styles.winnerName}>{tour.winner.nickname || tour.winner.username}</Text>
                  <Text style={styles.winnerHandle}>@{tour.winner.username}</Text>
                </View>
                <Image source={{ uri: getAvatarUrl(tour.winner.avatar) }} style={styles.winnerAvatar} />
              </View>
            </MetallicCard>
          )}

          {/* Title block */}
          <View style={{ marginTop: tour.status === "finished" ? 16 : 0 }}>
            <Text style={styles.title}>{tour.title}</Text>
            {!!tour.description && (
              <Text style={styles.desc}>{tour.description}</Text>
            )}
            <View style={styles.infoRow}>
              {!!tour.prize && (
                <View style={styles.infoPill}>
                  <Ionicons name="gift" size={12} color="#FFD86B" />
                  <Text style={styles.infoText}>{tour.prize}</Text>
                </View>
              )}
              <View style={styles.infoPill}>
                <Ionicons name="people" size={12} color={FUTURISTIC.brand} />
                <Text style={styles.infoText}>
                  {tour.participants.length}/{tour.max_players}
                </Text>
              </View>
              {!!tour.host && (
                <View style={styles.infoPill}>
                  <Ionicons name="person-circle-outline" size={12} color={FUTURISTIC.accentGlow} />
                  <Text style={styles.infoText}>{tour.host.nickname || tour.host.username}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Action buttons */}
          {tour.status === "open" && (
            <View style={styles.actions}>
              {isHost ? (
                <Pressable
                  onPress={onStart}
                  disabled={busy || tour.participants.length < 2}
                  style={[styles.cta, (busy || tour.participants.length < 2) && { opacity: 0.55 }]}
                >
                  {busy ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Ionicons name="play" size={16} color="#000" />
                      <Text style={styles.ctaText}>{t("tour_start")}</Text>
                    </>
                  )}
                </Pressable>
              ) : isJoined ? (
                <Pressable onPress={onLeave} disabled={busy} style={[styles.ctaSecondary, busy && { opacity: 0.55 }]}>
                  <Text style={styles.ctaSecondaryText}>{t("tour_leave")}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={onJoin} disabled={busy || tour.participants.length >= tour.max_players} style={[styles.cta, busy && { opacity: 0.55 }]}>
                  {busy ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Ionicons name="enter" size={16} color="#000" />
                      <Text style={styles.ctaText}>{t("tour_join")}</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}

          {/* Participants list (when open) */}
          {tour.status === "open" && tour.participants_info && tour.participants_info.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("tour_participants")}</Text>
              <View style={styles.participantsGrid}>
                {tour.participants_info.map((p) => (
                  <View key={p.id} style={styles.participantChip}>
                    <Image source={{ uri: getAvatarUrl(p.avatar) }} style={styles.chipAvatar} />
                    <Text style={styles.chipName} numberOfLines={1}>
                      {p.nickname || p.username}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bracket */}
          {bracket && bracket.rounds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("tour_bracket")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.bracketRow}>
                  {bracket.rounds.map((r) => (
                    <View key={r.round} style={styles.roundColumn}>
                      <Text style={styles.roundLabel}>
                        {r.round === bracket.rounds.length ? t("tour_final") : `${t("tour_round")} ${r.round}`}
                      </Text>
                      {r.matches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          isHost={isHost}
                          tournamentStatus={tour.status}
                          onScore={onScoreMatch}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
    borderRadius: 14, backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    borderColor: "#FF8A5055",
    backgroundColor: "#FF8A5015",
    marginLeft: "auto", marginRight: 8,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#FF8A50",
    shadowColor: "#FF8A50", shadowOpacity: 0.8, shadowRadius: 6,
  },
  liveText: {
    color: "#FF8A50", fontSize: 10, fontWeight: "900", letterSpacing: 1.4,
  },
  title: {
    color: FUTURISTIC.textPrimary, fontSize: 26, fontWeight: "900",
    letterSpacing: -0.5,
    textShadowColor: FUTURISTIC.brandSoft, textShadowRadius: 10,
  },
  desc: { color: FUTURISTIC.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 19 },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  infoPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: FUTURISTIC.surface1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  infoText: { color: FUTURISTIC.textSecondary, fontSize: 11, fontWeight: "700" },
  actions: { marginTop: 18 },
  cta: {
    paddingVertical: 14, borderRadius: 12, backgroundColor: FUTURISTIC.brand,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: FUTURISTIC.brand, shadowOpacity: 0.5, shadowRadius: 12,
  },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 0.7 },
  ctaSecondary: {
    paddingVertical: 14, borderRadius: 12, backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft, alignItems: "center",
  },
  ctaSecondaryText: { color: FUTURISTIC.textPrimary, fontWeight: "800", fontSize: 14 },
  section: { marginTop: 24 },
  sectionLabel: {
    color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "900",
    letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 12,
  },
  participantsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  participantChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: FUTURISTIC.surface1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  chipAvatar: { width: 22, height: 22, borderRadius: 11 },
  chipName: { color: FUTURISTIC.textPrimary, fontSize: 12, fontWeight: "700", maxWidth: 100 },
  bracketRow: { flexDirection: "row", gap: 16, paddingRight: 20 },
  roundColumn: { width: 200, gap: 10 },
  roundLabel: {
    color: FUTURISTIC.brand, fontSize: 11, fontWeight: "900",
    letterSpacing: 1.4, marginBottom: 4, textAlign: "center",
  },
  matchCard: {
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    borderRadius: 10, padding: 8, position: "relative",
  },
  matchNumber: {
    position: "absolute", top: 6, right: 8,
    fontSize: 9, fontWeight: "800", color: FUTURISTIC.textMuted, letterSpacing: 0.5,
  },
  slot: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 6, backgroundColor: FUTURISTIC.surface2,
    minHeight: 36,
  },
  slotEmpty: { opacity: 0.5 },
  slotHighlight: {
    borderWidth: 1, borderColor: FUTURISTIC.brandEdge,
  },
  slotWinner: {
    backgroundColor: FUTURISTIC.brand + "20",
    borderWidth: 1, borderColor: FUTURISTIC.brand,
  },
  slotAvatar: { width: 22, height: 22, borderRadius: 11 },
  slotName: { color: FUTURISTIC.textPrimary, fontSize: 12, fontWeight: "700", flex: 1 },
  slotScore: {
    color: FUTURISTIC.textSecondary, fontSize: 13, fontWeight: "900",
    minWidth: 18, textAlign: "right",
  },
  slotBye: { color: FUTURISTIC.textMuted, fontSize: 12, fontStyle: "italic" },
  vsRow: { alignItems: "center", paddingVertical: 2 },
  vsText: { color: FUTURISTIC.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  tapHint: {
    color: FUTURISTIC.brand, fontSize: 9, fontWeight: "700",
    textAlign: "center", marginTop: 4, letterSpacing: 0.5,
  },
  winnerRow: { flexDirection: "row", alignItems: "center" },
  winnerKicker: {
    color: "#FFD86B", fontSize: 10, fontWeight: "900",
    letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
  },
  winnerName: { color: FUTURISTIC.textPrimary, fontSize: 20, fontWeight: "900" },
  winnerHandle: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 2 },
  winnerAvatar: { width: 56, height: 56, borderRadius: 28 },
});
