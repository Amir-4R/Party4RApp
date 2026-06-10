// =============================================================================
// damma/components/WoodenTable.tsx — wooden frame + green felt + chain area
// =============================================================================
// The visible board IS the real board. Chain layout uses dimensions measured
// from the actual felt View via onLayout — no SCREEN_W approximations. The
// safe-zone padding inside the felt is the same value the layout algorithm
// reserves, so tiles can NEVER cross the visible boundary.
//
// Smart scaling: when the chain grows we shrink tile scale BEFORE the chain
// approaches the edges. The board itself never moves or stretches.
// =============================================================================
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, ImageBackground, LayoutChangeEvent } from "react-native";
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

// ── Layout constants — single source of truth (visible = logical) ───────────
// Horizontal tile (a domino placed flat on the board) base dimensions.
const TILE_W = 72;
const TILE_H = 40;
const TILE_GAP = 4;   // horizontal gap between tiles in a row
const ROW_GAP = 6;    // vertical gap between rows
const MIN_SCALE = 0.35;
const MAX_SCALE = 1.0;
const SCALE_STEPS = 14; // try 1.0, 0.95, 0.90 … down to MIN_SCALE

// Internal safe-zone around the chain — the SAME margin the algorithm reserves
// is applied as visible padding on the felt, so no tile can ever overlap the
// wooden frame.
const SAFE_X = 10;   // left + right
const SAFE_Y = 10;   // top + bottom
const LABEL_H = 22;  // vertical space reserved for the "Ends: x / y" header

export interface WoodenTableProps {
  /** Raw played chain (flat array, in chain order). */
  board: PlacedDomino[];
  /** Current left end value or null when board is empty. */
  leftEnd: number | null;
  /** Current right end value or null when board is empty. */
  rightEnd: number | null;
  /** Damma palette (driven by ThemeContext). */
  pal: ReturnType<typeof dammaPalette>;
  endsLabel?: string;          // e.g. "Ends"
  emptyText?: string;          // e.g. "Place the first tile"
}

// ── Pure chain-layout function (memoised at the component level) ────────────
// Given the played board, the measured *playable* width & height (i.e. the
// inner safe area) — returns the snake-wrapped rows and the tile scale to use
// so the entire chain fits inside the safe zone with healthy breathing room.
interface ChainLayout {
  rows: PlacedDomino[][];
  scale: number;
}
function computeChainLayout(board: PlacedDomino[], playW: number, playH: number): ChainLayout {
  if (board.length === 0 || playW <= 0 || playH <= 0) {
    return { rows: [], scale: 1 };
  }
  // Try scales from largest to smallest and pick the FIRST one that fits the
  // whole chain inside the playable rectangle. This guarantees that the chain
  // shrinks BEFORE it reaches the edges.
  for (let i = 0; i < SCALE_STEPS; i++) {
    const scale = MAX_SCALE - (i * (MAX_SCALE - MIN_SCALE)) / (SCALE_STEPS - 1);
    const tileW = TILE_W * scale + TILE_GAP;
    const tileH = TILE_H * scale + ROW_GAP;
    const perRow = Math.max(1, Math.floor(playW / tileW));
    const rows = Math.ceil(board.length / perRow);
    const totalH = rows * tileH - ROW_GAP; // last row has no trailing gap
    if (totalH <= playH) {
      // Build the rows now that we know perRow.
      return { rows: chunk(board, perRow), scale };
    }
  }
  // Even MIN_SCALE doesn't fit. Use it anyway; ScrollView can take over.
  const scale = MIN_SCALE;
  const tileW = TILE_W * scale + TILE_GAP;
  const perRow = Math.max(1, Math.floor(playW / tileW));
  return { rows: chunk(board, perRow), scale };
}
function chunk(board: PlacedDomino[], perRow: number): PlacedDomino[][] {
  const rows: PlacedDomino[][] = [];
  for (let i = 0; i < board.length; i += perRow) {
    const slice = board.slice(i, i + perRow);
    // Snake wrap: every other row reverses → chain flows L→R then R→L.
    if (rows.length % 2 === 1) slice.reverse();
    rows.push(slice);
  }
  return rows;
}

