// /app/frontend/app/(tabs)/home.tsx
//
// PARTY4R — Home / Rooms screen (futuristic redesign).
//
// Hero section:
//   • Welcome with neon-glowing greeting + futuristic letter-spaced title.
//   • Subtle ambient LightBeam sweeps in the background (purple + green).
//   • Top metallic glow divider.
//
// Room list:
//   • MetallicCard wrappers with iridescent borders.
//   • Animated liveBadge (pulsing dot when active).
//   • Glow on the host avatar ring when room is active.
//
// Empty state:
//   • Centered icon in a metallic ring + NeonButton CTA.
//
// FAB: floating neon "+" with persistent soft glow and chrome edge.

import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAuth } from "@/src/context/AuthContext";
import { apiGet } from "@/src/api/client";
import { getAvatarUrl } from "@/src/constants/avatars";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC, GRADIENTS, SHADOWS, TYPO } from "@/src/theme/futuristic";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import GlowDivider from "@/src/components/futuristic/GlowDivider";
import LightBeam from "@/src/components/futuristic/LightBeam";
import NeonButton from "@/src/components/futuristic/NeonButton";
import { useEffect } from "react";

const { width: SCREEN_W } = Dimensions.get("window");

interface Room {
  id: string;
  name: string;
  host_id: string;
  host_nickname: string;
  host_avatar: string;
  is_public: boolean;
  has_password: boolean;
  video_url?: string | null;
  member_count: number;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Live indicator — pulsing green dot when room has members
// ----------------------------------------------------------------------------
function LiveDot({ active }: { active: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [v, active]);
  const s = useAnimatedStyle(() => ({
    opacity: active ? 0.4 + v.value * 0.6 : 1,
    transform: [{ scale: active ? 0.92 + v.value * 0.18 : 1 }],
  }));
  return (
    <Animated.View
      style={[
        styles.liveDot,
        active && {
          backgroundColor: FUTURISTIC.brand,
          shadowColor: FUTURISTIC.brand,
          shadowOpacity: 0.95,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        },
        s,
      ]}
    />
  );
}

// ----------------------------------------------------------------------------
// FAB — Floating create-room button with persistent glow
// ----------------------------------------------------------------------------
function CreateFab({ onPress }: { onPress: () => void }) {
  const pulse = useSharedValue(0);
  const pressedScale = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.10 }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressedScale.value }],
  }));
  return (
    <Pressable
      testID="create-room-fab"
      onPress={onPress}
      onPressIn={() => (pressedScale.value = withTiming(0.92, { duration: 90 }))}
      onPressOut={() => (pressedScale.value = withTiming(1, { duration: 140 }))}
    >
      <Animated.View pointerEvents="none" style={[styles.fabGlow, glowStyle]} />
      <Animated.View style={innerStyle}>
        <LinearGradient
          colors={["rgba(255,255,255,0.55)", "rgba(34,255,136,0.55)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 28, padding: 1 }}
        >
          <LinearGradient
            colors={["#26FF93", "#10C66D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.fab}
          >
            <Ionicons name="add" size={28} color="#001A0C" />
          </LinearGradient>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ----------------------------------------------------------------------------
// HomeScreen
// ----------------------------------------------------------------------------
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<Room[]>("/rooms/public");
      setRooms(data);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const renderRoom = ({ item }: { item: Room }) => {
    const active = item.member_count > 0;
    return (
      <TouchableOpacity
        testID={`room-card-${item.id}`}
        onPress={() => router.push(`/room/${item.id}` as any)}
        activeOpacity={0.85}
        style={{ marginBottom: 14 }}
      >
        <MetallicCard accent={active ? "green" : "neutral"} radius={FUTURISTIC.radius.lg} padding={14}>
          <View style={styles.roomHeader}>
            {/* Avatar with subtle gradient ring */}
            <LinearGradient
              colors={
                active
                  ? ["rgba(34,255,136,0.85)", "rgba(168,85,247,0.45)"]
                  : ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <Image
                source={{ uri: getAvatarUrl(item.host_avatar) }}
                style={styles.hostAvatar}
              />
            </LinearGradient>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.roomHost} numberOfLines={1}>
                {t("hosted_by") || "Hosted by"} {item.host_nickname}
              </Text>
            </View>

            <View style={[styles.liveBadge, active && styles.liveBadgeActive]}>
              <LiveDot active={active} />
              <Text style={[styles.liveText, active && { color: FUTURISTIC.brand }]}>
                {item.member_count}
              </Text>
            </View>
          </View>

          {/* Footer divider with shimmer */}
          <View style={{ marginTop: 12 }}>
            <GlowDivider
              color={active ? FUTURISTIC.brand : "rgba(255,255,255,0.15)"}
              speed={active ? 3600 : 6500}
              style={{ opacity: 0.9 }}
            />
          </View>

          <View style={styles.roomFooter}>
            <Ionicons
              name={item.video_url ? "play-circle" : "tv-outline"}
              size={16}
              color={item.video_url ? FUTURISTIC.brand : FUTURISTIC.textSecondary}
            />
            <Text style={styles.roomMeta} numberOfLines={1}>
              {item.video_url ? (t("playing_video") || "Playing video") : (t("waiting_for_host") || "Waiting for host")}
            </Text>
            <View style={{ flex: 1 }} />
            {item.has_password && (
              <Ionicons name="lock-closed" size={13} color={FUTURISTIC.textMuted} />
            )}
            <Ionicons name="chevron-forward" size={16} color={FUTURISTIC.textMuted} />
          </View>
        </MetallicCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safeBg}>
      {/* App background gradient (deep space) */}
      <LinearGradient
        colors={GRADIENTS.appBg as unknown as string[]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient light beams */}
      <LightBeam
        angle={-22}
        color="rgba(34,255,136,0.16)"
        speed={9000}
        delay={0}
        thickness={220}
        intensity={0.5}
      />
      <LightBeam
        angle={18}
        color="rgba(168,85,247,0.13)"
        speed={11000}
        delay={2200}
        thickness={200}
        intensity={0.45}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Hero header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {t("hey") || "Hey"} <Text style={styles.greetingName}>{user?.nickname}</Text>
            </Text>
            <Text style={styles.title}>{(t("public_rooms") || "Public Rooms").toUpperCase()}</Text>
          </View>
          <CreateFab onPress={() => router.push("/create-room")} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <GlowDivider color={FUTURISTIC.brand} speed={5200} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={FUTURISTIC.brand} />
            <Text style={styles.loadingText}>SYNCING ROOMS…</Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(r) => r.id}
            renderItem={renderRoom}
            contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: 120 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={FUTURISTIC.brand}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty} testID="empty-rooms-state">
                <View style={styles.emptyIconRing}>
                  <Ionicons name="tv-outline" size={42} color={FUTURISTIC.brand} />
                </View>
                <Text style={styles.emptyTitle}>{t("no_rooms") || "No active rooms"}</Text>
                <Text style={styles.emptySub}>
                  {t("be_first") || "Be the first to start a watch party"}
                </Text>
                <NeonButton
                  testID="empty-create-btn"
                  label={t("create_room") || "Create Room"}
                  leftIcon="add-circle"
                  size="lg"
                  onPress={() => router.push("/create-room")}
                  style={{ marginTop: 24 }}
                />
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeBg: { flex: 1, backgroundColor: FUTURISTIC.bg },
  // ---------------------- Header ----------------------
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  greeting: {
    color: FUTURISTIC.textSecondary,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
  greetingName: {
    color: FUTURISTIC.brand,
    fontWeight: "900",
    textShadowColor: FUTURISTIC.brandGlow,
    textShadowRadius: 8,
  },
  title: {
    ...TYPO.display,
    color: FUTURISTIC.textPrimary,
    textShadowColor: "rgba(34,255,136,0.25)",
    textShadowRadius: 12,
  },
  // ---------------------- FAB ----------------------
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fabGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    top: -12,
    left: -12,
    backgroundColor: "rgba(34,255,136,0.30)",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.95,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  // ---------------------- Loading ----------------------
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
  // ---------------------- Room cards ----------------------
  roomHeader: { flexDirection: "row", alignItems: "center" },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 14,
    padding: 2,
  },
  hostAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface2,
  },
  roomName: {
    color: FUTURISTIC.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  roomHost: {
    color: FUTURISTIC.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: FUTURISTIC.surface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
  },
  liveBadgeActive: {
    borderColor: FUTURISTIC.brandEdge,
    backgroundColor: FUTURISTIC.brandSoft,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: FUTURISTIC.textDisabled },
  liveText: {
    color: FUTURISTIC.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  roomFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  roomMeta: {
    color: FUTURISTIC.textSecondary,
    fontSize: 12,
    letterSpacing: 0.4,
    fontWeight: "600",
  },
  // ---------------------- Empty state ----------------------
  empty: { alignItems: "center", padding: 32, marginTop: 16 },
  emptyIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: FUTURISTIC.surface1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    ...SHADOWS.glowBrand,
  },
  emptyTitle: {
    color: FUTURISTIC.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 22,
    letterSpacing: 0.6,
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
