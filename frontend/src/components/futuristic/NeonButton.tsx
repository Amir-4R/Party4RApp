// NeonButton — pressable with metallic edge, neon glow on press, and
// optional Ionicons leading icon.

import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle, TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC, SHADOWS, TYPO } from "@/src/theme/futuristic";

type Variant = "primary" | "accent" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
  labelStyle?: TextStyle;
  testID?: string;
}

const VARIANT_COLORS: Record<
  Variant,
  { fg: string; bg: string; edge: readonly string[]; glow: string; gradient: readonly string[] }
> = {
  primary: {
    fg: "#001A0C",
    bg: FUTURISTIC.brand,
    edge: ["rgba(255,255,255,0.55)", "rgba(34,255,136,0.55)"] as const,
    glow: FUTURISTIC.brandGlow,
    gradient: ["#26FF93", "#10C66D"] as const,
  },
  accent: {
    fg: "#FFFFFF",
    bg: FUTURISTIC.accent,
    edge: ["rgba(255,255,255,0.55)", "rgba(168,85,247,0.55)"] as const,
    glow: FUTURISTIC.accentGlow,
    gradient: ["#B975FA", "#7A2FD8"] as const,
  },
  ghost: {
    fg: FUTURISTIC.textPrimary,
    bg: FUTURISTIC.surface1,
    edge: ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)"] as const,
    glow: "transparent",
    gradient: [FUTURISTIC.surface2, FUTURISTIC.surface1] as const,
  },
  danger: {
    fg: "#FFFFFF",
    bg: FUTURISTIC.error,
    edge: ["rgba(255,255,255,0.45)", "rgba(255,61,113,0.55)"] as const,
    glow: "rgba(255,61,113,0.50)",
    gradient: ["#FF5A85", "#D81E54"] as const,
  },
};

const SIZE_TOKENS: Record<Size, { h: number; px: number; iconSize: number; fontSize: number }> = {
  sm: { h: 36, px: 14, iconSize: 14, fontSize: 12 },
  md: { h: 46, px: 18, iconSize: 16, fontSize: 13 },
  lg: { h: 54, px: 24, iconSize: 18, fontSize: 14 },
};

export default function NeonButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  disabled = false,
  fullWidth = false,
  style,
  labelStyle,
  testID,
}: Props) {
  const colors = VARIANT_COLORS[variant];
  const tokens = SIZE_TOKENS[size];
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.04 }],
    opacity: disabled ? 0.4 : 1,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pressed.value * 0.55,
  }));

  // Idle subtle pulse to keep things alive without distracting.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (disabled) return;
    pulse.value = withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) });
    const id = setInterval(() => {
      pulse.value = withTiming(pulse.value > 0.5 ? 0 : 1, {
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
      });
    }, 1800);
    return () => clearInterval(id);
  }, [pulse, disabled]);
  const idlePulseStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.18,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        fullWidth && { alignSelf: "stretch" },
        style,
      ]}
    >
      <Pressable
        testID={testID}
        disabled={disabled}
        onPressIn={() => (pressed.value = withTiming(1, { duration: 90 }))}
        onPressOut={() => (pressed.value = withTiming(0, { duration: 160 }))}
        onPress={onPress}
      >
        {/* Glow underlay — only visible for non-ghost variants. */}
        {variant !== "ghost" && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              glowStyle,
              { shadowColor: colors.glow, shadowOpacity: 1, shadowRadius: 22 },
            ]}
          />
        )}
        {variant !== "ghost" && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              idlePulseStyle,
              { shadowColor: colors.glow, shadowOpacity: 1, shadowRadius: 18 },
            ]}
          />
        )}
        {/* Metallic edge */}
        <LinearGradient
          colors={colors.edge as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: tokens.h / 2 + 1, padding: 1 }}
        >
          {/* Inner fill */}
          <LinearGradient
            colors={colors.gradient as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.inner,
              {
                height: tokens.h,
                paddingHorizontal: tokens.px,
                borderRadius: tokens.h / 2,
              },
            ]}
          >
            {leftIcon && (
              <Ionicons name={leftIcon} size={tokens.iconSize} color={colors.fg} />
            )}
            <Text
              style={[
                styles.label,
                {
                  color: colors.fg,
                  fontSize: tokens.fontSize,
                  marginLeft: leftIcon ? 8 : 0,
                  marginRight: rightIcon ? 8 : 0,
                },
                labelStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {rightIcon && (
              <Ionicons name={rightIcon} size={tokens.iconSize} color={colors.fg} />
            )}
            {/* Top highlight (chrome reflection) */}
            <View pointerEvents="none" style={[styles.shine, { borderRadius: tokens.h / 2 }]} />
          </LinearGradient>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
    ...SHADOWS.glowBrand,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowRadius: 2,
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: "rgba(255,255,255,0.18)",
    opacity: 0.4,
  },
});
