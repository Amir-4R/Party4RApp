import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS } from "@/src/constants/avatars";

export default function SplashScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const pulse = useRef(new Animated.Value(0)).current;

  // Subtle neon pulse on the logo glow (no heavy animation)
  useEffect(() => {
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
  }, [pulse]);

  // Hold the splash for at least 800ms so it never flashes
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      router.replace(user ? "/(tabs)/home" : "/login");
    }, 800);
    return () => clearTimeout(t);
  }, [user, loading, router]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.container} testID="splash-screen">
      {/* Logo block */}
      <View style={styles.logoWrap}>
        <Animated.View
          style={[
            styles.glow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
        <View style={styles.logoBox}>
          <Text style={styles.logo4}>4</Text>
        </View>
        <Text style={styles.brandName}>
          PARTY<Text style={styles.brand4r}>4R</Text>APP
        </Text>
        <Text style={styles.tagline}>WATCH · TOGETHER</Text>
      </View>

      {/* Neon loading indicator */}
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="small" color={COLORS.brand} />
        <Text style={styles.loaderText}>INITIALIZING SYNC ENGINE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 80,
  },
  logoWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.brandDim,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.9,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceElevated,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  logo4: {
    color: COLORS.brand,
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 70,
  },
  brandName: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 6,
    marginTop: 28,
  },
  brand4r: { color: COLORS.brand },
  tagline: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 6,
    marginTop: 10,
    fontWeight: "600",
  },
  loaderWrap: {
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "700",
  },
});
