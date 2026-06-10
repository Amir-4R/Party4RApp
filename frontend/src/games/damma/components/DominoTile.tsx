// =============================================================================
// damma/components/DominoTile.tsx — single domino face renderer (UI only)
// =============================================================================
// Pure presentation. Renders a domino as two pip faces separated by a divider,
// with an optional `selected` glow and optional `onPress` handler.
// No engine/AI logic here.
// =============================================================================
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { dammaPalette } from "@/src/games/shared/gameTheme";
import type { Domino, PlacedDomino } from "@/src/games/damma/engine";

// ── Pip-dot layouts on a 3×3 grid (true domino faces) ────────────────────────
const PIP_MAP: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function PipFace({ value, size, color }: { value: number; size: number; color: string }) {
  const cells = PIP_MAP[value] || [];
  const dot = Math.max(2.5, size * 0.16);
  return (
    <View style={[styles.pipFace, { width: size, height: size }]}>
      {Array.from({ length: 9 }).map((_, i) => (
        <View key={i} style={styles.pipCell}>
          {cells.includes(i) && (
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
          )}
        </View>
      ))}
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
}

export default function DominoTile({
  domino, onPress, selected, horizontal, pal, scale = 1, testID,
}: DominoTileProps) {
  const W = (horizontal ? 72 : 40) * scale;
  const H = (horizontal ? 40 : 72) * scale;
  const faceSize = (horizontal ? 30 : 28) * scale;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      style={[
        styles.tile,
        {
          width: W, height: H,
          backgroundColor: pal.tileFace, borderColor: pal.tileBorder,
          borderRadius: 8 * scale, borderWidth: Math.max(1, 1.5 * scale),
        },
        selected && {
          borderColor: FUTURISTIC.brand, borderWidth: 2.5,
          shadowColor: FUTURISTIC.brand, shadowOpacity: 0.7, shadowRadius: 8,
          transform: [{ translateY: -10 }],
        },
      ]}
    >
      <LinearGradient
        colors={[pal.tileFace, pal.tileFaceEdge]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.tileInner,
          horizontal && styles.tileInnerH,
          { borderRadius: 6 * scale },
        ]}
      >
        <PipFace value={domino.left} size={faceSize} color={pal.pip} />
        <View style={[
          horizontal ? styles.dividerV : styles.dividerH,
          { backgroundColor: pal.divider, height: horizontal ? "62%" : Math.max(1, 1.5 * scale), width: horizontal ? Math.max(1, 1.5 * scale) : "62%" },
        ]} />
        <PipFace value={domino.right} size={faceSize} color={pal.pip} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 2,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 1, height: 2 },
  },
  tileInner: { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "space-around", paddingVertical: 3 },
  tileInnerH: { flexDirection: "row", paddingVertical: 0, paddingHorizontal: 3 },
  dividerH: { width: "62%", height: 1.5, borderRadius: 1 },
  dividerV: { height: "62%", width: 1.5, borderRadius: 1 },
  pipFace: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  pipCell: { width: "33.33%", height: "33.33%", alignItems: "center", justifyContent: "center" },
});