export default function WoodenTable({
  board, leftEnd, rightEnd, pal,
  endsLabel = "Ends", emptyText = "Place the first tile",
}: WoodenTableProps) {
  // Measured size of the inner SAFE-ZONE container (this IS the play area).
  const [playSize, setPlaySize] = useState({ w: 0, h: 0 });
  const onSafeLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPlaySize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height }
    );
  }, []);

  const layout = useMemo(
    () => computeChainLayout(board, playSize.w, playSize.h),
    [board, playSize.w, playSize.h],
  );

  return (
    <LinearGradient
      colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.woodFrame}
    >
      {/* Walnut wood texture overlay (sits on top of the gradient). */}
      <ImageBackground
        source={DAMMA_TEXTURES.wood}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.7, borderRadius: 18 }}
      />
      {/* Thin gold inner trim */}
      <View pointerEvents="none" style={styles.woodGoldTrim} />

      <View style={[styles.tableWrap, { shadowColor: pal.glow }]}>
        <LinearGradient
          colors={[FELT_CENTER, FELT_EDGE, FELT_DEEP]}
          start={{ x: 0.3, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.table}
        >
          {/* Green velvet/felt texture overlay. */}
          <ImageBackground
            source={DAMMA_TEXTURES.felt}
            resizeMode="repeat"
            style={StyleSheet.absoluteFill}
            imageStyle={{ opacity: 0.32, borderRadius: 14 }}
          />
          {/* Inner dashed stitched bevel — purely decorative. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tableInlay, { borderColor: withAlpha(pal.railLight, 0.45) }]} />

          {/* Ends header — sits ON TOP of the safe zone (does not consume it). */}
          <Text style={[styles.endsLabel, { color: withAlpha("#FFFFFF", 0.75) }]}>
            {endsLabel}: {leftEnd ?? "—"} / {rightEnd ?? "—"}
          </Text>

          {/* ── PLAYABLE SAFE ZONE ─────────────────────────────────────────
              This View is the REAL board. We measure its size and pass it to
              the layout algorithm. Visible padding === logical padding, so
              tiles can never escape the visible boundary. */}
          <View style={styles.safeZone} onLayout={onSafeLayout}>
            {board.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyBoard}>{emptyText}</Text>
              </View>
            ) : (
              <View style={styles.chainStack}>
                {layout.rows.map((row, ri) => (
                  <View
                    key={`row-${ri}`}
                    style={[
                      styles.boardRow,
                      {
                        gap: Math.max(2, TILE_GAP * layout.scale),
                        marginBottom: ri < layout.rows.length - 1 ? ROW_GAP : 0,
                      },
                    ]}
                  >
                    {row.map((d, i) => (
                      <DominoTile
                        key={`${d.id}-${ri}-${i}`}
                        domino={d}
                        horizontal
                        pal={pal}
                        scale={layout.scale}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // ── Wooden frame (outer luxury rim) ────────────────────────────────────────
  woodFrame: {
    flex: 1,
    borderRadius: 18,
    padding: 6,
    shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    position: "relative",
    overflow: "hidden",
    // The visible board has a stable aspect ratio so it does not stretch
    // unpredictably under different surrounding UI. minHeight guarantees a
    // playable area on small phones; flex still lets it expand when space is
    // available.
    minHeight: 280,
  },
  woodGoldTrim: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: withAlpha(GOLD, 0.55),
  },
  // ── Felt wrapper inside the wood (rounded corners + shadow) ───────────────
  tableWrap: {
    flex: 1, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    borderRadius: 14, overflow: "hidden",
  },
  table: {
    flex: 1, borderRadius: 14, borderWidth: 0, overflow: "hidden",
  },
  tableInlay: { margin: 4, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" },

  // ── Header (Ends: x / y) ──────────────────────────────────────────────────
  endsLabel: {
    fontSize: 12, fontWeight: "700", textAlign: "center",
    paddingTop: 6, height: LABEL_H,
  },

  // ── THE SAFE PLAYABLE ZONE ────────────────────────────────────────────────
  // padding here = the same margin the layout algorithm reserves. NO tile can
  // ever render outside this View because every child is positioned by the
  // chain layout that uses *this view's measured size*.
  safeZone: {
    flex: 1,
    paddingHorizontal: SAFE_X,
    paddingVertical: SAFE_Y,
    overflow: "hidden",
    alignItems: "stretch",
    justifyContent: "center",
  },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyBoard: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic" },

  chainStack: { flex: 1, alignItems: "center", justifyContent: "center" },
  boardRow:   { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
