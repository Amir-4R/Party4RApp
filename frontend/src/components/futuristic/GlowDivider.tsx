// GlowDivider — a thin gradient line with an animated shimmer that sweeps
// across once every few seconds. Used to delimit cards / sections without
// flat boring separators.

import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { FUTURISTIC } from "@/src/theme/futuristic";

interface Props {
  color?: string;
  // Width of the moving highlight in % of parent. Default 22.
  shimmerWidthPct?: number;
  style?: ViewStyle | ViewStyle[];
  // Speed in ms for one full sweep. Default 4200ms (slow + premium).
  speed?: number;
}

export default function GlowDivider({
  color = FUTURISTIC.brand,
  shimmerWidthPct = 22,
  style,
  speed = 4200,
}: Props) {
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1.2, { duration: speed, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
  }, [progress, speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${progress.value * 100}%` }],
  }));

  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient
        colors={["transparent", color + "66", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.shimmerWrap, animatedStyle]} pointerEvents="none">
        <LinearGradient
          colors={["transparent", color, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${shimmerWidthPct}%`, height: "100%" }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 1.5,
    width: "100%",
    overflow: "hidden",
  },
  shimmerWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "-22%",
    width: "100%",
  },
});
