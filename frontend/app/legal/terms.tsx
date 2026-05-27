// /app/frontend/app/legal/terms.tsx — Phase 2
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/constants/avatars";

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>TERMS OF SERVICE</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h1}>Terms of Service</Text>
        <Text style={styles.p}>Effective: 2026 · Minimum age: 13</Text>

        <Text style={styles.h2}>1. Acceptable Use</Text>
        <Text style={styles.p}>
          You agree NOT to:{"\n"}
          • Harass, threaten, or bully other users{"\n"}
          • Share sexually explicit, hateful, or violent content{"\n"}
          • Spam links or commercial content without permission{"\n"}
          • Impersonate others or share false identities{"\n"}
          • Attempt to access accounts that aren't yours{"\n"}
          • Circumvent moderation, blocks, or honor restrictions
        </Text>
        <Text style={styles.h2}>2. Reporting & Moderation</Text>
        <Text style={styles.p}>
          You can report users or messages from any room. Reports are
          investigated by our moderation team. False reports may reduce your honor score.
        </Text>
        <Text style={styles.h2}>3. Honor Score</Text>
        <Text style={styles.p}>
          Everyone starts with 100 honor points. Verified reports against you
          reduce your score. Low honor (≤ 20) restricts your ability to send
          messages or create rooms.
        </Text>
        <Text style={styles.h2}>4. Account Termination</Text>
        <Text style={styles.p}>
          We may suspend or terminate accounts that violate these terms.
          You can delete your account at any time via Settings.
        </Text>
        <Text style={styles.h2}>5. No Warranties</Text>
        <Text style={styles.p}>
          Party4RApp is provided "as is." We don't guarantee uninterrupted service.
        </Text>
        <Text style={styles.h2}>6. Contact</Text>
        <Text style={styles.p}>
          Questions or appeals: yemenamer20@gmail.com
        </Text>
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  body: { padding: 22 },
  h1: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "900", marginBottom: 6 },
  h2: { color: COLORS.brand, fontSize: 14, fontWeight: "800", letterSpacing: 1, marginTop: 22, marginBottom: 8 },
  p: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22 },
});
