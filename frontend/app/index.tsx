// /app/frontend/app/index.tsx
// Party4R — cinematic splash screen.
//
// Premium futuristic feel:
//   • Deep AMOLED black backdrop (matches native OS splash for zero flicker).
//   • Tall metallic Party4R artwork centered, scaled to fill verticals.
//   • Soft vignette + subtle slow color wash to keep the artwork moody.
//   • Two diagonal LightBeam sweeps (one green, one purple, staggered).
//   • Gentle pulsing neon glow behind the 4R logo region.
//   • Letter-spaced loader text fades up at the bottom.
//   • Smooth fade-in from black, smooth fade-out to the next screen.
//
// Lightweight: pure transforms / opacity (GPU-accelerated via Reanimated).
// No particles, no heavy SVG, no extra image assets.

import React, { useEffect } from "react";
import {
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import LightBeam from "@/src/components/futuristic/LightBeam";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // ---------------------- Reanimated values ----------------------
  const fade = useSharedValue(0);
  const exit = useSharedValue(0);
  const glow = useSharedValue(0);
  const scale = useSharedValue(1.05);

  useEffect(() => {
    // Cinematic fade-in from black
    fade.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) });
    // Subtle parallax-style scale settle (1.05 → 1.0)
    scale.value = withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) });
    // Soft pulsing glow
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [fade, glow, scale]);

  // ---------------------- Navigation timer ----------------------
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      // Fade out gracefully then push.
      exit.value = withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) });
      setTimeout(() => router.replace(user ? "/(tabs)/home" : "/login"), 380);
    }, 1700);
    return () => clearTimeout(t);
  }, [user, loading, router, exit]);

  // ---------------------- Animated styles ----------------------
  const containerStyle = useAnimatedStyle(() => ({
    opacity: fade.value * (1 - exit.value),
  }));
  const artworkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.20 + glow.value * 0.55,
    transform: [{ scale: 0.92 + glow.value * 0.12 }],
  }));
  const loaderStyle = useAnimatedStyle(() => ({
    opacity: withDelay(700, withTiming(fade.value, { duration: 600 })),
    transform: [{ translateY: withDelay(700, withTiming(fade.value * -2, { duration: 600 })) }],
  }));

  return (
    <View style={styles.root} testID="splash-screen">
      {/* Solid black underlay (matches native OS splash so transition is invisible) */}
      <View style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
        {/* Tall metallic artwork as the centerpiece */}
        <Animated.View style={[StyleSheet.absoluteFill, artworkStyle]}>
          <ImageBackground
            source={require("@/assets/images/party4r-splash.png")}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Deep vignette top+bottom to keep the central logo region as hero */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(0,0,0,0.55)",
            "rgba(0,0,0,0.05)",
            "rgba(0,0,0,0.05)",
            "rgba(0,0,0,0.85)",
          ]}
          locations={[0, 0.25, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Pulsing neon glow behind the 4R logo region (vertically centered) */}
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />

        {/* Two diagonal light beams (staggered, slow) */}
        <LightBeam
          angle={-18}
          color="rgba(34,255,136,0.32)"
          speed={6000}
          delay={0}
          thickness={180}
          intensity={0.55}
        />
        <LightBeam
          angle={14}
          color="rgba(168,85,247,0.28)"
          speed={6800}
          delay={1400}
          thickness={160}
          intensity={0.48}
        />

        {/* Bottom loader (letter-spaced premium label) */}
        <Animated.View style={[styles.loaderWrap, loaderStyle]} pointerEvents="none">
          <View style={styles.dotsRow}>
            <PulseDot delay={0} />
            <PulseDot delay={180} />
            <PulseDot delay={360} />
          </View>
          <Text style={styles.loaderText}>INITIALIZING SYNC ENGINE</Text>
          <Text style={styles.versionText}>v 1.0</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// A small pulsing neon dot. 3 of these form the loader row.
function PulseDot({ delay = 0 }: { delay?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 540, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 540, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [v, delay]);
  const s = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.65,
    transform: [{ scale: 0.85 + v.value * 0.35 }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: FUTURISTIC.brand,
          shadowColor: FUTURISTIC.brand,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        },
        s,
      ]}
    />
  );
}

const GLOW_SIZE = Math.min(SCREEN_W, 380);
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  glow: {
    position: "absolute",
    top: SCREEN_H * 0.30,
    alignSelf: "center",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: "rgba(34,255,136,0.10)",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.85,
    shadowRadius: 110,
    shadowOffset: { width: 0, height: 0 },
  },
  loaderWrap: {
    position: "absolute",
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 14,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  loaderText: {
    ...TYPO.caption,
    color: FUTURISTIC.textPrimary,
    opacity: 0.88,
  },
  versionText: {
    ...TYPO.micro,
    color: FUTURISTIC.textMuted,
  },
});
