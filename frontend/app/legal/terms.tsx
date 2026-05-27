// /app/frontend/app/legal/terms.tsx — Phase 7 fully localized.

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import ScreenScaffold from "@/src/components/futuristic/ScreenScaffold";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import { useT } from "@/src/context/LanguageContext";

export default function TermsScreen() {
  const { t } = useT();
  const SECTIONS = [
    { title: t("tos_1_title"), body: t("tos_1_body") },
    { title: t("tos_2_title"), body: t("tos_2_body") },
    { title: t("tos_3_title"), body: t("tos_3_body") },
    { title: t("tos_4_title"), body: t("tos_4_body") },
    { title: t("tos_5_title"), body: t("tos_5_body") },
    { title: t("tos_6_title"), body: t("tos_6_body") },
  ];
  return (
    <ScreenScaffold kicker={t("kicker_legal")} title={t("terms_title")} subtitle={t("legal_subtitle")} reducedAmbient>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>{t("terms_intro")}</Text>
        {SECTIONS.map((s, i) => (
          <View key={i} style={{ marginTop: 14 }}>
            <MetallicCard padding={16} radius={FUTURISTIC.radius.md} accent={i === 0 ? "green" : i === SECTIONS.length - 1 ? "purple" : "neutral"}>
              <Text style={styles.h2}>{s.title}</Text>
              <Text style={styles.p}>{s.body}</Text>
            </MetallicCard>
          </View>
        ))}
        <View style={{ height: 70 }} />
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingTop: 8 },
  intro: {
    color: FUTURISTIC.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.2,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  h2: { ...TYPO.h2, color: FUTURISTIC.brand, marginBottom: 8 },
  p: { color: FUTURISTIC.textSecondary, fontSize: 14, lineHeight: 22, letterSpacing: 0.15 },
});
