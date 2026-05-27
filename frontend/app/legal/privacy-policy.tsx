// /app/frontend/app/legal/privacy-policy.tsx — Phase 6 futuristic redesign.
// Long-form Privacy Policy page using the same metallic section pattern.

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import ScreenScaffold from "@/src/components/futuristic/ScreenScaffold";
import MetallicCard from "@/src/components/futuristic/MetallicCard";

const SECTIONS = [
  {
    title: "1. What We Collect",
    body: "• Account: username, nickname, password (hashed), avatar choice\n• Chats / DMs: text + base64 images you send (auto-deleted after 30/60 days)\n• Rooms: name, host, members, last video URL\n• Reports: reporter ID, target ID, reason (90-day retention)\n• Honor points: integer score per user\n• Privacy settings: your visibility choices",
  },
  {
    title: "2. Data Minimization (TTL)",
    body: "We delete data automatically when no longer needed:\n• Chats — 30 days\n• Direct messages — 60 days\n• Reports — 90 days\n• Rooms — deleted when empty for 24 hours",
  },
  {
    title: "3. What We Don't Collect",
    body: "• Email addresses (unless you contact support)\n• Phone numbers\n• Location data\n• Browsing history outside our app\n• Contacts / address books\n• Payment info (the app is free)",
  },
  {
    title: "4. Who Can See What",
    body: "You fully control your visibility from Settings → Privacy:\n• Online status — everyone / friends / nobody\n• Last seen — everyone / friends / nobody\n• Profile — everyone / friends / nobody\n• Shared time — everyone / friends / nobody",
  },
  {
    title: "5. Account Deletion",
    body: "You can permanently delete your account from Settings → Account → Delete Account. This wipes all your data immediately. No recovery is possible.",
  },
  {
    title: "6. Children",
    body: "Party4RApp is not for users under 13. If we learn an account belongs to a child under 13 we will delete it.",
  },
  {
    title: "7. Contact",
    body: "Privacy questions: yemenamer20@gmail.com",
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ScreenScaffold kicker="LEGAL" title="PRIVACY POLICY" subtitle="Effective 2026 · Minimum age 13" reducedAmbient>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>We collect the minimum amount of data needed to make Party4R work, and we delete it as soon as we can.</Text>
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
