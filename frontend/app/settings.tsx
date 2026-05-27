// /app/frontend/app/settings.tsx — Phase 6 futuristic redesign.
// Houses: theme, language, privacy/safety links, legal links, danger zone.

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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "@/src/context/LanguageContext";
import { useTheme } from "@/src/context/ThemeContext";
import { THEMES, ThemeId } from "@/src/constants/themes";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import ScreenScaffold from "@/src/components/futuristic/ScreenScaffold";
import MetallicCard from "@/src/components/futuristic/MetallicCard";

export default function SettingsScreen() {
  const router = useRouter();
  const { t, tErr, lang, setLang } = useT();
  const { themeId, setThemeId } = useTheme();
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

  return (
    <ScreenScaffold kicker={t("settings_account")} title={t("app_settings").toUpperCase()} subtitle={t("settings_subtitle")}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}>
        {/* THEME ----------------------------------------------------------- */}
        <Section label={t("settings_theme")}>
          <MetallicCard padding={0} radius={FUTURISTIC.radius.lg} accent="neutral">
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
                    style={[styles.row, active && styles.rowActive]}
                  >
                    <View style={styles.themeSwatches}>
                      <View style={[styles.swatch, { backgroundColor: tdef.bg }]} />
                      <View style={[styles.swatch, { backgroundColor: tdef.brand }]} />
                      <View style={[styles.swatch, { backgroundColor: tdef.accent }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, active && { color: tdef.brand }]}>
                        {tdef.name}
                      </Text>
                      <Text style={styles.rowSub}>
                        {id === "neon"
                          ? t("theme_neon_sub")
                          : id === "midnight"
                          ? t("theme_midnight_sub")
                          : id === "amoled"
                          ? t("theme_amoled_sub")
                          : t("theme_purple_sub")}
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
          </MetallicCard>
        </Section>

        {/* LANGUAGE -------------------------------------------------------- */}
        <Section label={t("language_section").toUpperCase()}>
          <MetallicCard padding={0} radius={FUTURISTIC.radius.lg} accent="neutral">
            <LangRow code="en" label="English" sub="Default" flag="🇺🇸" active={lang === "en"} busy={switching === "en"} onPress={() => handleSwitch("en")} />
            <View style={styles.divider} />
            <LangRow code="ar" label="العربية" sub="Arabic" flag="🇾🇪" active={lang === "ar"} busy={switching === "ar"} onPress={() => handleSwitch("ar")} />
          </MetallicCard>
        </Section>

        {/* PRIVACY & SAFETY ----------------------------------------------- */}
        <Section label={t("settings_privacy_safety")}>
          <MetallicCard padding={0} radius={FUTURISTIC.radius.lg} accent="green">
            <MenuRow icon="shield-checkmark-outline" label={t("privacy_controls")} sub={t("privacy_controls_sub")} onPress={() => router.push("/privacy")} />
            <View style={styles.divider} />
            <MenuRow icon="ban-outline" label={t("blocked_users")} sub={t("blocked_users_sub")} onPress={() => router.push("/blocked")} />
            <View style={styles.divider} />
            <MenuRow icon="document-text-outline" label={t("privacy_policy")} sub={t("privacy_policy_sub")} onPress={() => router.push("/legal/privacy-policy")} />
            <View style={styles.divider} />
            <MenuRow icon="reader-outline" label={t("terms_of_service")} sub={t("terms_of_service_sub")} onPress={() => router.push("/legal/terms")} />
          </MetallicCard>
        </Section>

        {/* DANGER ZONE ---------------------------------------------------- */}
        <Section label={t("settings_danger_zone")}>
          <MetallicCard padding={0} radius={FUTURISTIC.radius.lg} accent="neutral" style={{ borderColor: FUTURISTIC.error }}>
            <MenuRow
              icon="trash-outline"
              label={t("delete_account")}
              sub={t("delete_account_sub")}
              danger
              onPress={() =>
                Alert.alert(
                  t("delete_account"),
                  t("delete_account_confirm"),
                  [
                    { text: t("cancel"), style: "cancel" },
                    {
                      text: t("delete_forever"),
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const { apiDelete } = await import("@/src/api/client");
                          await apiDelete("/auth/account");
                          const { storage } = await import("@/src/utils/storage");
                          await storage.secureRemove("party_auth_token");
                          router.replace("/login");
                        } catch (e: any) {
                          Alert.alert(t("error"), tErr(e) || t("err_failed_to_delete_account"));
                        }
                      },
                    },
                  ]
                )
              }
            />
          </MetallicCard>
        </Section>

        <View style={styles.footer}>
          <Ionicons name="construct-outline" size={16} color={FUTURISTIC.textMuted} />
          <Text style={styles.footerText}>{t("more_settings_soon")}</Text>
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function LangRow({ code, label, sub, flag, active, busy, onPress }: { code: string; label: string; sub: string; flag: string; active: boolean; busy: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity testID={`lang-${code}`} onPress={onPress} activeOpacity={0.85} style={[styles.row, active && styles.rowActive]}>
      <Text style={styles.flag}>{flag}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, active && { color: FUTURISTIC.brand }]}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {busy ? <ActivityIndicator color={FUTURISTIC.brand} /> : active ? <Ionicons name="checkmark-circle" size={22} color={FUTURISTIC.brand} /> : <View style={styles.radio} />}
    </TouchableOpacity>
  );
}

function MenuRow({ icon, label, sub, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
      <View style={[styles.iconBubble, danger && { backgroundColor: FUTURISTIC.errorSoft, borderColor: FUTURISTIC.error }]}>
        <Ionicons name={icon} size={18} color={danger ? FUTURISTIC.error : FUTURISTIC.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: FUTURISTIC.error }]}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={FUTURISTIC.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: { ...TYPO.caption, color: FUTURISTIC.textMuted, marginBottom: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowActive: { backgroundColor: FUTURISTIC.brandSoft },
  rowLabel: { color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  rowSub: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 3, letterSpacing: 0.2 },
  flag: { fontSize: 24 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: FUTURISTIC.borderStrong,
  },
  themeSwatches: { flexDirection: "row", gap: 3 },
  swatch: {
    width: 14,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: FUTURISTIC.brandSoft,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: FUTURISTIC.borderSoft,
    marginLeft: 62,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    marginTop: 32,
  },
  footerText: {
    color: FUTURISTIC.textMuted,
    fontSize: 12,
    fontStyle: "italic",
    flex: 1,
    letterSpacing: 0.2,
  },
});
