// /app/frontend/app/legal/terms.tsx — Phase 6 futuristic redesign.
// Long-form Terms of Service page with section accents in MetallicCards.

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import ScreenScaffold from "@/src/components/futuristic/ScreenScaffold";
import MetallicCard from "@/src/components/futuristic/MetallicCard";

const SECTIONS = [
  {
    title: "1. Acceptable Use",
    body: "You agree NOT to:\n• Harass, threaten, or bully other users\n• Share sexually explicit, hateful, or violent content\n• Spam links or commercial content without permission\n• Impersonate others or share false identities\n• Attempt to access accounts that aren't yours\n• Circumvent moderation, blocks, or honor restrictions",
  },
  {
    title: "2. Reporting & Moderation",
    body: "You can report users or messages from any room. Reports are investigated by our moderation team. False reports may reduce your honor score.",
  },
  {
    title: "3. Honor Score",
    body: "Everyone starts with 100 honor points. Verified reports against you reduce your score. Low honor (≤ 20) restricts your ability to send messages or create rooms.",
  },
  {
    title: "4. Account Termination",
    body: "We may suspend or terminate accounts that violate these terms. You can delete your account at any time via Settings.",
  },
  {
    title: "5. No Warranties",
    body: 'Party4RApp is provided "as is." We don\'t guarantee uninterrupted service.',
  },
  {
    title: "6. Contact",
    body: "Questions or appeals: yemenamer20@gmail.com",
  },
];

export default function TermsScreen() {
  return (
    <ScreenScaffold kicker="LEGAL" title="TERMS" subtitle="Effective 2026 · Minimum age 13" reducedAmbient>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>By using Party4R you agree to the following terms. We keep them short, plain, and fair.</Text>
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
