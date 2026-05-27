// Party4R splash screen — Phase 1 Cyber Neon revamp.
// Uses the user-provided neon logo as the centerpiece with a pulsing
// purple+green glow ring, on the metallic neon background artwork.

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  ImageBackground,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fade-in
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Subtle neon glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse, fade]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      router.replace(user ? "/(tabs)/home" : "/login");
    }, 1100);
    return () => clearTimeout(t);
  }, [user, loading, router]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <ImageBackground
      source={require("@/assets/images/party4r-splash.png")}
      style={[styles.container, { backgroundColor: theme.bg }]}
      resizeMode="cover"
      testID="splash-screen"
    >
      {/* Dark overlay so the logo stays readable */}
      <View style={[styles.overlay, { backgroundColor: "rgba(7,7,16,0.45)" }]} />

      {/* Logo block */}
      <Animated.View style={[styles.logoWrap, { opacity: fade }]}>
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
              backgroundColor: theme.brandDim,
              shadowColor: theme.brand,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.glowOuter,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
              backgroundColor: theme.accentDim,
              shadowColor: theme.accent,
            },
          ]}
        />
        <Image
          source={require("@/assets/images/party4r-logo.png")}
          style={styles.logoImg}
          resizeMode="contain"
        />
        <Text style={[styles.brandName, { color: theme.textPrimary }]}>
          PARTY<Text style={{ color: theme.brand }}>4R</Text>
        </Text>
        <Text style={[styles.tagline, { color: theme.textSecondary }]}>
          WATCH · TOGETHER
        </Text>
      </Animated.View>

      {/* Neon loading indicator at bottom */}
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="small" color={theme.brand} />
        <Text style={[styles.loaderText, { color: theme.textMuted }]}>
          INITIALIZING SYNC ENGINE
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 100,
  },
  overlay: { ...StyleSheet.absoluteFillObject },
  logoWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    shadowOpacity: 0.9,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  glowOuter: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    shadowOpacity: 0.7,
    shadowRadius: 100,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  logoImg: {
    width: 200,
    height: 200,
  },
  brandName: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 8,
    marginTop: 24,
  },
  tagline: {
    fontSize: 12,
    letterSpacing: 8,
    marginTop: 10,
    fontWeight: "700",
  },
  loaderWrap: {
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "800",
  },
});
