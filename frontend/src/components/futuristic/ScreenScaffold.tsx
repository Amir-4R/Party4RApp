// /app/frontend/src/components/futuristic/ScreenScaffold.tsx
//
// Reusable scaffold for secondary screens (Settings, Privacy, Blocked, Legal).
// Provides:
//   • Deep-space gradient background.
//   • Two subtle ambient LightBeams (green + purple).
//   • Standardised header: chrome back button, kicker label, neon-glow title,
//     optional right action slot.
//   • Animated GlowDivider directly under the header.
//   • SafeAreaView + scroll-ready content slot.
//
// Usage:
//   <ScreenScaffold kicker="ACCOUNT" title="SETTINGS" subtitle="Optional tagline">
//     <ScrollView>...</ScrollView>
//   </ScreenScaffold>

import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import GlowDivider from "@/src/components/futuristic/GlowDivider";

interface Props {
  kicker?: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  contentStyle?: ViewStyle;
  // Dim down ambient effects (e.g. for long-form Legal pages).
  reducedAmbient?: boolean;
}

export default function ScreenScaffold({
  kicker,
  title,
  subtitle,
  rightSlot,
  children,
  contentStyle,
  reducedAmbient = false,
}: Props) {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={GRADIENTS.appBg as unknown as string[]}
        style={StyleSheet.absoluteFill}
      />
      {!reducedAmbient && (
        <>
          <LightBeam
            angle={-20}
            color="rgba(34,255,136,0.10)"
            speed={11000}
            thickness={200}
            intensity={0.40}
          />
          <LightBeam
            angle={18}
            color="rgba(168,85,247,0.09)"
            speed={13000}
            delay={2400}
            thickness={180}
            intensity={0.36}
          />
        </>
      )}

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            testID="scaffold-back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {rightSlot ?? null}
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
          <GlowDivider color={FUTURISTIC.brand} speed={5400} />
        </View>

        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
  },
  kicker: {
    ...TYPO.micro,
    color: FUTURISTIC.textMuted,
  },
  title: {
    ...TYPO.h1,
    color: FUTURISTIC.textPrimary,
    textShadowColor: "rgba(34,255,136,0.25)",
    textShadowRadius: 10,
  },
  subtitle: {
    color: FUTURISTIC.textMuted,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
});
