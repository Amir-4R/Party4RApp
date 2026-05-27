// /app/frontend/app/index.tsx
// Party4R — Cinematic Splash Screen (rebuilt for correct scaling)
//
// Layout principles:
//   • Display the FULL vertical artwork composition.
//   • No aggressive zoom / cropping.
//   • No circular overlay glow on top of the artwork.
//   • Aspect-ratio-preserving CONTAIN fit, centered both axes.
//   • Pure-black fill on the sides if the device aspect is taller/wider
//     than the artwork (856×1536, ratio 0.557).
//   • Cinematic only through a single clean fade-in.
//   • Loader text + 3 pulsing dots stay at the bottom in the safe area.
//
// IMPORTANT: We give the Image EXPLICIT pixel dimensions (from
// useWindowDimensions) and place `resizeMode` INSIDE the style prop so
// React Native Web maps it to `object-fit: contain` reliably. Without
// this, percentage-based widths get rendered at the image's natural
// size and `objectFit` falls back to `fill`.

import React, { useEffect } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
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
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";

const ART_W = 856;
const ART_H = 1536;
const ART_RATIO = ART_W / ART_H; // ~0.557

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  // useWindowDimensions stays in sync with rotation / resize, unlike
  // Dimensions.get() which captures a snapshot at import time.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  // ----- Compute exact contained artwork rect (no percentages, no maths
  // happening inside React Native Web's resizeMode shim) -----
  const SCREEN_RATIO = SCREEN_W / SCREEN_H;
  let artW: number;
  let artH: number;
  if (SCREEN_RATIO > ART_RATIO) {
    // Screen is wider than artwork → constrain by height.
    artH = SCREEN_H;
    artW = SCREEN_H * ART_RATIO;
  } else {
    // Screen is narrower / equal → constrain by width.
    artW = SCREEN_W;
    artH = SCREEN_W / ART_RATIO;
  }

  const fade = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    // Single clean fade-in. No scale, no zoom, no breathing.
    fade.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [fade]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      exit.value = withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) });
      setTimeout(() => router.replace(user ? "/(tabs)/home" : "/login"), 380);
    }, 1700);
    return () => clearTimeout(t);
  }, [user, loading, router, exit]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fade.value * (1 - exit.value),
  }));
  const loaderStyle = useAnimatedStyle(() => ({
    opacity: withDelay(700, withTiming(fade.value, { duration: 600 })),
    transform: [
      { translateY: withDelay(700, withTiming(fade.value * -2, { duration: 600 })) },
    ],
  }));

  return (
    <View style={styles.root} testID="splash-screen">
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, containerStyle]}>
        <Image
          source={require("@/assets/images/party4r-splash.png")}
          // EXPLICIT dimensions — guarantees the artwork is rendered at the
          // exact contained size and centered, regardless of the platform
          // layout engine. We then also set resizeMode inside the style so
          // React Native Web maps it to object-fit: contain reliably.
          style={[
            {
              width: artW,
              height: artH,
              // @ts-ignore — RN style does accept resizeMode here.
              resizeMode: "contain",
              ...Platform.select({
                web: { objectFit: "contain" as const },
                default: {},
              }),
            },
          ]}
          fadeDuration={0}
        />

        {/* Bottom cinematic loader */}
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

// ----- Pulse dot -----
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  center: { alignItems: "center", justifyContent: "center" },
  loaderWrap: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
  },
  dotsRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  loaderText: { ...TYPO.caption, color: FUTURISTIC.textPrimary, opacity: 0.88 },
  versionText: { ...TYPO.micro, color: FUTURISTIC.textMuted },
});
