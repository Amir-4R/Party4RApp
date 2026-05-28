// /app/frontend/app/index.tsx
// =============================================================================
// PARTY4R — Cinematic Splash Screen (Phase 6 final)
// =============================================================================
//
// Single canonical splash. Uses the new widescreen 1672×941 artwork
// (party4r-splash.png) as the ONLY background image. All previous splash
// assets (party4r-logo, splash-icon, splash-image, splash-full) have been
// deleted from /assets/images.
//
// Design goals (from user spec):
//   • Cinematic, premium, futuristic, immersive.
//   • Adaptive scaling that works on phones, tablets, and larger screens.
//   • No stretch / wrong crop / black empty bars / misalignment.
//   • Subtle parallax + slow zoom for depth.
//   • Diagonal light sweep across metallic surfaces (single pass).
//   • Soft green + purple ambient glow at top/bottom.
//   • Lightweight floating particles (8 dots, GPU-only transforms).
//   • Integrated loading bar that fills over 1.5s and exits.
//   • Cinematic synth startup tone (1.5s WAV via expo-audio).
//   • All animation is Reanimated transforms + opacity (no JS layout work).
//
// Performance notes:
//   • Particles use Animated.View on absolute layer — single repeating
//     transform driver each, no setState updates.
//   • The artwork stays at fixed pixel dimensions (computed from
//     useWindowDimensions) so resize math runs once per orientation change.

import React, { useEffect } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  interpolate,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useAudioPlayer } from "expo-audio";
import { useAuth } from "@/src/context/AuthContext";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

// ----- Constants -----
const SPLASH_DURATION = 2400; // ms — total visible time
const STARTUP_SOUND = require("@/assets/sounds/startup.wav");
const ARTWORK = require("@/assets/images/party4r-splash.png");

// =============================================================================
// FloatingParticle — single GPU-driven floating dot (sparkle effect).
// Drifts upward + fades. Loops with a random delay so 8 of these create a
// passive shimmer effect without expensive layout work.
// =============================================================================
function FloatingParticle({
  startX,
  delay,
  speed,
  size = 3,
  color = "rgba(34,255,136,0.7)",
}: {
  startX: number;
  delay: number;
  speed: number;
  size?: number;
  color?: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: speed, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, [t, delay, speed]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.1, 0.85, 1], [0, 0.95, 0.4, 0]),
    transform: [
      { translateY: interpolate(t.value, [0, 1], [0, -180]) },
      { translateX: interpolate(t.value, [0, 0.5, 1], [0, 8, -6]) },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: startX,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
        },
        style,
      ]}
    />
  );
}

