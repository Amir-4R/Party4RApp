// /app/frontend/app/legal/privacy-policy.tsx — Phase 2
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/constants/avatars";

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>PRIVACY POLICY</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h1}>Privacy Policy — Party4RApp</Text>
        <Text style={styles.p}>Effective: 2026</Text>

        <Text style={styles.h2}>1. What we collect</Text>
        <Text style={styles.p}>
          • Username, nickname, password hash (bcrypt — never plaintext){"\n"}
          • Profile customizations (avatar id, optional bio, banner, badges){"\n"}
          • Aggregated room participation time (used only for "Total hours"){"\n"}
          • Friend graph (your friend list and pending requests){"\n"}
          • Optional uploaded avatar image (base64, max ~500KB){"\n"}
          • Last-seen timestamp (only when you have the app open){"\n"}
        </Text>
        <Text style={styles.h2}>2. What we DON'T collect</Text>
        <Text style={styles.p}>
          • Device IDs, IMEI, advertising IDs{"\n"}
          • Location data{"\n"}
          • Contacts / phonebook{"\n"}
          • Background activity{"\n"}
          • Analytics on your messages or browsing
        </Text>
        <Text style={styles.h2}>3. Auto-deletion</Text>
        <Text style={styles.p}>
          • Chat messages are auto-deleted after 30 days.{"\n"}
          • Reports are auto-deleted after 90 days.{"\n"}
          • Rooms are deleted when the last member leaves.
        </Text>
        <Text style={styles.h2}>4. Your rights</Text>
        <Text style={styles.p}>
          • Delete your account at any time (Settings → Delete Account).{"\n"}
          • Export your data via support email.{"\n"}
          • Control who sees you via Privacy Settings.{"\n"}
          • Block any user instantly.
        </Text>
        <Text style={styles.h2}>5. Contact</Text>
        <Text style={styles.p}>
          For privacy questions or data requests: yemenamer20@gmail.com
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
