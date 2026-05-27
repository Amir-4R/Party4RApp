// MetallicCard — premium card with chrome+neon iridescent border, inner
// gradient highlight and soft drop shadow. Lightweight: 2 LinearGradients
// + 1 nested View, no images.

import React, { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC, GRADIENTS, SHADOWS } from "@/src/theme/futuristic";

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  // accent tints the bottom-right of the edge gradient.
  accent?: "green" | "purple" | "cyber" | "neutral";
  // Padding inside the card. Defaults to FUTURISTIC.spacing.lg.
  padding?: number;
  // Radius (defaults to md). Use xl for hero.
  radius?: number;
  // Disable the shadow (e.g. when used inside scrolling lists for perf).
  noShadow?: boolean;
}

const EDGE_BY_ACCENT: Record<NonNullable<Props["accent"]>, readonly [string, string, string, string]> = {
  green: [
    "rgba(255,255,255,0.30)",
    "rgba(34,255,136,0.50)",
    "rgba(34,255,136,0.20)",
    "rgba(255,255,255,0.10)",
  ],
  purple: [
    "rgba(255,255,255,0.30)",
    "rgba(168,85,247,0.50)",
    "rgba(168,85,247,0.20)",
    "rgba(255,255,255,0.10)",
  ],
  cyber: [
    "rgba(255,255,255,0.30)",
    "rgba(51,230,255,0.50)",
    "rgba(51,230,255,0.20)",
    "rgba(255,255,255,0.10)",
  ],
  neutral: GRADIENTS.metalEdge as unknown as readonly [string, string, string, string],
};

export default function MetallicCard({
  children,
  style,
  accent = "neutral",
  padding = FUTURISTIC.spacing.lg,
  radius = FUTURISTIC.radius.md,
  noShadow = false,
}: Props) {
  const edge = EDGE_BY_ACCENT[accent];
  return (
    <View style={[!noShadow && SHADOWS.card, { borderRadius: radius }, style]}>
      {/* Outer iridescent metallic border — 1px gradient ring. */}
      <LinearGradient
        colors={edge as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.edge, { borderRadius: radius }]}
      >
        {/* Inner surface with subtle top highlight gradient. */}
        <View
          style={{
            margin: 1,
            borderRadius: radius - 1,
            backgroundColor: FUTURISTIC.surface1,
            overflow: "hidden",
          }}
        >
          <LinearGradient
            pointerEvents="none"
            colors={GRADIENTS.metalCard as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ padding }}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { padding: 0 },
});
