import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/context/AuthContext";
import { AVATARS, COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { BANNERS, BADGES, getBanner } from "@/src/constants/customization";
import { storage } from "@/src/utils/storage";
import { TOKEN_KEY, API_BASE } from "@/src/api/client";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC, TYPO, GRADIENTS } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import GlowDivider from "@/src/components/futuristic/GlowDivider";
import { LinearGradient } from "expo-linear-gradient";
import { loadAllStats, GameStats, winRate } from "@/src/games/stats";
import { GAME_LIST, getGame } from "@/src/games/registry";
import { rankForPoints, RANKS } from "@/src/games/ranks";
import RankBadge from "@/src/games/shared/ui/RankBadge";

function formatMemberSince(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatHours(s: number): string {
  if (!s || s < 60) return "<1m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

async function patchProfile(qs: string) {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return fetch(`${API_BASE}/auth/profile?${qs}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function patchProfileBody(body: object) {
  // For long body fields like bio + avatar_image we use querystring still per backend
  const params = new URLSearchParams(body as any).toString();
  return patchProfile(params);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [gameStats, setGameStats] = useState<GameStats[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      loadAllStats(user?.id || "guest", GAME_LIST.map((g) => g.id))
        .then(setGameStats)
        .catch(() => {});
    }, [refresh, user?.id])
  );

  const banner = getBanner(user?.banner_id);
  const userBadges = user?.badges || [];
  const avatarSrc = user?.avatar_image || getAvatarUrl(user?.avatar || "");

  const selectAvatar = async (avatarId: string) => {
    if (!user || (avatarId === user.avatar && !user.avatar_image)) return;
    setBusy(true);
    // also clear avatar_image when picking preset
    await patchProfileBody({ avatar: avatarId, avatar_image: "" });
    await refresh();
    setBusy(false);
  };

  const uploadFromGallery = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      granted = (await ImagePicker.requestMediaLibraryPermissionsAsync()).granted;
    }
    if (!granted) {
      Alert.alert(
        t("gallery_access_needed"),
        t("gallery_access_msg_profile"),
        [
          { text: t("cancel"), style: "cancel" },
          { text: t("open_settings"), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.4,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const a = res.assets[0];
    const dataUri = `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
    if (dataUri.length > 700_000) {
      Alert.alert(t("image_too_large"), t("pick_under_500kb"));
      return;
    }
    setBusy(true);
    await patchProfileBody({ avatar_image: dataUri });
    await refresh();
    setBusy(false);
  };

  const setBanner = async (id: string) => {
    setBusy(true);
    await patchProfileBody({ banner_id: id });
    await refresh();
    setBusy(false);
  };

  const toggleBadge = async (id: string) => {
    setBusy(true);
    await patchProfileBody({ badge: id });
    await refresh();
    setBusy(false);
  };

  const saveBio = async () => {
    setBusy(true);
    await patchProfileBody({ bio: bioDraft });
    await refresh();
    setBusy(false);
    setEditingBio(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Floating Settings gear (top-right) */}
      <TouchableOpacity
        testID="profile-settings-gear"
        onPress={() => router.push("/settings")}
        style={styles.gearBtn}
        activeOpacity={0.85}
      >
        <Ionicons name="settings-outline" size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Banner */}
        <View
          style={[
            styles.bannerWrap,
            { backgroundColor: banner.colors[1] },
          ]}
          testID="profile-banner"
        >
          <View
            style={[
              styles.bannerOverlay,
              { backgroundColor: banner.colors[0], opacity: 0.5 },
            ]}
          />
        </View>

        {/* Avatar overlay */}
        <View style={styles.avatarRow}>
          <TouchableOpacity
            testID="profile-avatar-btn"
            onPress={uploadFromGallery}
            style={styles.avatarLg}
          >
            <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={14} color={COLORS.bg} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", marginTop: 8 }}>
          <Text style={styles.nickname} testID="profile-nickname">
            {user?.nickname}
          </Text>
          <Text style={styles.username} testID="profile-username">
            @{user?.username}
          </Text>

          {/* Badges row */}
          {userBadges.length > 0 && (
            <View style={styles.badgesRow} testID="profile-badges">
              {userBadges.map((bid) => {
                const b = BADGES.find((x) => x.id === bid);
                if (!b) return null;
                return (
                  <View key={bid} style={[styles.badgePill, { borderColor: b.color }]}>
                    <Ionicons name={b.icon as any} size={12} color={b.color} />
                    <Text style={[styles.badgePillText, { color: b.color }]}>
                      {b.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard} testID="stat-member-since">
              <Text style={styles.statLabel}>{t("member_since")}</Text>
              <Text style={styles.statValue}>
                {formatMemberSince(user?.created_at)}
              </Text>
            </View>
            <View style={styles.statCard} testID="stat-hours-spent">
              <Text style={styles.statLabel}>{t("total_hours")}</Text>
              <Text style={styles.statValue}>
                {formatHours(user?.total_seconds || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t("bio")}</Text>
            {!editingBio && (
              <TouchableOpacity
                testID="bio-edit"
                onPress={() => {
                  setBioDraft(user?.bio || "");
                  setEditingBio(true);
                }}
              >
                <Text style={styles.editLink}>{t("edit").toUpperCase()}</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingBio ? (
            <>
              <TextInput
                testID="bio-input"
                value={bioDraft}
                onChangeText={setBioDraft}
                placeholder={t("bio_placeholder")}
                placeholderTextColor={COLORS.textDisabled}
                multiline
                maxLength={280}
                style={styles.bioInput}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  testID="bio-cancel"
                  onPress={() => setEditingBio(false)}
                  style={styles.btnGhost}
                >
                  <Text style={styles.btnGhostText}>{t("cancel").toUpperCase()}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="bio-save"
                  onPress={saveBio}
                  style={styles.btnSolid}
                >
                  <Text style={styles.btnSolidText}>{t("save").toUpperCase()}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.bioText} testID="bio-text">
              {user?.bio || t("bio_empty")}
            </Text>
          )}
        </View>

        {/* Avatar selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("preset_avatars")}</Text>
          <View style={styles.grid}>
            {AVATARS.map((a) => (
              <TouchableOpacity
                key={a.id}
                testID={`profile-avatar-${a.id}`}
                onPress={() => selectAvatar(a.id)}
                disabled={busy}
                style={[
                  styles.tile72,
                  user?.avatar === a.id && !user?.avatar_image && styles.tileActive,
                ]}
              >
                <Image source={{ uri: a.url }} style={styles.tileImg} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Banners */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("profile_banner")}</Text>
          <View style={styles.grid}>
            {BANNERS.map((b) => (
              <TouchableOpacity
                key={b.id}
                testID={`banner-${b.id}`}
                onPress={() => setBanner(b.id)}
                disabled={busy}
                style={[
                  styles.bannerTile,
                  user?.banner_id === b.id && styles.tileActive,
                  { backgroundColor: b.colors[1] },
                ]}
              >
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: b.colors[0],
                      opacity: 0.5,
                      borderRadius: 12,
                    },
                  ]}
                />
                <Text style={styles.bannerName}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Games — unified per-game stats + rank */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("games_label") || "الألعاب"}</Text>
          {gameStats.filter((s) => s.games > 0).length === 0 ? (
            <View style={styles.gamesEmpty}>
              <Ionicons name="game-controller-outline" size={26} color={FUTURISTIC.textMuted} />
              <Text style={styles.gamesEmptyText}>
                {t("no_games_yet") || "لم تلعب أي مباراة بعد — ابدأ من قسم العب!"}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {gameStats
                .filter((s) => s.games > 0)
                .sort((a, b) => b.rankPoints - a.rankPoints)
                .map((s) => {
                  const def = getGame(s.game);
                  const rank = rankForPoints(s.rankPoints);
                  const peak = RANKS.find((r) => r.id === s.peakRankId) || RANKS[0];
                  const wr = Math.round(winRate(s) * 100);
                  return (
                    <View key={s.game} style={styles.gameStatCard}>
                      <Image source={def?.logo} style={styles.gameStatLogo} resizeMode="cover" />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.gameStatTopRow}>
                          <Text style={styles.gameStatName}>{def ? t(def.nameKey) : s.game}</Text>
                          <RankBadge rankId={rank.id} points={s.rankPoints} size="sm" />
                        </View>
                        <Text style={styles.gameStatLine}>
                          {s.games} {t("matches") || "مباراة"} · {s.wins}{t("wins_short") || "ف"} / {s.losses}{t("losses_short") || "خ"} · {wr}% {t("winrate_short") || "فوز"}
                        </Text>
                        <Text style={styles.gameStatPeak}>
                          {t("peak_rank") || "أعلى رتبة"}: {peak.nameAr}
                          {s.currentStreak > 1 ? `  ·  🔥 ${s.currentStreak}` : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("badges_label")}</Text>
          <View style={styles.grid}>
            {BADGES.map((b) => {
              const active = userBadges.includes(b.id);
              return (
                <TouchableOpacity
                  key={b.id}
                  testID={`badge-${b.id}`}
                  onPress={() => toggleBadge(b.id)}
                  disabled={busy}
                  style={[
                    styles.badgeTile,
                    active && { borderColor: b.color, borderWidth: 2 },
                  ]}
                >
                  <Ionicons
                    name={b.icon as any}
                    size={22}
                    color={active ? b.color : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.badgeTileText,
                      active && { color: b.color },
                    ]}
                  >
                    {b.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
          <Text style={styles.logoutText}>{t("log_out")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FUTURISTIC.bg },
  gearBtn: {
    position: "absolute",
    top: 10,
    right: 14,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(10, 12, 22, 0.92)",
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  bannerWrap: { height: 150, position: "relative" },
  bannerOverlay: { ...StyleSheet.absoluteFillObject },
  avatarRow: { alignItems: "center", marginTop: -54 },
  avatarLg: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: FUTURISTIC.brand,
    backgroundColor: FUTURISTIC.surface1,
    overflow: "visible",
    position: "relative",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.65,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 54 },
  avatarEdit: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: FUTURISTIC.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: FUTURISTIC.bg,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.85,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  nickname: {
    ...TYPO.h1,
    color: FUTURISTIC.textPrimary,
    marginTop: 10,
    textShadowColor: FUTURISTIC.brandSoft,
    textShadowRadius: 8,
  },
  username: {
    color: FUTURISTIC.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 16,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  badgePillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    width: "100%",
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  statLabel: {
    color: FUTURISTIC.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  statValue: {
    color: FUTURISTIC.brand,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.3,
    textShadowColor: FUTURISTIC.brandGlow,
    textShadowRadius: 6,
  },
  section: { paddingHorizontal: 20, marginTop: 24 },
  gamesEmpty: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: FUTURISTIC.surface1, borderRadius: 14, borderWidth: 1, borderColor: FUTURISTIC.borderSoft, padding: 14 },
  gamesEmptyText: { flex: 1, color: FUTURISTIC.textMuted, fontSize: 13, fontWeight: "600" },
  gameStatCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: FUTURISTIC.surface1, borderRadius: 16, borderWidth: 1, borderColor: FUTURISTIC.borderSoft, padding: 10 },
  gameStatLogo: { width: 52, height: 52, borderRadius: 12, backgroundColor: FUTURISTIC.surface2 },
  gameStatTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  gameStatName: { color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "900", flexShrink: 1 },
  gameStatLine: { color: FUTURISTIC.textSecondary, fontSize: 12, fontWeight: "600" },
  gameStatPeak: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    color: FUTURISTIC.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  editLink: {
    color: FUTURISTIC.brand,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  bioText: {
    color: FUTURISTIC.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: FUTURISTIC.surface1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    letterSpacing: 0.2,
  },
  bioInput: {
    color: FUTURISTIC.textPrimary,
    fontSize: 14,
    backgroundColor: FUTURISTIC.surface1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FUTURISTIC.brand,
    minHeight: 80,
    textAlignVertical: "top",
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGhostText: {
    color: COLORS.textSecondary,
    fontWeight: "800",
    letterSpacing: 1,
  },
  btnSolid: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: COLORS.brand,
  },
  btnSolidText: { color: COLORS.bg, fontWeight: "800", letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile72: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 4,
  },
  tileActive: { borderColor: COLORS.brand },
  tileImg: { width: "100%", height: "100%", borderRadius: 10 },
  bannerTile: {
    width: 100,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerName: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    zIndex: 2,
  },
  badgeTile: {
    width: 100,
    height: 76,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  badgeTileText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
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
    marginHorizontal: 20,
    marginTop: 28,
  },
  logoutText: { color: COLORS.error, fontWeight: "800", letterSpacing: 1 },
});
