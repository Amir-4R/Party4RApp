// LightBeam — passive cinematic effect: a soft beam that slowly sweeps
// down/across the screen. Used in the splash and as ambient lighting in
// hero sections. GPU-accelerated via Reanimated transforms.

import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface Props {
  // Tilt of the beam in degrees.
  angle?: number;
  color?: string;
  // Duration of one sweep cycle.
  speed?: number;
  // Delay before first sweep (used to stagger multiple beams).
  delay?: number;
  // Direction: "down" (top->bottom) or "right" (left->right).
  direction?: "down" | "right";
  // Beam thickness in px.
  thickness?: number;
  // Beam opacity at peak.
  intensity?: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function LightBeam({
  angle = -18,
  color = "rgba(34,255,136,0.45)",
  speed = 5200,
  delay = 0,
  direction = "down",
  thickness = 160,
  intensity = 0.7,
}: Props) {
  const t = useSharedValue(0);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: speed, easing: Easing.inOut(Easing.sin) }),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(startTimer);
  }, [t, speed, delay]);

  const TRAVEL = direction === "down" ? SCREEN_H + thickness * 2 : SCREEN_W + thickness * 2;
  const animatedStyle = useAnimatedStyle(() => {
    const offset = t.value * TRAVEL - thickness * 2;
    if (direction === "down") {
      return { transform: [{ translateY: offset }, { rotate: `${angle}deg` }] };
    }
    return { transform: [{ translateX: offset }, { rotate: `${angle}deg` }] };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: direction === "down" ? -thickness * 2 : -SCREEN_H * 0.2,
            left: direction === "right" ? -thickness * 2 : -SCREEN_W * 0.3,
            width: direction === "down" ? SCREEN_W * 1.8 : thickness,
            height: direction === "down" ? thickness : SCREEN_H * 1.8,
            opacity: intensity,
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={["transparent", color, "transparent"]}
          start={direction === "down" ? { x: 0, y: 0 } : { x: 0, y: 0 }}
          end={direction === "down" ? { x: 0, y: 1 } : { x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
