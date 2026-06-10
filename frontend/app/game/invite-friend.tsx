// =============================================================================
// app/game/invite-friend.tsx — Play with a friend (graceful gate)
// =============================================================================
// Friend invites require the game backend (sessions + invitations). Until it is
// deployed, this screen explains the status and offers a one-tap fallback to
// play vs the bot, so the "play with friend" flow never dead-ends.
// =============================================================================
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useTheme } from "@/src/context/ThemeContext";
import { gameBackground, withAlpha } from "@/src/games/shared/gameTheme";
import { useT } from "@/src/context/LanguageContext";
import { GameType } from "@/src/api/games";

const GAME_ROUTE: Record<GameType, string> = {
  chess: "/game/chess",
  carrom: "/game/carrom",
  damma: "/game/damma",
};

export default function InviteFriend() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { themeId } = useTheme();
  const bg = gameBackground(themeId);
  const { game } = useLocalSearchParams<{ game: GameType }>();
  const target = game && GAME_ROUTE[game] ? GAME_ROUTE[game] : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={bg} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_friends") || "العب مع صديق"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={[styles.iconWrap, { borderColor: FUTURISTIC.brand, backgroundColor: withAlpha(FUTURISTIC.brand, 0.12) }]}>
          <Ionicons name="people-outline" size={48} color={FUTURISTIC.brand} />
        </View>
        <Text style={styles.heading}>{t("friends_soon_title") || "اللعب مع الأصدقاء قريباً"}</Text>
        <Text style={styles.sub}>
          {t("friends_soon_body") ||
            "دعوات اللعب مع الأصدقاء قيد التفعيل. يمكنك الآن التدرّب ضد الكمبيوتر بنفس اللعبة."}
        </Text>

        {target && (
          <TouchableOpacity style={[styles.cta, { backgroundColor: FUTURISTIC.brand }]} onPress={() => router.replace(target as any)} activeOpacity={0.9}>
            <Ionicons name="hardware-chip-outline" size={20} color={FUTURISTIC.bg} />
            <Text style={[styles.ctaText, { color: FUTURISTIC.bg }]}>{t("play_practice") || "تدرّب ضد الكمبيوتر"}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.cta, styles.ctaGhost]} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={[styles.ctaText, { color: FUTURISTIC.textSecondary }]}>{t("back") || "رجوع"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "800" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  iconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  heading: { color: FUTURISTIC.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "center" },
  sub: { color: FUTURISTIC.textMuted, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 8 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, paddingHorizontal: 24, borderRadius: 16, width: "100%" },
  ctaGhost: { borderWidth: 1, borderColor: FUTURISTIC.border, backgroundColor: "transparent" },
  ctaText: { fontSize: 15, fontWeight: "800" },
});
