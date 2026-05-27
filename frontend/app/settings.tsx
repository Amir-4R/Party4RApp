// /app/frontend/app/settings.tsx
// Dedicated app settings screen. For now: language toggle (English / Arabic).
// Designed to host future preferences (notifications, theme, privacy, etc.).

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/constants/avatars";
import { useT } from "@/src/context/LanguageContext";
import { useTheme } from "@/src/context/ThemeContext";
import { THEMES, ThemeId } from "@/src/constants/themes";

export default function SettingsScreen() {
  const router = useRouter();
  const { t, lang, setLang } = useT();
  const { theme, themeId, setThemeId } = useTheme();
  const [switching, setSwitching] = useState<null | "en" | "ar">(null);
  const [themeSwitching, setThemeSwitching] = useState<ThemeId | null>(null);

  const handleSwitch = async (l: "en" | "ar") => {
    if (l === lang || switching) return;
    setSwitching(l);
    const { needsRestart } = await setLang(l);
    setSwitching(null);
    if (needsRestart) {
      Alert.alert(t("rtl_restart_title"), t("rtl_restart_msg"), [
        { text: t("rtl_restart_ok") },
      ]);
    }
  };

  const handleTheme = async (id: ThemeId) => {
    if (id === themeId) return;
    setThemeSwitching(id);
    await setThemeId(id);
    setThemeSwitching(null);
  };

  const renderLangRow = (
    code: "en" | "ar",
    label: string,
    sub: string,
    flag: string
  ) => {
    const active = lang === code;
    const busy = switching === code;
    return (
      <TouchableOpacity
        key={code}
        testID={`lang-${code}`}
        onPress={() => handleSwitch(code)}
        activeOpacity={0.85}
        style={[styles.langRow, active && styles.langRowActive]}
      >
        <Text style={styles.flag}>{flag}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.langName, active && { color: COLORS.brand }]}>
            {label}
          </Text>
          <Text style={styles.langSub}>{sub}</Text>
        </View>
        {busy ? (
          <ActivityIndicator color={COLORS.brand} />
        ) : active ? (
          <Ionicons name="checkmark-circle" size={22} color={COLORS.brand} />
        ) : (
          <View style={styles.radio} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="settings-back"
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("app_settings")}</Text>
          <Text style={styles.subtitle}>{t("settings_subtitle")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Theme section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THEME</Text>
          <View style={styles.card}>
            {(Object.keys(THEMES) as ThemeId[]).map((id, idx) => {
              const tdef = THEMES[id];
              const active = themeId === id;
              const busy = themeSwitching === id;
              return (
                <React.Fragment key={id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    testID={`theme-${id}`}
                    onPress={() => handleTheme(id)}
                    activeOpacity={0.85}
                    style={[styles.themeRow, active && styles.langRowActive]}
                  >
                    <View style={styles.themePreview}>
                      <View style={[styles.swatch, { backgroundColor: tdef.bg }]} />
                      <View style={[styles.swatch, { backgroundColor: tdef.brand, borderWidth: 1, borderColor: tdef.brand }]} />
                      <View style={[styles.swatch, { backgroundColor: tdef.accent }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.themeName, active && { color: tdef.brand }]}>
                        {tdef.name}
                      </Text>
                      <Text style={styles.langSub}>
                        {id === "neon" ? "Neon green · Cyber default" :
                          id === "midnight" ? "Blue · Calm dark" :
                          id === "amoled" ? "Pure black · Battery saver" :
                          "Purple-dominant · High contrast"}
                      </Text>
                    </View>
                    {busy ? (
                      <ActivityIndicator color={tdef.brand} />
                    ) : active ? (
                      <Ionicons name="checkmark-circle" size={22} color={tdef.brand} />
                    ) : (
                      <View style={styles.radio} />
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Language section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("language_section")}</Text>
          <View style={styles.card}>
            {renderLangRow("en", "English", "Default", "🇺🇸")}
            <View style={styles.divider} />
            {renderLangRow("ar", "العربية", "Arabic", "🇾🇪")}
          </View>
        </View>

        {/* Placeholder for future sections (kept simple, no fake links) */}
        <View style={styles.footer}>
          <Ionicons
            name="construct-outline"
            size={18}
            color={COLORS.textSecondary}
          />
          <Text style={styles.footerText}>
            More settings coming soon — notifications, theme, privacy…
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: COLORS.surface,
  },
  langRowActive: { backgroundColor: COLORS.brandDim },
  flag: { fontSize: 26 },
  langName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  langSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: COLORS.surface,
  },
  themePreview: {
    flexDirection: "row",
    gap: 4,
  },
  swatch: {
    width: 18,
    height: 28,
    borderRadius: 5,
  },
  themeName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 60 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    marginTop: 32,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontStyle: "italic",
    flex: 1,
  },
});
