// =============================================================================
// damma/components/PlayerCard.tsx — premium player avatar+score card
// =============================================================================
// Single component with 4 variants used across the Damma screen:
//   • "me"   — large card on the score bar (human player, left)
//   • "bot"  — large card on the score bar (AI opponent, right)
//   • "top"  — compact top card (4-Player mode only)
//   • "side" — compact left/right cards (4-Player mode only)
//
// Pure presentation, no game logic. Active state (green glow) is driven by
// the `active` prop.
// =============================================================================
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { withAlpha } from "@/src/games/shared/gameTheme";
import { GOLD } from "./theme";

export type PlayerCardVariant = "me" | "bot" | "top" | "side";

export interface PlayerCardProps {
  variant: PlayerCardVariant;
  name: string;
  score: number;
  /** Required for "me" variant — URL of the user avatar (base64 or remote). */
  avatarUri?: string;
  /** Tint colour used on the chip icon — defaults to GOLD. */
  iconColor?: string;
  /** Whether this player has the current turn (drives green glow). */
  active?: boolean;
  /** For 4P compact variants — number of tiles still in this player's hand. */
  tileCount?: number;
  testID?: string;
}

export default function PlayerCard({
  variant,
  name,
  score,
  avatarUri,
  iconColor = GOLD,
  active = false,
  tileCount,
  testID,
}: PlayerCardProps) {
  // ── Large "me" card (1v1 + 4P, bottom-left of the score bar) ───────────────
  if (variant === "me") {
    return (
      <View testID={testID} style={[styles.playerScoreCard, active && styles.scoreActive]}>
        {avatarUri && (
          <Image source={{ uri: avatarUri }} style={[styles.avatar, active && styles.avatarActive]} />
        )}
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.scoreVal}>{score}</Text>
        </View>
      </View>
    );
  }

  // ── Large "bot" card (1v1, top-right of the score bar) ─────────────────────
  if (variant === "bot") {
    return (
      <View testID={testID} style={[styles.playerScoreCard, active && styles.scoreActive]}>
        <View style={{ flex: 1, marginRight: 8, alignItems: "flex-end" }}>
          <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.scoreVal}>{score}</Text>
        </View>
        <View style={[styles.avatar, styles.botAvatarBox, active && styles.avatarActive]}>
          <Ionicons name="hardware-chip" size={22} color={iconColor} />
        </View>
      </View>
    );
  }

  // ── Compact "top" card (4-Player mode only, top-center) ────────────────────
  if (variant === "top") {
    return (
      <View testID={testID} style={styles.topPlayerCard}>
        <View style={[styles.smallAvatar, active && styles.smallAvatarActive]}>
          <Ionicons name="hardware-chip" size={18} color={GOLD} />
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.smallPlayerName}>{name}</Text>
          <Text style={styles.smallScoreVal}>{score}</Text>
        </View>
        {typeof tileCount === "number" && (
          <View style={styles.tileCountBadge}>
            <Ionicons name="apps" size={11} color={GOLD} />
            <Text style={styles.tileCountText}>{tileCount}</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Compact "side" card (4-Player mode only, left/right) ───────────────────
  return (
    <View testID={testID} style={[styles.sidePlayerCard, active && styles.scoreActive]}>
      <View style={[styles.smallAvatar, active && styles.smallAvatarActive]}>
        <Ionicons name="hardware-chip" size={18} color={GOLD} />
      </View>
      <View style={{ flex: 1, marginLeft: 6 }}>
        <Text style={styles.smallPlayerName}>{name}</Text>
        <Text style={styles.smallScoreVal}>{score}</Text>
      </View>
      {typeof tileCount === "number" && (
        <View style={styles.tileCountBadge}>
          <Ionicons name="apps" size={10} color={GOLD} />
          <Text style={styles.tileCountText}>{tileCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  playerScoreCard: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.18),
    minHeight: 56,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  // Active player: rich green glow.
  scoreActive: {
    borderColor: "#4ADE80",
    backgroundColor: "rgba(74,222,128,0.08)",
    shadowColor: "#4ADE80", shadowOpacity: 0.55, shadowRadius: 10,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: FUTURISTIC.surface2 },
  avatarActive: { borderWidth: 2, borderColor: "#4ADE80" },
  botAvatarBox: {
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  playerName: { color: FUTURISTIC.textPrimary, fontSize: 12, fontWeight: "800", maxWidth: 110 },
  scoreVal: { color: GOLD, fontSize: 22, fontWeight: "900", marginTop: 1 },

  // 4-Player compact cards
  topPlayerCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.30),
    marginBottom: 6,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4,
  },
  sidePlayerCard: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.30),
    minHeight: 44,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4,
  },
  smallAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: FUTURISTIC.surface2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  smallAvatarActive: {
    borderColor: GOLD,
    shadowColor: GOLD, shadowOpacity: 0.6, shadowRadius: 4,
  },
  smallPlayerName: { color: FUTURISTIC.textPrimary, fontSize: 11, fontWeight: "700" },
  smallScoreVal: { color: GOLD, fontSize: 14, fontWeight: "900" },
  tileCountBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: withAlpha(GOLD, 0.12),
    borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.4),
  },
  tileCountText: { color: GOLD, fontSize: 10, fontWeight: "800" },
});
