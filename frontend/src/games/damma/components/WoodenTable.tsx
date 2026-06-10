// =============================================================================
// damma/components/WoodenTable.tsx — Premium domino board with snake layout
// =============================================================================
// Renders the chain as a TRUE serpentine path (see SnakeLayout.ts):
//
//   • Starts visually near the centre of the felt.
//   • Extends naturally from both ends of the chain.
//   • Bends 90° at edges via vertical "corner" tiles so nothing escapes the
//     wooden frame — even in long matches.
//   • Newly-placed tiles fly into position with a smooth 380 ms animation
//     and pulse a brief golden halo so the player can see what was played.
//   • Stays neat & readable: the chain auto-shrinks before it could overflow.
// =============================================================================
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ImageBackground, LayoutChangeEvent, Animated, Easing,
} from "react-native";
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
import { buildSnakeLayout, TILE_W, TILE_H, type SnakePos } from "./SnakeLayout";

// Internal padding so corner tiles never touch the wooden frame.
const SAFE_X = 12;
const SAFE_Y = 12;
const LABEL_H = 22;

export type EntrySide = "left" | "right" | "first" | null;

export interface WoodenTableProps {
  board: PlacedDomino[];
  leftEnd: number | null;
  rightEnd: number | null;
  pal: ReturnType<typeof dammaPalette>;
  endsLabel?: string;
  emptyText?: string;
  /** Optional hint about which side a brand-new tile entered from. Used to
   * pick a sensible off-screen start point for the entrance animation. */
  entrySide?: EntrySide;
}

interface AnimatedEntry {
  // Animated.Value driving the entrance. Goes 0 → 1 over ~380 ms.
  progress: Animated.Value;
  // Captured start offset (relative to final position) in the play area
  // coordinate system. The tile travels from (startX, startY) to (0, 0).
  startDX: number;
  startDY: number;
  // Halo opacity for the brief glow once it lands.
  glow: Animated.Value;
}

