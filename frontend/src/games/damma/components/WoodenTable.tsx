// =============================================================================
// damma/components/WoodenTable.tsx — wooden frame + green felt + chain area
// =============================================================================
// Wraps the play area with a luxury wooden border and renders the played chain
// inside a scrollable, snake-wrapped grid. Engine-free: receives ready-to-draw
// board rows from the parent.
// =============================================================================
import React from "react";
import { View, Text, ScrollView, StyleSheet, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { dammaPalette, withAlpha } from "@/src/games/shared/gameTheme";
import type { PlacedDomino } from "@/src/games/damma/engine";
import DominoTile from "./DominoTile";
import { DAMMA_TEXTURES } from "./assets";
import {
  FELT_CENTER, FELT_DEEP, FELT_EDGE,
  GOLD,
  WOOD_DARK, WOOD_LIGHT, WOOD_MID,
} from "./theme";

export interface WoodenTableProps {
  /** Pre-grouped rows of placed dominos (snake-wrapped from the parent). */
  boardRows: PlacedDomino[][];
  /** Current left end value or null when board is empty. */
  leftEnd: number | null;
  /** Current right end value or null when board is empty. */
  rightEnd: number | null;
  /** Auto-shrink factor for very long chains. */
  chainScale: number;
  /** Damma palette (driven by ThemeContext). */
  pal: ReturnType<typeof dammaPalette>;
  endsLabel?: string;          // e.g. "Ends"
  emptyText?: string;          // e.g. "Place the first tile"
}

export default function WoodenTable({
  boardRows, leftEnd, rightEnd, chainScale, pal,
  endsLabel = "Ends", emptyText = "Place the first tile",
}: WoodenTableProps) {
  const isEmpty = boardRows.length === 0 || (boardRows.length === 1 && boardRows[0].length === 0);

  return (
    <LinearGradient
      colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.woodFrame}
    >
      {/* Photorealistic walnut wood texture overlay (multiplied at 70 % so the
          colour gradient beneath shines through and keeps the warm tint). */}
      <ImageBackground
        source={DAMMA_TEXTURES.wood}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.7, borderRadius: 22 }}
      />
      {/* Thin gold inner trim */}
      <View pointerEvents="none" style={styles.woodGoldTrim} />

      <View style={[styles.tableWrap, { shadowColor: pal.glow }]}>
        <LinearGradient
          colors={[FELT_CENTER, FELT_EDGE, FELT_DEEP]}
          start={{ x: 0.3, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.table, { borderColor: "transparent" }]}
        >
          {/* Photorealistic green velvet/felt texture overlay (subtle). */}
          <ImageBackground
            source={DAMMA_TEXTURES.felt}
            resizeMode="repeat"
            style={StyleSheet.absoluteFill}
            imageStyle={{ opacity: 0.32, borderRadius: 14 }}
          />
          {/* Soft radial-style highlight overlay on the felt (fabric look) */}
          <View pointerEvents="none" style={styles.feltHighlight} />
          {/* Inner stitched bevel — keeps the old elegant dashed inlay */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tableInlay, { borderColor: withAlpha(pal.railLight, 0.45) }]} />
          {/* Ambient corner glows */}
          <View pointerEvents="none" style={[styles.tableGlow,  { backgroundColor: withAlpha(pal.glow, 0.18) }]} />
          <View pointerEvents="none" style={[styles.tableGlowB, { backgroundColor: withAlpha("#000000", 0.15) }]} />

          <Text style={[styles.endsLabel, { color: withAlpha("#FFFFFF", 0.75) }]}>
            {endsLabel}: {leftEnd ?? "—"} / {rightEnd ?? "—"}
          </Text>

          {isEmpty ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={styles.emptyBoard}>{emptyText}</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.boardWrap}
              showsVerticalScrollIndicator={false}
            >
              {boardRows.map((row, ri) => (
                <View
                  key={`row-${ri}`}
                  style={[styles.boardRow, { gap: Math.max(2, 3 * chainScale) }]}
                >
                  {row.map((d, i) => (
                    <DominoTile
                      key={`${d.id}-${ri}-${i}`}
                      domino={d}
                      horizontal
                      pal={pal}
                      scale={chainScale}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  woodFrame: {
    flex: 1,
    borderRadius: 22,
    padding: 10,
    shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    position: "relative",
    overflow: "hidden",
  },
  woodGoldTrim: {
    ...StyleSheet.absoluteFillObject,
    margin: 6,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: withAlpha(GOLD, 0.55),
  },
  tableWrap: {
    flex: 1, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    borderRadius: 14, overflow: "hidden",
  },
  table: {
    flex: 1, borderRadius: 14,
    borderWidth: 0,
    // Increased internal safe-zone padding so the played tiles can never touch
    // the wooden frame on any side, regardless of how long the chain is.
    paddingVertical: 18, paddingHorizontal: 16,
    overflow: "hidden",
  },
  feltHighlight: {
    position: "absolute",
    top: -40, left: "10%", right: "10%", height: 240,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 9999,
  },
  tableInlay: { margin: 4, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" },
  tableGlow:  { position: "absolute", top: -40, left: -40, width: 180, height: 180, borderRadius: 999, opacity: 0.8 },
  tableGlowB: { position: "absolute", bottom: -50, right: -50, width: 200, height: 200, borderRadius: 999 },
  endsLabel: { fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  boardWrap: { paddingVertical: 8, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  boardRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 2 },
  emptyBoard: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic" },
});
