// /app/frontend/app/privacy.tsx — Phase 2 Privacy controls
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/constants/avatars";
import { apiGet, apiPatch } from "@/src/api/client";

type Visibility = "everyone" | "friends" | "nobody";
interface Privacy {
  online_visibility: Visibility;
  last_seen_visibility: Visibility;
  profile_visibility: Visibility;
  shared_time_visibility: Visibility;
}

const ROWS: { key: keyof Privacy; label: string; sub: string }[] = [
  { key: "online_visibility", label: "Online status", sub: "Who can see when you're online" },
  { key: "last_seen_visibility", label: "Last seen", sub: "Who can see when you were last active" },
  { key: "profile_visibility", label: "Profile", sub: "Who can view your profile" },
  { key: "shared_time_visibility", label: "Shared time", sub: "Who can see hours spent together" },
];

const OPTIONS: { v: Visibility; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: "everyone", label: "Everyone", icon: "globe-outline" },
  { v: "friends", label: "Friends only", icon: "people-outline" },
  { v: "nobody", label: "Nobody", icon: "lock-closed-outline" },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const [p, setP] = useState<Privacy | null>(null);
  const [busyKey, setBusyKey] = useState<keyof Privacy | null>(null);

  useEffect(() => {
    apiGet<Privacy>("/users/privacy").then(setP).catch(() => setP({
      online_visibility: "everyone", last_seen_visibility: "everyone",
      profile_visibility: "everyone", shared_time_visibility: "friends",
    }));
  }, []);

  const update = async (key: keyof Privacy, v: Visibility) => {
    if (!p || p[key] === v) return;
    setBusyKey(key);
    try {
      const res = await apiPatch<Privacy>("/users/privacy", { [key]: v });
      setP(res);
    } catch (e) {} finally { setBusyKey(null); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>PRIVACY</Text>
          <Text style={styles.subtitle}>Control what others see</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {!p ? (
          <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />
        ) : ROWS.map(row => (
          <View key={row.key} style={styles.section}>
            <Text style={styles.sectionLabel}>{row.label.toUpperCase()}</Text>
            <Text style={styles.sectionSub}>{row.sub}</Text>
            <View style={styles.card}>
              {OPTIONS.map((opt, i) => {
                const active = p[row.key] === opt.v;
                const busy = busyKey === row.key;
                return (
                  <React.Fragment key={opt.v}>
                    {i > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      onPress={() => update(row.key, opt.v)}
                      activeOpacity={0.8}
                      style={[styles.optRow, active && { backgroundColor: COLORS.brandDim }]}
                    >
                      <Ionicons name={opt.icon} size={20} color={active ? COLORS.brand : COLORS.textSecondary} />
                      <Text style={[styles.optLabel, active && { color: COLORS.brand }]}>{opt.label}</Text>
                      {busy && active ? <ActivityIndicator color={COLORS.brand} size="small" /> :
                        active ? <Ionicons name="checkmark-circle" size={22} color={COLORS.brand} /> :
                          <View style={styles.radio} />}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 2 },
  sectionSub: { color: COLORS.textMuted, fontSize: 12, marginBottom: 10 },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  optRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  optLabel: { color: COLORS.textPrimary, fontSize: 15, flex: 1, fontWeight: "600" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 46 },
});
