// /app/frontend/app/(tabs)/_layout.tsx
//
// Futuristic floating glass tab bar.
// • Sits 16pt above the bottom safe-area inset.
// • Glass blur background + chrome metallic top edge.
// • Active tab: pill with iridescent gradient border + soft brand glow.
// • Inactive: muted icon, no chrome.

import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC } from "@/src/theme/futuristic";

function FloatingTabBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Glass blur layer */}
      {Platform.OS === "web" ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(8, 9, 18, 0.78)" },
          ]}
        />
      ) : (
        <BlurView
          intensity={Platform.OS === "android" ? 32 : 55}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Tint wash so the brand identity stays even on light backdrops */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(10, 12, 22, 0.55)" },
        ]}
      />
      {/* Chrome top edge — 1px iridescent gradient */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(255,255,255,0.30)",
          "rgba(34,255,136,0.40)",
          "rgba(168,85,247,0.40)",
          "rgba(255,255,255,0.30)",
          "transparent",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topEdge}
        pointerEvents="none"
      />
      {/* Subtle inner glow at the bottom */}
      <LinearGradient
        colors={["transparent", "rgba(34,255,136,0.06)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "transparent",
          borderTopColor: "transparent",
          borderTopWidth: 0,
          height: 72 + bottomInset,
          paddingTop: 10,
          paddingBottom: bottomInset,
          elevation: 24,
          shadowColor: FUTURISTIC.brand,
          shadowOpacity: 0.22,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: -6 },
        },
        tabBarBackground: () => <FloatingTabBackground />,
        tabBarActiveTintColor: FUTURISTIC.brand,
        tabBarInactiveTintColor: FUTURISTIC.textMuted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "900",
          letterSpacing: 2.0,
          marginTop: 2,
          textTransform: "uppercase",
        },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tab_rooms"),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="tv-outline" activeName="tv" />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t("tab_friends"),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="people-outline" activeName="people" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              name="person-circle-outline"
              activeName="person-circle"
            />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  focused,
  name,
  activeName,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  activeName: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.iconWrap}>
      {focused && (
        <>
          {/* Outer soft glow */}
          <View style={styles.activeGlow} />
          {/* Iridescent metallic pill border */}
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.45)",
              "rgba(34,255,136,0.55)",
              "rgba(168,85,247,0.35)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activePillEdge}
          >
            <View style={styles.activePillFill} />
          </LinearGradient>
        </>
      )}
      <Ionicons
        name={focused ? activeName : name}
        size={focused ? 22 : 20}
        color={focused ? FUTURISTIC.brand : FUTURISTIC.textMuted}
        style={focused ? { zIndex: 2 } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 60,
    position: "relative",
  },
  activeGlow: {
    position: "absolute",
    top: -8,
    left: 4,
    right: 4,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(34,255,136,0.18)",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  activePillEdge: {
    position: "absolute",
    top: -4,
    left: 6,
    right: 6,
    height: 36,
    borderRadius: 18,
    padding: 1,
  },
  activePillFill: {
    flex: 1,
    backgroundColor: "rgba(8, 9, 18, 0.85)",
    borderRadius: 17,
  },
});
