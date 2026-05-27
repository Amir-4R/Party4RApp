// GlassPanel — blurred glassmorphism with a metallic 1px border highlight.
// Used for sticky headers, bottom nav, and floating sheets.

import React, { ReactNode } from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  tint?: "dark" | "light" | "default";
  // Show the metallic top edge highlight (1px gradient line).
  topEdge?: boolean;
  // Show metallic bottom edge.
  bottomEdge?: boolean;
  radius?: number;
}

export default function GlassPanel({
  children,
  style,
  intensity = 35,
  tint = "dark",
  topEdge = false,
  bottomEdge = false,
  radius = 0,
}: Props) {
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      {/* Blurred glass — falls back to solid fill on Android lower-end. */}
      {Platform.OS === "web" ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: FUTURISTIC.glassTint }]} />
      ) : (
        <BlurView
          intensity={intensity}
          tint={tint}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Color wash over the blur to keep brand identity (else looks gray). */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: FUTURISTIC.glassFill },
        ]}
      />
      {topEdge && (
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", FUTURISTIC.metalEdgeTop, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topLine}
        />
      )}
      {bottomEdge && (
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", FUTURISTIC.metalEdgeBottom, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.botLine}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  botLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});
