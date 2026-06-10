// =============================================================================
// damma/components/HandTray.tsx — bottom wooden tray with hand tiles + actions
// =============================================================================
// Contains: bot "thinking…" indicator, side play buttons (Left/Right), the
// turn-state caption, a horizontal scroll of the player's tiles, and the pass
// button. The parent owns all engine state — this component is purely visual.
// =============================================================================
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { dammaPalette, withAlpha } from "@/src/games/shared/gameTheme";
import type { Domino } from "@/src/games/damma/engine";
import DominoTile from "./DominoTile";
import { GOLD, GOLD_SOFT, WOOD_DARK, WOOD_LIGHT, WOOD_MID } from "./theme";

export interface HandTrayProps {
  /** The tiles currently in the human player's hand. */
  hand: Domino[];
  /** Tiles that are playable on the current board. */
  playableTiles: Domino[];
  /** Is it the human player's turn? */
  isMyTurn: boolean;
  /** True when the board is empty (no chain yet). */
  boardEmpty: boolean;
  /** Currently selected tile id (null when none selected). */
  selectedTileId: string | null;
  /** Id of a tile that is animating from hand to board — hides it from hand. */
  flyingTileId?: string | null;
  /** Bot "thinking" delay indicator visibility. */
  botThinking: boolean;
  /** Whether the pass action is required (no playable tiles & empty boneyard). */
  mustPass: boolean;
  /** Possible play sides for the current selectedTile. */
  playableSides: ("left" | "right")[];
  /** Bottom safe-area inset for navigation bars. */
  bottomInset: number;
  /** Damma palette. */
  pal: ReturnType<typeof dammaPalette>;

  // ── Localised labels ─────────────────────────────────────────────────────
  turnText: string;       // "Your Turn" / "Opponent's Turn"
  thinkingText: string;   // "AI is thinking…"
  leftText: string;       // "Left"
  rightText: string;      // "Right"
  passText: string;       // "Pass"

  // ── Handlers ─────────────────────────────────────────────────────────────
  onTilePress: (tile: Domino, playable: boolean) => void;
  onPlay: (side: "left" | "right") => void;
  onPass: () => void;
}

export default function HandTray({
  hand, playableTiles, isMyTurn, boardEmpty,
  selectedTileId, flyingTileId,
  botThinking, mustPass, playableSides,
  bottomInset, pal,
  turnText, thinkingText, leftText, rightText, passText,
  onTilePress, onPlay, onPass,
}: HandTrayProps) {
  const showSideButtons = !!selectedTileId && isMyTurn && !boardEmpty;
  const playableIds = new Set(playableTiles.map((p) => p.id));

  return (
    <LinearGradient
      colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.handTrayFrame, { paddingBottom: Math.max(8, bottomInset + 4) }]}
    >
      <View pointerEvents="none" style={styles.handTrayGoldTrim} />
      <View style={styles.myHandArea}>

        {/* Bot "Thinking…" indicator (5-second delay before AI plays). */}
        {botThinking && (
          <View testID="damma-thinking" style={styles.thinkingBox}>
            <View style={styles.thinkingDot} />
            <Text style={styles.thinkingText}>🤖 {thinkingText}</Text>
          </View>
        )}

        {/* Play side buttons (kept ABOVE the hand, generously spaced). */}
        {showSideButtons && (
          <View style={styles.sideButtons}>
            {playableSides.includes("left") && (
              <TouchableOpacity testID="damma-play-left" style={styles.sideBtn} onPress={() => onPlay("left")} activeOpacity={0.9}>
                <Ionicons name="arrow-back" size={18} color={FUTURISTIC.bg} />
                <Text style={styles.sideBtnText}>{leftText}</Text>
              </TouchableOpacity>
            )}
            <View style={{ width: 24 }} />
            {playableSides.includes("right") && (
              <TouchableOpacity testID="damma-play-right" style={styles.sideBtn} onPress={() => onPlay("right")} activeOpacity={0.9}>
                <Text style={styles.sideBtnText}>{rightText}</Text>
                <Ionicons name="arrow-forward" size={18} color={FUTURISTIC.bg} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.turnText}>{turnText}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
          {hand.map((d) => {
            const playable = isMyTurn && playableIds.has(d.id);
            const dimmed = isMyTurn && !playable && !boardEmpty;
            const isFlying = flyingTileId === d.id;
            return (
              <View
                key={d.id}
                style={[
                  dimmed ? { opacity: 0.45 } : undefined,
                  isFlying ? { opacity: 0 } : undefined,
                ]}
              >
                <DominoTile
                  domino={d}
                  pal={pal}
                  testID={`damma-hand-tile-${d.left}-${d.right}`}
                  selected={selectedTileId === d.id}
                  onPress={() => onTilePress(d, playable)}
                />
              </View>
            );
          })}
        </ScrollView>

        {isMyTurn && mustPass && (
          <TouchableOpacity testID="damma-pass-btn" style={[styles.actionBtn, { backgroundColor: FUTURISTIC.textMuted }]} onPress={onPass} activeOpacity={0.9}>
            <Text style={styles.actionText}>{passText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  handTrayFrame: {
    paddingHorizontal: 6, paddingTop: 6,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    overflow: "hidden",
    position: "relative",
  },
  handTrayGoldTrim: {
    position: "absolute", top: 4, left: 4, right: 4, bottom: 4,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1.2,
    borderColor: withAlpha(GOLD, 0.55),
  },
  myHandArea: {
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: "rgba(8,4,2,0.55)",
    borderRadius: 16,
  },
  turnText: { color: GOLD, fontSize: 14, fontWeight: "800", textAlign: "center", marginBottom: 8, letterSpacing: 0.5 },
  handScroll: { gap: 6, paddingHorizontal: 8, paddingTop: 12, alignItems: "flex-end", minHeight: 90 },

  thinkingBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 14, marginHorizontal: 60,
    backgroundColor: withAlpha(GOLD, 0.12),
    borderRadius: 999,
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.4),
    marginBottom: 6,
  },
  thinkingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: GOLD,
  },
  thinkingText: { color: GOLD, fontSize: 12, fontWeight: "800" },

  sideButtons: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingTop: 4, paddingBottom: 12,
    marginBottom: 6,
  },
  sideBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: GOLD,
    paddingHorizontal: 26, paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: GOLD_SOFT,
    shadowColor: GOLD, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  sideBtnText: { color: "#1A0E06", fontWeight: "900", fontSize: 14 },

  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GOLD,
    marginTop: 12, marginHorizontal: 40, paddingVertical: 12, borderRadius: 12,
  },
  actionText: { color: "#1A0E06", fontWeight: "900", fontSize: 14 },
});
