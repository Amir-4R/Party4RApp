// /app/frontend/app/privacy.tsx — Phase 7 fully localized.
// Privacy controls: who sees online, last seen, profile, shared time.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPatch } from "@/src/api/client";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import ScreenScaffold from "@/src/components/futuristic/ScreenScaffold";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import { useT } from "@/src/context/LanguageContext";

type Visibility = "everyone" | "friends" | "nobody";
interface Privacy {
  online_visibility: Visibility;
  last_seen_visibility: Visibility;
  profile_visibility: Visibility;
  shared_time_visibility: Visibility;
}

export default function PrivacyScreen() {
  const { t } = useT();
  const [p, setP] = useState<Privacy | null>(null);
  const [busyKey, setBusyKey] = useState<keyof Privacy | null>(null);

  // Rows + options are defined inside the component so they're re-translated
  // every time the language changes.
  const ROWS: {
    key: keyof Privacy;
    label: string;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "online_visibility", label: t("privacy_online_status"), sub: t("privacy_online_status_sub"), icon: "radio-button-on" },
    { key: "last_seen_visibility", label: t("privacy_last_seen"), sub: t("privacy_last_seen_sub"), icon: "time-outline" },
    { key: "profile_visibility", label: t("privacy_profile"), sub: t("privacy_profile_sub"), icon: "person-circle-outline" },
    { key: "shared_time_visibility", label: t("privacy_shared_time"), sub: t("privacy_shared_time_sub"), icon: "hourglass-outline" },
  ];
  const OPTIONS: { v: Visibility; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { v: "everyone", label: t("visibility_everyone"), icon: "globe-outline" },
    { v: "friends", label: t("visibility_friends"), icon: "people-outline" },
    { v: "nobody", label: t("visibility_nobody"), icon: "lock-closed-outline" },
  ];

  useEffect(() => {
    apiGet<Privacy>("/users/privacy")
      .then(setP)
      .catch(() =>
        setP({
          online_visibility: "everyone",
          last_seen_visibility: "everyone",
          profile_visibility: "everyone",
          shared_time_visibility: "friends",
        })
      );
  }, []);

  const update = async (key: keyof Privacy, v: Visibility) => {
    if (!p || p[key] === v) return;
    setBusyKey(key);
    try {
      const res = await apiPatch<Privacy>("/users/privacy", { [key]: v });
      setP(res);
    } catch {} finally {
      setBusyKey(null);
    }
  };

  return (
    <ScreenScaffold kicker={t("kicker_visibility")} title={t("privacy_title")} subtitle={t("privacy_subtitle")}>
      {!p ? (
        <ActivityIndicator color={FUTURISTIC.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingTop: 8 }}>
          {ROWS.map((row) => (
            <View key={row.key} style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.iconBubble}>
                  <Ionicons name={row.icon} size={16} color={FUTURISTIC.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>{row.label.toUpperCase()}</Text>
                  <Text style={styles.sectionSub}>{row.sub}</Text>
                </View>
              </View>
              <MetallicCard padding={0} radius={FUTURISTIC.radius.md} accent={p[row.key] === "nobody" ? "purple" : p[row.key] === "friends" ? "green" : "neutral"}>
                {OPTIONS.map((opt, i) => {
                  const active = p[row.key] === opt.v;
                  const busy = busyKey === row.key;
                  return (
                    <React.Fragment key={opt.v}>
                      {i > 0 && <View style={styles.divider} />}
                      <TouchableOpacity
                        onPress={() => update(row.key, opt.v)}
                        activeOpacity={0.85}
                        style={[styles.optRow, active && { backgroundColor: FUTURISTIC.brandSoft }]}
                      >
                        <Ionicons name={opt.icon} size={20} color={active ? FUTURISTIC.brand : FUTURISTIC.textSecondary} />
                        <Text style={[styles.optLabel, active && { color: FUTURISTIC.brand }]}>{opt.label}</Text>
                        {busy && active ? (
                          <ActivityIndicator color={FUTURISTIC.brand} size="small" />
                        ) : active ? (
                          <Ionicons name="checkmark-circle" size={22} color={FUTURISTIC.brand} />
                        ) : (
                          <View style={styles.radio} />
                        )}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </MetallicCard>
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: FUTURISTIC.brandSoft,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: { ...TYPO.caption, color: FUTURISTIC.textPrimary },
  sectionSub: { color: FUTURISTIC.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 0.2 },
  optRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  optLabel: { color: FUTURISTIC.textPrimary, fontSize: 14, flex: 1, fontWeight: "700", letterSpacing: 0.3 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: FUTURISTIC.borderStrong,
  },
  divider: { height: 1, backgroundColor: FUTURISTIC.borderSoft, marginLeft: 44 },
});
