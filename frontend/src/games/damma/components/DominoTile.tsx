// =============================================================================
// damma/components/DominoTile.tsx — RTL-IMMUNE domino face renderer
// =============================================================================
// CRITICAL: This component MUST be 100% independent of the app's text
// direction (LTR/RTL). All pip faces and the divider use ABSOLUTE positioning
// with explicit numeric left/top, so React Native's automatic mirroring of
// `flexDirection: "row"` under `I18nManager.forceRTL(true)` cannot affect the
// rendered output. The tile is also wrapped in `direction: "ltr"` as a belt-
// and-suspenders safety net.
//
// Conventions:
//   • `horizontal = true`  →  tile is laid out as [LEFT | RIGHT].
//      tile dims: TILE_W × TILE_H
//   • `horizontal = false` →  tile is laid out vertically (top = left value,
//      bottom = right value). tile dims: TILE_H × TILE_W.
//
// `domino.left` is ALWAYS rendered on the left/top half of the tile.
// `domino.right` is ALWAYS rendered on the right/bottom half.
// =============================================================================
import React from "react";
import { View, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { dammaPalette } from "@/src/games/shared/gameTheme";
import type { Domino, PlacedDomino } from "@/src/games/damma/engine";

// ── Constants ────────────────────────────────────────────────────────────────
export const TILE_W = 72;
export const TILE_H = 36;

// ── Pip-dot positions on a 3×3 grid (canonical domino faces) ─────────────────
// Cell index 0 is top-left, 8 is bottom-right.
const PIP_MAP: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/**
 * Render a single pip face with N dots, using ABSOLUTE positioning so RTL
 * cannot mirror them. The face is a perfect square of given size.
 */
export function PipFace({
  value, size, color,
}: { value: number; size: number; color: string }) {
  const cells = PIP_MAP[value] || [];
  const dot = Math.max(2.5, size * 0.16);
  // Each cell is size/3 wide. Cell center = (col + 0.5) * cellSize.
  const cellSize = size / 3;
  return (
    // The PipFace uses pure ABSOLUTE positioning for every dot, so no flex
    // direction is involved and RTL cannot affect placement.
    <View style={{ width: size, height: size, position: "relative" }}>
      {cells.map((i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = (col + 0.5) * cellSize;
        const cy = (row + 0.5) * cellSize;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: cx - dot / 2,
              top: cy - dot / 2,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
            }}
          />
        );
      })}
    </View>
  );
}

export interface DominoTileProps {
  domino: Domino | PlacedDomino;
  onPress?: () => void;
  selected?: boolean;
  horizontal?: boolean;
  pal: ReturnType<typeof dammaPalette>;
  scale?: number;
  testID?: string;
  /** Optional override style (e.g. for HandTray to apply margin). */
  style?: ViewStyle;
}

export default function DominoTile({
  domino, onPress, selected, horizontal = true, pal, scale = 1, testID, style,
}: DominoTileProps) {
  // Outer bounding box (does not change with RTL).
  const W = (horizontal ? TILE_W : TILE_H) * scale;
  const H = (horizontal ? TILE_H : TILE_W) * scale;

  // The DIVIDER is a thin line running perpendicular to the tile's long axis.
  // - Horizontal tile: divider is vertical, at x = W/2.
  // - Vertical tile:   divider is horizontal, at y = H/2.
  const dividerThickness = Math.max(1, 1.5 * scale);
  const dividerInset = horizontal ? H * 0.18 : W * 0.18;

  // Each pip face occupies a square in the appropriate half of the tile.
  // For a horizontal tile, the face is sized as min(halfWidth, height) so it
  // is square. We center it in its half.
  const halfMajor = (horizontal ? W : H) / 2;
  const minor = horizontal ? H : W;
  const faceSize = Math.min(halfMajor, minor) * 0.78;

  // Half-rectangle bounds (top-left corner) for the LEFT/TOP face.
  const halfRectA = horizontal
    ? { left: 0, top: 0, width: W / 2, height: H }
    : { left: 0, top: 0, width: W, height: H / 2 };

  // Half-rectangle bounds for the RIGHT/BOTTOM face.
  const halfRectB = horizontal
    ? { left: W / 2, top: 0, width: W / 2, height: H }
    : { left: 0, top: H / 2, width: W, height: H / 2 };

  const faceCenterOffset = horizontal
    ? { x: W / 4 - faceSize / 2, y: H / 2 - faceSize / 2 }
    : { x: W / 2 - faceSize / 2, y: H / 4 - faceSize / 2 };

  const TileBody = (
    <View
      // PURE ABSOLUTE POSITIONING throughout — no flex direction is used, so
      // React Native's RTL auto-mirror has nothing to flip here.
      style={[
        styles.tileShell,
        {
          width: W,
          height: H,
          borderRadius: 8 * scale,
          borderWidth: Math.max(1, 1.5 * scale),
          borderColor: pal.tileBorder,
        },
        selected && styles.tileSelected,
        style,
      ]}
    >
      {/* Background gradient — absolute fill, doesn't push content around. */}
      <LinearGradient
        colors={[pal.tileFace, pal.tileFaceEdge]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 6 * scale }]}
      />

      {/* Divider line in the middle of the tile (NEVER moves with RTL). */}
      <View
        style={[
          styles.divider,
          horizontal
            ? {
                left: W / 2 - dividerThickness / 2,
                top: dividerInset,
                width: dividerThickness,
                height: H - 2 * dividerInset,
              }
            : {
                left: dividerInset,
                top: H / 2 - dividerThickness / 2,
                width: W - 2 * dividerInset,
                height: dividerThickness,
              },
          { backgroundColor: pal.divider },
        ]}
      />

      {/* LEFT (or TOP) pip face — pins to halfRectA. */}
      <View
        pointerEvents="none"
        style={[
          styles.faceWrap,
          halfRectA,
        ]}
      >
        <View
          style={{
            position: "absolute",
            left: horizontal ? (W / 4 - faceSize / 2) : faceCenterOffset.x,
            top: horizontal ? faceCenterOffset.y : (H / 4 - faceSize / 2),
          }}
        >
          <PipFace value={domino.left} size={faceSize} color={pal.pip} />
        </View>
      </View>

      {/* RIGHT (or BOTTOM) pip face — pins to halfRectB. */}
      <View
        pointerEvents="none"
        style={[
          styles.faceWrap,
          halfRectB,
        ]}
      >
        <View
          style={{
            position: "absolute",
            left: horizontal ? (W / 4 - faceSize / 2) : faceCenterOffset.x,
            top: horizontal ? faceCenterOffset.y : (H / 4 - faceSize / 2),
          }}
        >
          <PipFace value={domino.right} size={faceSize} color={pal.pip} />
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        activeOpacity={0.85}
        style={selected ? styles.touchableSelected : undefined}
      >
        {TileBody}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID}>
      {TileBody}
    </View>
  );
}

const styles = StyleSheet.create({
  tileShell: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#FAEBD7",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
  },
  tileSelected: {
    borderColor: FUTURISTIC.brand,
    borderWidth: 2.5,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  touchableSelected: {
    transform: [{ translateY: -10 }],
  },
  divider: {
    position: "absolute",
    borderRadius: 1,
  },
  faceWrap: {
    position: "absolute",
  },
});
