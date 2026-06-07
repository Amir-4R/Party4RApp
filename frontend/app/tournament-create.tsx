// /app/frontend/app/tournament-create.tsx
// =============================================================================
// PARTY4R — Create Tournament screen.
// =============================================================================

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiPost } from "@/src/api/client";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";

const PRESET_SIZES = [4, 8, 16, 32];

export default function CreateTournamentScreen() {
  const router = useRouter();
  const { t } = useT();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [prize, setPrize] = useState("");
  const [loading, setLoading] = useState(false);

  const onCreate = async () => {
    if (title.trim().length < 3) {
      Alert.alert(t("err_title"), t("tour_err_title_short"));
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost<{ id: string }>("/tournaments", {
        title: title.trim(),
        description: description.trim() || undefined,
        max_players: maxPlayers,
        prize: prize.trim() || undefined,
      });
      router.replace(`/tournament/${data.id}`);
    } catch (e: any) {
      Alert.alert(t("err_title"), e?.message || "Failed to create tournament");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.bg}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-20} color={FUTURISTIC.brandSoft} speed={11000} thickness={200} intensity={0.5} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{t("tour_create_kicker")}</Text>
              <Text style={styles.title}>{t("tour_create_title").toUpperCase()}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t("tour_label_title")}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("tour_placeholder_title")}
              placeholderTextColor={FUTURISTIC.textMuted}
              style={styles.input}
              maxLength={80}
            />

            <Text style={[styles.label, { marginTop: 18 }]}>{t("tour_label_desc")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("tour_placeholder_desc")}
              placeholderTextColor={FUTURISTIC.textMuted}
              style={[styles.input, { height: 90, textAlignVertical: "top" }]}
              multiline
              maxLength={500}
            />

            <Text style={[styles.label, { marginTop: 18 }]}>{t("tour_label_size")}</Text>
            <View style={styles.sizeRow}>
              {PRESET_SIZES.map((n) => {
                const active = maxPlayers === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setMaxPlayers(n)}
                    style={[styles.sizePill, active && styles.sizePillActive]}
                  >
                    <Text style={[styles.sizeText, active && styles.sizeTextActive]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 18 }]}>{t("tour_label_prize")}</Text>
            <TextInput
              value={prize}
              onChangeText={setPrize}
              placeholder={t("tour_placeholder_prize")}
              placeholderTextColor={FUTURISTIC.textMuted}
              style={styles.input}
              maxLength={120}
            />

            <Pressable
              onPress={onCreate}
              disabled={loading || title.trim().length < 3}
              style={[styles.cta, (loading || title.trim().length < 3) && { opacity: 0.55 }]}
              testID="tour-create-submit"
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="trophy" size={18} color="#000" />
                  <Text style={styles.ctaText}>{t("tour_create_cta")}</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
    borderRadius: 14, backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  kicker: {
    color: FUTURISTIC.textMuted, fontSize: 11, letterSpacing: 1.6,
    fontWeight: "700", marginBottom: 6, textTransform: "uppercase",
  },
  title: {
    ...TYPO.display, color: FUTURISTIC.textPrimary,
    textShadowColor: FUTURISTIC.brandSoft, textShadowRadius: 12,
  },
  scroll: { padding: 20 },
  label: {
    color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "800",
    letterSpacing: 1.3, marginBottom: 8, textTransform: "uppercase",
  },
  input: {
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: FUTURISTIC.textPrimary, fontSize: 15,
  },
  sizeRow: { flexDirection: "row", gap: 8 },
  sizePill: {
    flex: 1, paddingVertical: 12, alignItems: "center",
    backgroundColor: FUTURISTIC.surface1,
    borderRadius: 12, borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  sizePillActive: {
    backgroundColor: FUTURISTIC.brand + "20",
    borderColor: FUTURISTIC.brand,
  },
  sizeText: { color: FUTURISTIC.textMuted, fontWeight: "800", fontSize: 15 },
  sizeTextActive: { color: FUTURISTIC.brand },
  cta: {
    marginTop: 28, paddingVertical: 16,
    borderRadius: 14, backgroundColor: FUTURISTIC.brand,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: FUTURISTIC.brand, shadowOpacity: 0.6, shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 0.8 },
});
