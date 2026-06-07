// /app/frontend/app/muted-words.tsx
// =============================================================================
// PARTY4R — Muted Words manager
// =============================================================================
// • Add forbidden words that should be hidden from your view in chat.
// • Synced via /api/users/muted_words (server-side, multi-device).
// • Capped to 100 entries × 40 chars by the backend.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet, apiPost, apiDelete } from "@/src/api/client";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";

export default function MutedWordsScreen() {
  const router = useRouter();
  const { t } = useT();

  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ items: string[] }>("/users/muted_words");
      setWords(r.items || []);
    } catch {
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    const w = input.trim().toLowerCase();
    if (!w) return;
    if (w.length > 40) {
      Alert.alert(t("err_title"), t("mw_err_too_long"));
      return;
    }
    if (words.length >= 100) {
      Alert.alert(t("err_title"), t("mw_err_full"));
      return;
    }
    if (words.includes(w)) {
      setInput("");
      return;
    }
    setBusy(true);
    try {
      const r = await apiPost<{ items: string[] }>("/users/muted_words", { word: w });
      setWords(r.items || []);
      setInput("");
    } catch (e: any) {
      Alert.alert(t("err_title"), e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (w: string) => {
    setBusy(true);
    try {
      const r = await apiDelete<{ items: string[] }>(
        `/users/muted_words?word=${encodeURIComponent(w)}`,
      );
      setWords(r.items || []);
    } catch (e: any) {
      Alert.alert(t("err_title"), e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.bg}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-20} color={FUTURISTIC.brandSoft} speed={11000} thickness={200} intensity={0.45} />

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
              <Text style={styles.kicker}>{t("mw_kicker")}</Text>
              <Text style={styles.title}>{t("mw_title").toUpperCase()}</Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{words.length}/100</Text>
            </View>
          </View>

          <Text style={styles.help}>{t("mw_help")}</Text>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t("mw_placeholder")}
              placeholderTextColor={FUTURISTIC.textMuted}
              style={styles.input}
              maxLength={40}
              onSubmitEditing={add}
              returnKeyType="done"
            />
            <Pressable
              onPress={add}
              disabled={busy || !input.trim()}
              style={[styles.addBtn, (busy || !input.trim()) && { opacity: 0.5 }]}
              testID="mw-add"
            >
              {busy ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="add" size={22} color="#000" />
              )}
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={FUTURISTIC.brand} />
            </View>
          ) : (
            <FlatList
              data={words}
              keyExtractor={(w) => w}
              contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: 80 }}
              renderItem={({ item }) => (
                <View style={styles.wordRow}>
                  <Ionicons name="volume-mute-outline" size={18} color={FUTURISTIC.textMuted} />
                  <Text style={styles.wordText} numberOfLines={1}>{item}</Text>
                  <Pressable
                    onPress={() => remove(item)}
                    style={styles.removeBtn}
                    testID={`mw-remove-${item}`}
                  >
                    <Ionicons name="close" size={18} color="#FF8A50" />
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="volume-mute-outline" size={48} color={FUTURISTIC.brand} />
                  </View>
                  <Text style={styles.emptyTitle}>{t("mw_empty_title")}</Text>
                  <Text style={styles.emptySub}>{t("mw_empty_sub")}</Text>
                </View>
              }
            />
          )}
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
  countPill: {
    paddingHorizontal: 10, height: 28, borderRadius: 14,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    alignItems: "center", justifyContent: "center",
  },
  countText: {
    color: FUTURISTIC.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5,
  },
  kicker: {
    color: FUTURISTIC.textMuted, fontSize: 11, letterSpacing: 1.6,
    fontWeight: "700", marginBottom: 6, textTransform: "uppercase",
  },
  title: {
    ...TYPO.display, color: FUTURISTIC.textPrimary,
    textShadowColor: FUTURISTIC.brandSoft, textShadowRadius: 12,
  },
  help: {
    color: FUTURISTIC.textMuted, fontSize: 12,
    paddingHorizontal: 20, marginBottom: 12, lineHeight: 17,
  },
  inputRow: {
    flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 8,
  },
  input: {
    flex: 1, height: 48,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    borderRadius: 12, paddingHorizontal: 14,
    color: FUTURISTIC.textPrimary, fontSize: 15,
  },
  addBtn: {
    width: 48, height: 48,
    alignItems: "center", justifyContent: "center",
    borderRadius: 12, backgroundColor: FUTURISTIC.brand,
    shadowColor: FUTURISTIC.brand, shadowOpacity: 0.5, shadowRadius: 10,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    marginBottom: 8,
  },
  wordText: { color: FUTURISTIC.textPrimary, flex: 1, fontSize: 14, fontWeight: "600" },
  removeBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#FF8A5015",
    alignItems: "center", justifyContent: "center",
  },
  empty: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, paddingVertical: 64,
  },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center",
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.brandEdge, marginBottom: 20,
  },
  emptyTitle: { color: FUTURISTIC.textPrimary, fontSize: 16, fontWeight: "900" },
  emptySub: {
    color: FUTURISTIC.textMuted, fontSize: 13, marginTop: 8,
    textAlign: "center", maxWidth: 260,
  },
});
