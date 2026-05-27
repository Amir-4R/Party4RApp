// Splash screen — tall metallic Party4R artwork as the full background.
// The artwork already contains the brand mark, so we DON'T overlay any
// other logo. We just add a subtle pulsing neon glow + loading indicator.

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  ImageBackground,
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
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
    }, 1300);
    return () => clearTimeout(t);
  }, [user, loading, router]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]} testID="splash-screen">
      <ImageBackground
        source={require("@/assets/images/party4r-splash.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {/* Subtle vignette so loading indicator stays readable */}
        <View style={[styles.vignette, { backgroundColor: "rgba(7,7,16,0.10)" }]} />

        {/* Pulsing neon glow (purely cosmetic, the artwork carries the brand) */}
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
              shadowColor: theme.brand,
            },
          ]}
        />

        {/* Loading indicator at bottom with brand-style text */}
        <Animated.View style={[styles.loaderWrap, { opacity: fade }]}>
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={[styles.loaderText, { color: theme.textPrimary }]}>
            INITIALIZING SYNC ENGINE
          </Text>
        </Animated.View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  vignette: { ...StyleSheet.absoluteFillObject },
  glow: {
    position: "absolute",
    top: "35%",
    alignSelf: "center",
    width: 280,
    height: 280,
    borderRadius: 140,
    shadowOpacity: 0.5,
    shadowRadius: 90,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  loaderWrap: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 14,
  },
  loaderText: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "800",
  },
});
