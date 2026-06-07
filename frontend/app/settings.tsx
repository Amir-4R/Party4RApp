// /app/frontend/app/settings.tsx
// =============================================================================
// Settings — Futuristic redesign + Expandable Theme Library (Phase 8.5)
// =============================================================================
// Layout:
//   THEME
//     ├── Featured cards (Neon Green, Midnight, AMOLED Black, Cyber Purple)
//     └── ┌─ MORE THEMES (collapsible) ────────────────────────────────────┐
//         │  ▸ tap to expand →                                              │
//         │  [search input]                                                 │
//         │  2-col grid of compact preview cards (21+ pure-color themes)    │
//         └─────────────────────────────────────────────────────────────────┘
//   LANGUAGE / PRIVACY & SAFETY / DANGER ZONE …
//
// Performance:
//   • `ThemeCard` is React.memo'd — only re-renders when `active` flips.
//   • Search uses `useDeferredValue` + `useMemo`-filtered EXTRA_IDS.
//   • Featured cards never re-render during search/filter.
//   • LayoutAnimation.easeInEaseOut drives the expand/collapse on native;
//     a CSS-style height transition replaces it on web automatically.

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useDeferredValue,
  memo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useT } from "@/src/context/LanguageContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useCloudSync } from "@/src/utils/cloudSync";
import {
  THEMES,
  ThemeId,
  FEATURED_IDS,
  EXTRA_IDS,
  ThemeTokens,
} from "@/src/theme/themes";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import ScreenScaffold from "@/src/components/futuristic/ScreenScaffold";
import MetallicCard from "@/src/components/futuristic/MetallicCard";

