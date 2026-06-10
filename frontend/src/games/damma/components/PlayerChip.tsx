// =============================================================================
// damma/components/PlayerChip.tsx — compact floating player indicator
// =============================================================================
// Tiny edge indicator that shows only the essentials: avatar + name + tile
// count. Tapping the chip toggles a small popup with additional details (full
// score, role label). This component never reserves space in the layout flow
// when used inside an absolute-positioned container, so the board stays huge.
// =============================================================================
import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { withAlpha } from "@/src/games/shared/gameTheme";
import { GOLD, WOOD_DARK } from "./theme";

export type PlayerChipDirection = "top" | "left" | "right" | "bottom";

export interface PlayerChipProps {
  /** Display name (kept short — auto-truncates to 8 chars). */
  name: string;
  /** Remaining tile count (badge). */
  tileCount?: number;
  /** Cumulative score (shown in the expanded popup). */
  score?: number;
  /** Avatar URI (remote or base64). If absent, a robot icon is shown. */
  avatarUri?: string;
  /** Is this player currently taking their turn? Drives the green glow. */
  active?: boolean;
  /** Where the popup should expand toward. Default "bottom". */
  popupDirection?: PlayerChipDirection;
  /** Optional sub-label shown inside the popup (e.g. "Bot — Medium"). */
  subLabel?: string;
  testID?: string;
}

export default function PlayerChip({
  name,
  tileCount,
  score,
  avatarUri,
  active = false,
  popupDirection = "bottom",
  subLabel,
  testID,
}: PlayerChipProps) {
  const [expanded, setExpanded] = useState(false);
  const togglePopup = useCallback(() => setExpanded((p) => !p), []);

  return (
    <View testID={testID} style={styles.wrap}>
      <TouchableOpacity
        onPress={togglePopup}
        activeOpacity={0.85}
        style={[styles.chip, active && styles.chipActive]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={[styles.avatar, active && styles.avatarActive]} />
        ) : (
          <View style={[styles.avatarFallback, active && styles.avatarActive]}>
            <Ionicons name="hardware-chip" size={14} color={GOLD} />
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>{shortenName(name)}</Text>
        {typeof tileCount === "number" && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{tileCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Popup — only renders when expanded, never reserves space. */}
      {expanded && (
        <View style={[styles.popup, popupStyles[popupDirection]]} pointerEvents="box-none">
          <Text style={styles.popupName}>{name}</Text>
          {subLabel ? <Text style={styles.popupSub}>{subLabel}</Text> : null}
          <View style={styles.popupRow}>
            <Text style={styles.popupLabel}>SCORE</Text>
            <Text style={styles.popupValue}>{score ?? 0}</Text>
          </View>
          {typeof tileCount === "number" && (
            <View style={styles.popupRow}>
              <Text style={styles.popupLabel}>TILES</Text>
              <Text style={styles.popupValue}>{tileCount}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function shortenName(s: string): string {
  if (s.length <= 8) return s;
  return s.slice(0, 7) + "…";
}

const POPUP_W = 140;
const popupStyles = StyleSheet.create({
  top:    { bottom: "100%", marginBottom: 4, alignSelf: "center" },
  bottom: { top: "100%", marginTop: 4, alignSelf: "center" },
  left:   { right: "100%", marginRight: 4, top: 0 },
  right:  { left: "100%", marginLeft: 4, top: 0 },
});

const styles = StyleSheet.create({
  wrap: { position: "relative" },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 6, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.35),
    minHeight: 28,
    // soft shadow for "floating" look
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  chipActive: {
    borderColor: "#4ADE80",
    backgroundColor: "rgba(74,222,128,0.18)",
    shadowColor: "#4ADE80", shadowOpacity: 0.8, shadowRadius: 6,
  },

  avatar:        { width: 22, height: 22, borderRadius: 11, backgroundColor: "#1F2530" },
  avatarFallback:{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#1F2530", alignItems: "center", justifyContent: "center" },
  avatarActive:  { borderWidth: 1.5, borderColor: "#4ADE80" },

  name: { color: "#FFF", fontSize: 11, fontWeight: "700", maxWidth: 70 },

  countBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: GOLD,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1, borderColor: WOOD_DARK,
  },
  countText: { color: "#1A0E06", fontSize: 9, fontWeight: "900" },

  // ── Popup ────────────────────────────────────────────────────────────────
  popup: {
    position: "absolute",
    width: POPUP_W,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(15,17,22,0.97)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.45),
    shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 20,
  },
  popupName: { color: GOLD, fontSize: 12, fontWeight: "900", textAlign: "center" },
  popupSub:  { color: "rgba(255,255,255,0.6)", fontSize: 9, textAlign: "center", marginTop: 2 },
  popupRow:  { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  popupLabel:{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  popupValue:{ color: GOLD, fontSize: 12, fontWeight: "900" },
});
