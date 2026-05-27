// Floating glass-blur bottom tab bar — Phase 1 Mega Update
// =========================================================
// Uses expo-blur for the frosted-glass effect, sits above the system
// gesture bar, has neon-green active state with subtle glow.

import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { useT } from "@/src/context/LanguageContext";

function FloatingTabBackground() {
  const { theme } = useTheme();
  return (
    <BlurView
      intensity={Platform.OS === "android" ? 30 : 50}
      tint="dark"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.navBg,
          borderTopColor: theme.borderAccent,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    />
  );
}

export default function TabsLayout() {
  const { t } = useT();
  const { theme } = useTheme();
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
          height: 64 + bottomInset,
          paddingTop: 10,
          paddingBottom: bottomInset,
          // Subtle outer neon-glow on Android (no effect on iOS, no harm)
          elevation: 20,
          shadowColor: theme.brand,
          shadowOpacity: 0.18,
          shadowRadius: 24,
        },
        tabBarBackground: () => <FloatingTabBackground />,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 1.4,
          marginTop: 2,
        },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tab_rooms"),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon focused={focused} color={color} size={size} name="tv-outline" activeName="tv" />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t("tab_friends"),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon focused={focused} color={color} size={size} name="people-outline" activeName="people" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon focused={focused} color={color} size={size} name="person-circle-outline" activeName="person-circle" />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  focused,
  color,
  size,
  name,
  activeName,
}: {
  focused: boolean;
  color: string;
  size: number;
  name: keyof typeof Ionicons.glyphMap;
  activeName: keyof typeof Ionicons.glyphMap;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.iconWrap}>
      {focused && (
        <View
          style={[
            styles.activePill,
            { backgroundColor: theme.brandDim, borderColor: theme.brand },
          ]}
        />
      )}
      <Ionicons
        name={focused ? activeName : name}
        size={size}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    width: 56,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    top: -6,
    left: 0,
    right: 0,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
});