// Enable LayoutAnimation on Android.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t, tErr, lang, setLang } = useT();
  const { themeId, setThemeId } = useTheme();
  const cloud = useCloudSync();
  const [switching, setSwitching] = useState<null | "en" | "ar">(null);
  const [themeSwitching, setThemeSwitching] = useState<ThemeId | null>(null);

  // ── Apply cloud-pulled settings on first sync ─────────────────────────────
  // When the user logs in on a new device the CloudSyncProvider pulls their
  // last-known preferences. We apply them once, *only* if they differ from
  // the local defaults.  This is intentionally not in the providers so the
  // user sees the UI flash to the right language/theme just after login.
  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current) return;
    if (!cloud.status.hasPulledOnce) return;
    appliedRef.current = true;
    const cp = cloud.payload;
    if (cp.language && cp.language !== lang) setLang(cp.language);
    if (cp.theme && cp.theme !== themeId) setThemeId(cp.theme as ThemeId);
  }, [cloud.status.hasPulledOnce]);  // eslint-disable-line

  const handleSwitch = async (l: "en" | "ar") => {
    if (l === lang || switching) return;
    setSwitching(l);
    const { needsRestart } = await setLang(l);
    setSwitching(null);
    cloud.update({ language: l });
    if (needsRestart) {
      Alert.alert(t("rtl_restart_title"), t("rtl_restart_msg"), [
        { text: t("rtl_restart_ok") },
      ]);
    }
  };

  const handleTheme = async (id: ThemeId) => {
    if (id === themeId) return;
    setThemeSwitching(id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await setThemeId(id);
    setThemeSwitching(null);
    cloud.update({ theme: id });
  };

  return (
    <ScreenScaffold
      kicker={t("settings_account")}
      title={t("app_settings").toUpperCase()}
      subtitle={t("settings_subtitle")}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── CLOUD SYNC STATUS ────────────────────────────────────────── */}
        <Section label={t("sync_section")}>
          <MetallicCard padding={14} radius={FUTURISTIC.radius.lg} accent="neutral">
            <View style={styles.syncRow}>
              <View style={styles.syncIconWrap}>
                <Ionicons
                  name={
                    cloud.status.syncing
                      ? "cloud-upload-outline"
                      : cloud.status.error
                      ? "cloud-offline-outline"
                      : "cloud-done"
                  }
                  size={24}
                  color={
                    cloud.status.error
                      ? "#FF8A50"
                      : cloud.status.syncing
                      ? FUTURISTIC.accentGlow
                      : FUTURISTIC.brand
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.syncTitle}>
                  {cloud.status.syncing
                    ? t("sync_syncing")
                    : cloud.status.error
                    ? t("sync_failed")
                    : cloud.status.lastSyncedAt
                    ? t("sync_synced")
                    : t("sync_idle")}
                </Text>
                <Text style={styles.syncSub}>
                  {cloud.status.error
                    ? cloud.status.error
                    : cloud.status.lastSyncedAt
                    ? `v${cloud.status.version} · ${new Date(cloud.status.lastSyncedAt).toLocaleTimeString()}`
                    : t("sync_idle_sub")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => cloud.pull()}
                disabled={cloud.status.syncing}
                style={[styles.syncBtn, cloud.status.syncing && { opacity: 0.55 }]}
                testID="cloud-sync-now"
              >
                {cloud.status.syncing ? (
                  <ActivityIndicator size="small" color={FUTURISTIC.brand} />
                ) : (
                  <Ionicons name="refresh" size={18} color={FUTURISTIC.brand} />
                )}
              </TouchableOpacity>
            </View>
          </MetallicCard>
        </Section>

        {/* ── THEME (featured 4) ───────────────────────────────────────── */}
        <Section label={t("settings_theme")}>
          <MetallicCard padding={0} radius={FUTURISTIC.radius.lg} accent="neutral">
            {FEATURED_IDS.map((id, idx) => {
              const tdef = THEMES[id];
              if (!tdef) return null;
              const active = themeId === id;
              const busy = themeSwitching === id;
              return (
                <React.Fragment key={id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <FeaturedRow
                    tdef={tdef}
                    active={active}
                    busy={busy}
                    label={
                      id === "neon"
                        ? t("theme_neon_sub")
                        : id === "midnight"
                        ? t("theme_midnight_sub")
                        : id === "amoled"
                        ? t("theme_amoled_sub")
                        : t("theme_purple_sub")
                    }
                    onPress={() => handleTheme(id as ThemeId)}
                  />
                </React.Fragment>
              );
            })}
          </MetallicCard>

          {/* ── MORE THEMES (expandable library) ─────────────────────── */}
          <MoreThemesPanel
            activeId={themeId as string}
            themeSwitching={themeSwitching as string | null}
            onSelect={(id) => handleTheme(id as ThemeId)}
          />
        </Section>

        {/* ── LANGUAGE ─────────────────────────────────────────────────── */}
        <Section label={t("language_section").toUpperCase()}>
          <MetallicCard padding={0} radius={FUTURISTIC.radius.lg} accent="neutral">
            <LangRow
              code="en"
              label="English"
              sub="Default"
              flag="🇺🇸"
              active={lang === "en"}
              busy={switching === "en"}
              onPress={() => handleSwitch("en")}
            />
            <View style={styles.divider} />
            <LangRow
              code="ar"
              label="العربية"
              sub="Arabic"
              flag="🇾🇪"
              active={lang === "ar"}
              busy={switching === "ar"}
              onPress={() => handleSwitch("ar")}
            />
          </MetallicCard>
        </Section>

        {/* ── PRIVACY & SAFETY ─────────────────────────────────────────── */}
        <Section label={t("settings_privacy_safety")}>
          <MetallicCard padding={0} radius={FUTURISTIC.radius.lg} accent="green">
            <MenuRow
              icon="shield-checkmark-outline"
              label={t("privacy_controls")}
              sub={t("privacy_controls_sub")}
              onPress={() => router.push("/privacy")}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="ban-outline"
              label={t("blocked_users")}
              sub={t("blocked_users_sub")}
              onPress={() => router.push("/blocked")}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="volume-mute-outline"
              label={t("mw_title")}
              sub={t("mw_subtitle")}
              onPress={() => router.push("/muted-words")}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="document-text-outline"
              label={t("privacy_policy")}
              sub={t("privacy_policy_sub")}
              onPress={() => router.push("/legal/privacy-policy")}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="reader-outline"
              label={t("terms_of_service")}
              sub={t("terms_of_service_sub")}
              onPress={() => router.push("/legal/terms")}
            />
          </MetallicCard>
        </Section>

        {/* ── DANGER ZONE ──────────────────────────────────────────────── */}
        <Section label={t("settings_danger_zone")}>
          <MetallicCard
            padding={0}
            radius={FUTURISTIC.radius.lg}
            accent="neutral"
            style={{ borderColor: FUTURISTIC.error }}
          >
            <MenuRow
              icon="trash-outline"
              label={t("delete_account")}
              sub={t("delete_account_sub")}
              danger
              onPress={() =>
                Alert.alert(t("delete_account"), t("delete_account_confirm"), [
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
                        Alert.alert(
                          t("error"),
                          tErr(e) || t("err_failed_to_delete_account")
                        );
                      }
                    },
                  },
                ])
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
// MoreThemesPanel — collapsible library with search + grid
// ============================================================================
function MoreThemesPanel({
  activeId,
  themeSwitching,
  onSelect,
}: {
  activeId: string;
  themeSwitching: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // Chevron rotation animation
  const chevronAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: open ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open]);

  const toggleOpen = () => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "easeInEaseOut" },
      delete: { type: "easeInEaseOut", property: "opacity" },
    });
    setOpen((v) => !v);
  };

  // Filter EXTRA_IDS by query.
  const filteredIds = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return EXTRA_IDS;
    return EXTRA_IDS.filter((id) => {
      const tdef = THEMES[id];
      if (!tdef) return false;
      return (
        tdef.name.toLowerCase().includes(q) ||
        (tdef.family && tdef.family.toLowerCase().includes(q)) ||
        id.toLowerCase().includes(q)
      );
    });
  }, [deferredQuery]);

  const countLabel =
    EXTRA_IDS.length === 1
      ? t("themes_count_one", { n: EXTRA_IDS.length })
      : t("themes_count_many", { n: EXTRA_IDS.length });

  const rotateStyle = {
    transform: [
      {
        rotate: chevronAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "90deg"],
        }),
      },
    ],
  };

  return (
    <View style={{ marginTop: 12 }}>
      {/* Header — tap to toggle */}
      <TouchableOpacity
        onPress={toggleOpen}
        activeOpacity={0.85}
        style={styles.libraryHeader}
        testID="more-themes-toggle"
      >
        <LinearGradient
          colors={[FUTURISTIC.surface2, FUTURISTIC.surface1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.libraryHeaderInner}
        >
          <View style={styles.libraryHeaderIcon}>
            <Ionicons name="color-palette" size={18} color={FUTURISTIC.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.libraryHeaderTitle}>{t("more_themes")}</Text>
            <Text style={styles.libraryHeaderSub}>{countLabel}</Text>
          </View>
          <Animated.View style={rotateStyle}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={FUTURISTIC.textSecondary}
            />
          </Animated.View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Expanded body */}
      {open && (
        <View style={styles.libraryBody}>
          {/* Search input */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={FUTURISTIC.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("search_themes")}
              placeholderTextColor={FUTURISTIC.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={FUTURISTIC.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Grid */}
          {filteredIds.length === 0 ? (
            <View style={styles.emptyHit}>
              <Ionicons
                name="color-palette-outline"
                size={32}
                color={FUTURISTIC.textMuted}
              />
              <Text style={styles.emptyHitText}>{t("no_themes_found")}</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredIds.map((id) => {
                const tdef = THEMES[id];
                if (!tdef) return null;
                const active = activeId === id;
                const busy = themeSwitching === id;
                return (
                  <ThemeCard
                    key={id}
                    id={id}
                    tdef={tdef}
                    active={active}
                    busy={busy}
                    onPress={onSelect}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// FeaturedRow — full-width premium row for the 4 main themes
// ============================================================================
function FeaturedRow({
  tdef,
  active,
  busy,
  label,
  onPress,
}: {
  tdef: ThemeTokens;
  active: boolean;
  busy: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`theme-${tdef.id}`}
      onPress={onPress}
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
        <Text style={styles.rowSub}>{label}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={tdef.brand} />
      ) : active ? (
        <Ionicons name="checkmark-circle" size={22} color={tdef.brand} />
      ) : (
        <View style={styles.radio} />
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// ThemeCard — compact 2-col grid card with circular preview disc
// ============================================================================
const ThemeCard = memo(function ThemeCard({
  id,
  tdef,
  active,
  busy,
  onPress,
}: {
  id: string;
  tdef: ThemeTokens;
  active: boolean;
  busy: boolean;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      testID={`theme-card-${id}`}
      onPress={() => onPress(id)}
      activeOpacity={0.85}
      style={[
        styles.card,
        active && {
          borderColor: tdef.brand,
          shadowColor: tdef.brand,
          shadowOpacity: 0.55,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <View style={[styles.cardBg, { backgroundColor: tdef.bg }]}>
        {/* Disc preview */}
        <View style={styles.discWrap}>
          <View
            style={[
              styles.discGlow,
              { backgroundColor: tdef.brand, opacity: active ? 0.6 : 0.32 },
            ]}
          />
          <LinearGradient
            colors={[tdef.brand, tdef.accent, tdef.bg] as any}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 1, y: 1 }}
            style={styles.disc}
          />
          {active && (
            <View style={styles.checkBubble}>
              <Ionicons name="checkmark" size={14} color={tdef.bg} />
            </View>
          )}
          {busy && !active && (
            <View style={styles.checkBubble}>
              <ActivityIndicator size="small" color={tdef.brand} />
            </View>
          )}
        </View>

        {/* Name */}
        <Text
          style={[styles.cardName, active && { color: tdef.brand }]}
          numberOfLines={1}
        >
          {tdef.name}
        </Text>

        {/* Family hint */}
        {tdef.family && (
          <Text style={styles.cardFamily} numberOfLines={1}>
            {tdef.family}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ============================================================================
// Helper components
// ============================================================================
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function LangRow({
  code,
  label,
  sub,
  flag,
  active,
  busy,
  onPress,
}: {
  code: string;
  label: string;
  sub: string;
  flag: string;
  active: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`lang-${code}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.row, active && styles.rowActive]}
    >
      <Text style={styles.flag}>{flag}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, active && { color: FUTURISTIC.brand }]}>
          {label}
        </Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={FUTURISTIC.brand} />
      ) : active ? (
        <Ionicons name="checkmark-circle" size={22} color={FUTURISTIC.brand} />
      ) : (
        <View style={styles.radio} />
      )}
    </TouchableOpacity>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
      <View
        style={[
          styles.iconBubble,
          danger && {
            backgroundColor: FUTURISTIC.errorSoft,
            borderColor: FUTURISTIC.error,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? FUTURISTIC.error : FUTURISTIC.brand}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: FUTURISTIC.error }]}>
          {label}
        </Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={FUTURISTIC.textMuted} />
    </TouchableOpacity>
  );
}

// ============================================================================
// Styles
// ============================================================================
const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: { ...TYPO.caption, color: FUTURISTIC.textMuted, marginBottom: 10 },

  // ── Cloud Sync ─────────────────────────────────────────────────────────
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  syncIconWrap: {
    width: 44, height: 44,
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  syncTitle: {
    color: FUTURISTIC.textPrimary,
    fontSize: 14, fontWeight: "800", letterSpacing: 0.3,
  },
  syncSub: {
    color: FUTURISTIC.textMuted,
    fontSize: 12, marginTop: 2,
  },
  syncBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: FUTURISTIC.surface2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.brandEdge,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowActive: { backgroundColor: FUTURISTIC.brandSoft },
  rowLabel: {
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  rowSub: {
    color: FUTURISTIC.textMuted,
    fontSize: 12,
    marginTop: 3,
    letterSpacing: 0.2,
  },
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

  // ── Library header ──────────────────────────────────────────────────
  libraryHeader: {
    borderRadius: FUTURISTIC.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: FUTURISTIC.border,
  },
  libraryHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  libraryHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: FUTURISTIC.brandSoft,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  libraryHeaderTitle: {
    color: FUTURISTIC.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  libraryHeaderSub: {
    color: FUTURISTIC.textMuted,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  // ── Library body ────────────────────────────────────────────────────
  libraryBody: {
    marginTop: 10,
    backgroundColor: FUTURISTIC.surface0,
    borderWidth: 1,
    borderColor: FUTURISTIC.border,
    borderRadius: FUTURISTIC.radius.lg,
    padding: 12,
    overflow: "hidden",
  },

  // ── Search ──────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: FUTURISTIC.surface1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: FUTURISTIC.textPrimary,
    fontSize: 13,
    paddingVertical: 4,
    letterSpacing: 0.2,
  },

  // ── Grid ────────────────────────────────────────────────────────────
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "48%",
    borderWidth: 1,
    borderColor: FUTURISTIC.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  cardBg: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  discWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  discGlow: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    // visual glow ring behind the disc
    transform: [{ scale: 1.05 }],
    // Note: actual native glow comes from card shadow when active.
  },
  disc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  checkBubble: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.85)",
  },
  cardName: {
    color: FUTURISTIC.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  cardFamily: {
    marginTop: 2,
    color: FUTURISTIC.textMuted,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // ── Empty state for search ──────────────────────────────────────────
  emptyHit: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyHitText: {
    color: FUTURISTIC.textMuted,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