// =============================================================================
// ShimmerSweep — single diagonal light streak that sweeps across once
// per splash (4s sweep, looped). Lives over the artwork as a blend layer.
// =============================================================================
function ShimmerSweep({ width, height }: { width: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.3, 0.7, 1], [0, 0.55, 0.55, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-width, width]) },
      { rotate: "-18deg" },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shimmerWrap,
        { width: width * 0.32, height: height * 1.6, top: -height * 0.3 },
        style,
      ]}
    >
      <LinearGradient
        colors={["transparent", "rgba(255,255,255,0.22)", "rgba(34,255,136,0.10)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

// =============================================================================
// LoaderBar — segmented progress bar at the bottom with brand glow.
// =============================================================================
function LoaderBar() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.cubic) });
  }, [p]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${p.value * 100}%`,
  }));
  return (
    <View style={styles.barWrap}>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFillContainer, fillStyle]}>
          <LinearGradient
            colors={[FUTURISTIC.brand, FUTURISTIC.brandSoft, FUTURISTIC.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.barFillGradient}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// =============================================================================
// PulseDot — three glowing dots that pulse staggered.
// =============================================================================
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
  return <Animated.View style={[styles.pulseDot, s]} />;
}

// =============================================================================
// SplashScreen
// =============================================================================
export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useT();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const fade = useSharedValue(0);          // overall fade-in
  const exit = useSharedValue(0);          // fade-out before redirect
  const zoom = useSharedValue(1);          // slow parallax zoom 1 -> 1.04
  const glowPulse = useSharedValue(0);     // ambient color wash pulse
  const loaderOpacity = useSharedValue(0); // delayed loader fade-in

  // -- Audio: cinematic synth startup tone (preloaded) --
  const player = useAudioPlayer(STARTUP_SOUND);

  // -- Mount: kick off animations and play sound --
  useEffect(() => {
    fade.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    zoom.value = withTiming(1.04, { duration: SPLASH_DURATION, easing: Easing.out(Easing.quad) });
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    loaderOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));

    // Play startup audio (best-effort, no failure UX needed)
    try {
      player.volume = 0.7;
      player.play();
    } catch {}
  }, [fade, zoom, glowPulse, loaderOpacity, player]);

  // -- After loading + minimum splash time, redirect --
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      exit.value = withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) });
      setTimeout(() => router.replace(user ? "/(tabs)/home" : "/login"), 420);
    }, SPLASH_DURATION);
    return () => clearTimeout(t);
  }, [user, loading, router, exit]);

  // -- Animated styles --
  const containerStyle = useAnimatedStyle(() => ({
    opacity: fade.value * (1 - exit.value),
  }));
  const artworkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoom.value }],
  }));
  const ambientTopStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + glowPulse.value * 0.35,
  }));
  const ambientBottomStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + (1 - glowPulse.value) * 0.35,
  }));
  const loaderStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
    transform: [{ translateY: (1 - loaderOpacity.value) * 8 }],
  }));

  return (
    <View style={styles.root} testID="splash-screen">
      <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
        {/* ===== 1. Widescreen artwork (adaptive scaling + parallax zoom) ===== */}
        <Animated.View style={[StyleSheet.absoluteFill, artworkStyle]}>
          <Image
            source={ARTWORK}
            // Use COVER so the central composition (phone + 4R logo) fills
            // the screen on any aspect ratio. Background circuit board edges
            // gracefully bleed off-screen when needed.
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFill,
              // React Native Web shim — `resizeMode` prop sometimes doesn't
              // propagate to object-fit reliably. Force it explicitly on web.
              ...(Platform.OS === "web"
                ? [{ objectFit: "cover" as const, width: "100%" as const, height: "100%" as const }]
                : []),
            ]}
            fadeDuration={0}
          />
        </Animated.View>

        {/* ===== 2. Ambient atmospheric lighting (green top, purple bottom) ===== */}
        <Animated.View pointerEvents="none" style={[styles.ambientTop, ambientTopStyle]}>
          <LinearGradient
            colors={["rgba(34,255,136,0.22)", "rgba(34,255,136,0.08)", "transparent"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.ambientBottom, ambientBottomStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(168,85,247,0.10)", "rgba(168,85,247,0.20)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* ===== 3. Diagonal light sweep (single shimmer streak) ===== */}
        <ShimmerSweep width={SCREEN_W} height={SCREEN_H} />

        {/* ===== 4. Floating particles (8 distributed dots) ===== */}
        <FloatingParticle startX={SCREEN_W * 0.10} delay={0} speed={4400} size={3} color="rgba(34,255,136,0.65)" />
        <FloatingParticle startX={SCREEN_W * 0.22} delay={600} speed={5200} size={2} color="rgba(255,255,255,0.55)" />
        <FloatingParticle startX={SCREEN_W * 0.34} delay={1200} speed={4800} size={3} color="rgba(168,85,247,0.65)" />
        <FloatingParticle startX={SCREEN_W * 0.46} delay={400} speed={5600} size={2} color="rgba(34,255,136,0.55)" />
        <FloatingParticle startX={SCREEN_W * 0.58} delay={1500} speed={4600} size={3} color="rgba(255,255,255,0.5)" />
        <FloatingParticle startX={SCREEN_W * 0.70} delay={800} speed={5000} size={2} color="rgba(168,85,247,0.55)" />
        <FloatingParticle startX={SCREEN_W * 0.82} delay={300} speed={5400} size={3} color="rgba(34,255,136,0.65)" />
        <FloatingParticle startX={SCREEN_W * 0.92} delay={1800} speed={4700} size={2} color="rgba(255,255,255,0.5)" />

        {/* ===== 5. Bottom loader sequence ===== */}
        <Animated.View pointerEvents="none" style={[styles.loaderWrap, loaderStyle]}>
          <View style={styles.dotsRow}>
            <PulseDot delay={0} />
            <PulseDot delay={180} />
            <PulseDot delay={360} />
          </View>
          <Text style={styles.loaderText}>{t("initializing")}</Text>
          <LoaderBar />
          <Text style={styles.versionText}>{t("version_label")}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  // ----- Artwork layer -----
  artLayer: { position: "absolute" },
  // ----- Ambient lighting -----
  ambientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "32%",
  },
  ambientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "38%",
  },
  // ----- Shimmer sweep -----
  shimmerWrap: {
    position: "absolute",
    left: 0,
  },
  // ----- Particles -----
  particle: {
    position: "absolute",
    bottom: 140,
    shadowOpacity: 0.95,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  // ----- Pulse dots -----
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: FUTURISTIC.brand,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  // ----- Loader -----
  loaderWrap: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
  },
  dotsRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  loaderText: { ...TYPO.caption, color: FUTURISTIC.textPrimary, opacity: 0.9 },
  barWrap: {
    width: 200,
    paddingVertical: 6,
  },
  barTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 2,
    overflow: "hidden",
  },
  barFillContainer: {
    height: "100%",
    overflow: "hidden",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.85,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  barFillGradient: {
    flex: 1,
    borderRadius: 2,
  },
  versionText: { ...TYPO.micro, color: FUTURISTIC.textMuted },
});