export default function WoodenTable({
  board, leftEnd, rightEnd, pal,
  endsLabel = "Ends", emptyText = "Place the first tile",
  entrySide = null,
}: WoodenTableProps) {
  // Measured play area (the safe zone IS the real board).
  // NOTE: `safeZone` has paddingHorizontal/Vertical so the onLayout we get
  // is the BORDER box. We subtract the padding so the snake layout works
  // against the CONTENT box (where tiles are actually rendered).
  const [playSize, setPlaySize] = useState({ w: 0, h: 0 });
  const onSafeLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.max(0, width - 2 * SAFE_X);
    const h = Math.max(0, height - 2 * SAFE_Y);
    setPlaySize((prev) =>
      prev.w === w && prev.h === h ? prev : { w, h }
    );
  }, []);

  // ── Compute snake positions (one entry per board tile) ─────────────────
  const layout = useMemo(() => {
    return buildSnakeLayout(board.length, playSize.w, playSize.h);
  }, [board.length, playSize.w, playSize.h]);

  // ── Entrance animations: track which tile ids have already animated in.
  const animMap = useRef<Map<string, AnimatedEntry>>(new Map());
  const seenIds = useRef<Set<string>>(new Set());
  const lastTileIdRef = useRef<string | null>(null);
  const prevBoardLenRef = useRef<number>(0);

  // Pre-populate "seen" with any tile ids present on first render so we
  // don't re-animate the entire board on screen mount.
  useEffect(() => {
    if (seenIds.current.size === 0 && board.length > 0) {
      for (const t of board) seenIds.current.add(t.id);
      prevBoardLenRef.current = board.length;
    }
    // We deliberately depend on nothing so this only runs once at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect new tile(s) on every board change.
  useEffect(() => {
    if (board.length === 0) {
      animMap.current.clear();
      seenIds.current.clear();
      lastTileIdRef.current = null;
      prevBoardLenRef.current = 0;
      return;
    }
    // Find the FIRST tile id that's new — engine adds one tile per turn.
    let newId: string | null = null;
    let newIdx = -1;
    for (let i = 0; i < board.length; i++) {
      const t = board[i];
      if (!seenIds.current.has(t.id)) {
        newId = t.id;
        newIdx = i;
        seenIds.current.add(t.id);
        break;
      }
    }
    if (!newId || newIdx < 0) return;
    lastTileIdRef.current = newId;

    // Determine entry side AUTOMATICALLY from where the new tile landed:
    //   • index 0  & board grew → prepended → played on LEFT
    //   • index N-1 & board grew → appended → played on RIGHT
    //   • board was empty → "first" → drop from above
    const wasEmpty = prevBoardLenRef.current === 0;
    const detectedSide: EntrySide =
      wasEmpty ? "first"
        : (newIdx === 0 ? "left"
          : (newIdx === board.length - 1 ? "right"
            : (entrySide || "first")));
    prevBoardLenRef.current = board.length;

    const pos = layout.positions[newIdx];
    if (!pos) return;

    const startDX = (() => {
      if (detectedSide === "left") return -(playSize.w * 0.6);
      if (detectedSide === "right") return playSize.w * 0.6;
      return 0;
    })();
    const startDY = (() => {
      if (detectedSide === "first") return -(playSize.h * 0.5);
      return -(playSize.h * 0.25);
    })();

    const entry: AnimatedEntry = {
      progress: new Animated.Value(0),
      startDX, startDY,
      glow: new Animated.Value(0),
    };
    animMap.current.set(newId, entry);

    Animated.parallel([
      Animated.timing(entry.progress, {
        toValue: 1,
        duration: 380,
        easing: Easing.bezier(0.22, 1, 0.36, 1), // ease-out-quint-ish
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(360),
        Animated.timing(entry.glow, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(entry.glow, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.length, layout]);

  // Visible bounding rectangle of each tile (for animation hint AND for the
  // halo overlay around the last-played tile).
  const tileBoxFor = (pos: SnakePos, scale: number) => {
    const tw = TILE_W * scale;
    const th = TILE_H * scale;
    return {
      w: pos.isVertical ? th : tw,
      h: pos.isVertical ? tw : th,
    };
  };

  return (
    <LinearGradient
      colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.woodFrame}
    >
      {/* Walnut wood texture overlay */}
      <ImageBackground
        source={DAMMA_TEXTURES.wood}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.7, borderRadius: 18 }}
      />
      <View pointerEvents="none" style={styles.woodGoldTrim} />

      <View style={[styles.tableWrap, { shadowColor: pal.glow }]}>
        <LinearGradient
          colors={[FELT_CENTER, FELT_EDGE, FELT_DEEP]}
          start={{ x: 0.3, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.table}
        >
          <ImageBackground
            source={DAMMA_TEXTURES.felt}
            resizeMode="repeat"
            style={StyleSheet.absoluteFill}
            imageStyle={{ opacity: 0.32, borderRadius: 14 }}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill, styles.tableInlay,
              { borderColor: withAlpha(pal.railLight, 0.45) },
            ]}
          />

          {/* Ends header — sits ON TOP of the safe zone (does not consume it). */}
          <Text style={[styles.endsLabel, { color: withAlpha("#FFFFFF", 0.78) }]}>
            {endsLabel}: {leftEnd ?? "—"} / {rightEnd ?? "—"}
          </Text>

          {/* ── Playable safe zone (THE real board) ───────────────────────── */}
          <View style={styles.safeZone} onLayout={onSafeLayout}>
            {board.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyBoard}>{emptyText}</Text>
              </View>
            ) : (
              <View style={styles.snakeBox} pointerEvents="none">
                {layout.positions.map((pos) => {
                  const tile = board[pos.idx];
                  if (!tile) return null;
                  const box = tileBoxFor(pos, layout.scale);
                  const entry = animMap.current.get(tile.id);

                  // Translate the position so the tile is rendered by its
                  // top-left corner (absolute positioning is top-left in RN).
                  const left = pos.x - box.w / 2;
                  const top = pos.y - box.h / 2;

                  // Build transforms for the entrance animation. Native-driven
                  // translate + opacity + scale only.
                  const animatedStyle: any = entry ? {
                    opacity: entry.progress,
                    transform: [
                      {
                        translateX: entry.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [entry.startDX, 0],
                        }),
                      },
                      {
                        translateY: entry.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [entry.startDY, 0],
                        }),
                      },
                      {
                        scale: entry.progress.interpolate({
                          inputRange: [0, 0.6, 1],
                          outputRange: [0.6, 1.08, 1],
                        }),
                      },
                    ],
                  } : null;

                  // Golden halo overlay for ~1.3 s after landing.
                  const isLastPlaced = lastTileIdRef.current === tile.id;

                  return (
                    <Animated.View
                      key={tile.id}
                      style={[
                        styles.tileWrap,
                        { left, top, width: box.w, height: box.h },
                        animatedStyle,
                      ]}
                    >
                      {/* Soft halo behind newest tile */}
                      {isLastPlaced && entry && (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.lastHalo,
                            {
                              width: box.w + 12,
                              height: box.h + 12,
                              left: -6, top: -6,
                              opacity: entry.glow,
                            },
                          ]}
                        />
                      )}
                      {/* Rotation is applied to the inner View so the wrapper
                          (left/top + width/height) stays axis-aligned and the
                          translate animation works predictably. */}
                      <View
                        style={[
                          styles.tileRotate,
                          { transform: [{ rotate: `${pos.rotation}deg` }] },
                        ]}
                      >
                        <DominoTile
                          domino={tile}
                          horizontal
                          pal={pal}
                          scale={layout.scale}
                        />
                      </View>
                    </Animated.View>
                  );
                })}
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
    minHeight: 280,
  },
  woodGoldTrim: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: withAlpha(GOLD, 0.55),
  },
  // ── Felt wrapper inside the wood ─────────────────────────────────────────
  tableWrap: {
    flex: 1, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    borderRadius: 14, overflow: "hidden",
  },
  table: { flex: 1, borderRadius: 14, borderWidth: 0, overflow: "hidden" },
  tableInlay: { margin: 4, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" },

  // ── Header (Ends: x / y) ─────────────────────────────────────────────────
  endsLabel: {
    fontSize: 12, fontWeight: "700", textAlign: "center",
    paddingTop: 6, height: LABEL_H,
  },

  // ── Playable safe zone ──────────────────────────────────────────────────
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

  // Snake box fills the safe zone; children are absolute-positioned.
  snakeBox: { flex: 1, position: "relative" },

  // ── Tiles ────────────────────────────────────────────────────────────────
  tileWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  tileRotate: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Last-played golden halo
  lastHalo: {
    position: "absolute",
    borderRadius: 14,
    backgroundColor: withAlpha(GOLD, 0.18),
    borderWidth: 1.5,
    borderColor: withAlpha(GOLD, 0.85),
    shadowColor: GOLD,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
});
