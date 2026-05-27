// /app/frontend/src/components/VotingOverlay.tsx
//
// Phase 4 voting UI — redesigned for the futuristic cyber-metallic theme.
// Self-contained overlay shown over the room while a vote is active.
//
// Visual notes:
//  - Glass blur backdrop with chrome iridescent top edge.
//  - Animated progress bar with neon-green fill + soft glow.
//  - YES button uses NeonButton (primary brand), NO button uses NeonButton (danger).
//  - Letter-spaced caps headers for "VOTE TO SKIP" / "VOTE — PLAY NEXT".
//  - Slide-in from top + subtle scale settle.

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";
import { FUTURISTIC, SHADOWS, TYPO } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

export interface ActiveVote {
  id: string;
  kind: "skip" | "next";
  initiator: string;
  video_id?: string;
  video_url?: string;
  title?: string;
  yes: number;
  no: number;
  required: number;
  member_count: number;
  remaining_seconds: number;
}

interface Props {
  vote: ActiveVote;
  myUserId: string;
  myVote?: boolean | null;
  isHost: boolean;
  onCast: (yes: boolean) => void;
  onCancel: () => void;
}

export default function VotingOverlay({
  vote,
  myUserId,
  myVote,
  isHost,
  onCast,
  onCancel,
}: Props) {
  const { t } = useT();
  const [remaining, setRemaining] = useState(vote.remaining_seconds);
  const translateY = useSharedValue(-200);
  const opacity = useSharedValue(0);
  const progressW = useSharedValue(0);

  // ---- Animations on mount + on each new vote ID ----
  useEffect(() => {
    translateY.value = withSequence(
      withTiming(-200, { duration: 0 }),
      withSpring(0, { damping: 16, stiffness: 130 })
    );
    opacity.value = withTiming(1, { duration: 320 });
  }, [vote.id, translateY, opacity]);

  // ---- Animate progress bar fill on yes/required change ----
  useEffect(() => {
    const ratio = Math.max(0, Math.min(1, vote.yes / Math.max(1, vote.required)));
    progressW.value = withTiming(ratio, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [vote.yes, vote.required, progressW]);

  // ---- Countdown timer ----
  useEffect(() => {
    setRemaining(vote.remaining_seconds);
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [vote.id, vote.remaining_seconds]);

  const canCancel = isHost || vote.initiator === myUserId;
  const isInitiator = vote.initiator === myUserId;
  const isUrgent = remaining <= 5;

  // ---- Animated styles ----
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: `${progressW.value * 100}%`,
  }));

  return (
    <Animated.View style={[styles.wrap, containerStyle]} pointerEvents="box-none">
      {/* Glass blur backdrop */}
      <View style={styles.glassWrap}>
        {Platform.OS === "web" ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(10, 12, 22, 0.92)" },
            ]}
          />
        ) : (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(15, 17, 30, 0.78)" },
          ]}
        />
        {/* Iridescent metallic border (chrome + brand + accent + chrome) */}
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.35)",
            "rgba(34,255,136,0.55)",
            "rgba(168,85,247,0.55)",
            "rgba(255,255,255,0.35)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.borderRing}
          pointerEvents="none"
        />

        <View style={styles.inner}>
          {/* Header: icon + title + countdown */}
          <View style={styles.headerRow}>
            <View style={styles.kindIconWrap}>
              <Ionicons
                name={vote.kind === "skip" ? "play-skip-forward" : "musical-notes"}
                size={18}
                color={FUTURISTIC.brand}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {vote.kind === "skip" ? t("vote_to_skip") : t("vote_play_next")}
              </Text>
              {isInitiator && (
                <Text style={styles.youStarted}>{t("you_started_vote")}</Text>
              )}
            </View>
            <View
              style={[
                styles.timerPill,
                isUrgent && {
                  borderColor: FUTURISTIC.error,
                  backgroundColor: "rgba(255,61,113,0.16)",
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={isUrgent ? FUTURISTIC.error : FUTURISTIC.brand}
              />
              <Text
                style={[
                  styles.timerText,
                  isUrgent && { color: FUTURISTIC.error },
                ]}
              >
                {remaining}{t("seconds_short")}
              </Text>
            </View>
          </View>

          {/* Video title (only for "next" votes) */}
          {vote.title ? (
            <View style={styles.titleRow}>
              <Ionicons name="play" size={11} color={FUTURISTIC.textMuted} />
              <Text style={styles.subtitle} numberOfLines={1}>
                {vote.title}
              </Text>
            </View>
          ) : null}

          {/* Progress bar — animated fill with neon glow */}
          <View style={styles.barWrap}>
            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFillWrap, fillStyle]}>
                <LinearGradient
                  colors={["#26FF93", "#10C66D", "#26FF93"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.barFill}
                />
              </Animated.View>
              {/* tick marks for required threshold */}
              <View
                pointerEvents="none"
                style={[
                  styles.requiredTick,
                  { left: `${(vote.required / Math.max(1, vote.member_count)) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statLabel}>
                <Text style={[styles.statValue, { color: FUTURISTIC.brand }]}>
                  {vote.yes}
                </Text>
                <Text style={styles.statKey}> {t("yes_label")}</Text>
              </Text>
              <Text style={styles.statLabel}>
                <Text style={[styles.statValue, { color: FUTURISTIC.error }]}>
                  {vote.no}
                </Text>
                <Text style={styles.statKey}> {t("no_label")}</Text>
              </Text>
              <Text style={styles.statLabel}>
                <Text style={styles.statKey}>{t("need_label")} </Text>
                <Text style={[styles.statValue, { color: FUTURISTIC.textPrimary }]}>
                  {vote.required}/{vote.member_count}
                </Text>
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <ActionBtn
              variant="yes"
              label={t("vote_yes")}
              icon="checkmark-circle"
              disabled={myVote === true}
              onPress={() => onCast(true)}
            />
            <ActionBtn
              variant="no"
              label={t("vote_no")}
              icon="close-circle"
              disabled={myVote === false}
              onPress={() => onCast(false)}
            />
            {canCancel && (
              <TouchableOpacity
                onPress={onCancel}
                style={styles.cancelBtn}
                activeOpacity={0.7}
                accessibilityLabel="Cancel vote"
              >
                <Ionicons name="trash-outline" size={16} color={FUTURISTIC.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// ActionBtn — local mini-button for YES / NO (small enough to not need the
// big NeonButton component; this is hand-tuned for the vote bar layout).
// ---------------------------------------------------------------------------
function ActionBtn({
  variant,
  label,
  icon,
  disabled,
  onPress,
}: {
  variant: "yes" | "no";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);
  const isYes = variant === "yes";
  const fg = isYes ? "#001A0C" : "#FFFFFF";
  const edge = isYes
    ? (["rgba(255,255,255,0.55)", "rgba(34,255,136,0.55)"] as const)
    : (["rgba(255,255,255,0.45)", "rgba(255,61,113,0.55)"] as const);
  const fill = isYes
    ? (["#26FF93", "#10C66D"] as const)
    : (["#FF5A85", "#D81E54"] as const);
  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.05 }],
    opacity: disabled ? 0.45 : 1,
  }));
  return (
    <Animated.View style={[{ flex: 1 }, scale]}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => (pressed.value = withTiming(1, { duration: 90 }))}
        onPressOut={() => (pressed.value = withTiming(0, { duration: 140 }))}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={edge as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 1, borderRadius: 12 }}
        >
          <LinearGradient
            colors={fill as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.actionInner}
          >
            <Ionicons name={icon} size={16} color={fg} />
            <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 100,
    ...SHADOWS.sheet,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.4,
  },
  glassWrap: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(10,12,22,0.55)",
  },
  borderRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    opacity: 0.6,
  },
  inner: { padding: 14, margin: 1, borderRadius: 17 },
  // ----- Header -----
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  kindIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: FUTURISTIC.brandSoft,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...TYPO.caption,
    color: FUTURISTIC.brand,
    textShadowColor: FUTURISTIC.brandGlow,
    textShadowRadius: 6,
  },
  youStarted: {
    color: FUTURISTIC.textMuted,
    fontSize: 8,
    letterSpacing: 1.8,
    marginTop: 2,
    fontWeight: "700",
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    backgroundColor: FUTURISTIC.brandSoft,
  },
  timerText: {
    color: FUTURISTIC.brand,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  // ----- Title row (next vote) -----
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  subtitle: {
    color: FUTURISTIC.textSecondary,
    fontSize: 12,
    flex: 1,
    fontStyle: "italic",
  },
  // ----- Progress bar -----
  barWrap: { marginTop: 12, gap: 6 },
  barTrack: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  barFillWrap: {
    height: "100%",
    borderRadius: 5,
    overflow: "hidden",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  barFill: { flex: 1 },
  requiredTick: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.50)",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  statLabel: { color: FUTURISTIC.textMuted, fontSize: 11 },
  statKey: { color: FUTURISTIC.textMuted, fontWeight: "600" },
  statValue: { fontWeight: "900", letterSpacing: 0.4 },
  // ----- Actions -----
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionInner: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowRadius: 2,
  },
  cancelBtn: {
    width: 44,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FUTURISTIC.border,
    backgroundColor: FUTURISTIC.surface2,
  },
});
