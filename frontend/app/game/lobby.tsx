// =============================================================================
// app/game/lobby.tsx — Game Mode Selection → routes to real games
// =============================================================================
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";
import { GameType } from "@/src/api/games";

const GAME_INFO: Record<GameType, { nameKey: string; logo: any; route: string }> = {
  chess:  { nameKey: "play_chess",  logo: require("../../assets/images/games/chess_logo.jpg"),  route: "/game/chess" },
  carrom: { nameKey: "play_carrom", logo: require("../../assets/images/games/carrom_logo.jpg"), route: "/game/carrom" },
  damma:  { nameKey: "play_damma",  logo: require("../../assets/images/games/damma_logo.jpg"),  route: "/game/damma" },
};

export default function GameLobby() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { game } = useLocalSearchParams<{ game: GameType }>();

  const info = game ? GAME_INFO[game] : null;
  if (!info) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.title}>{t("game_not_found") || "Game not found"}</Text>
      </View>
    );
  }

  const modes = [
    { id: "practice", icon: "person-outline" as const, label: t("play_practice") || "تدريب (ضد الكمبيوتر)", onPress: () => router.push(info.route as any) },
    { id: "random",   icon: "globe-outline" as const,  label: t("play_global") || "لعب عشوائي أونلاين",     onPress: () => router.push(`/game/matchmaking?game=${game}` as any) },
    { id: "friends",  icon: "people-outline" as const, label: t("play_friends") || "العب مع صديق",          onPress: () => router.push(`/game/invite-friend?game=${game}` as any) },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t(info.nameKey)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Image source={info.logo} style={styles.cover} resizeMode="cover" />

      <View style={styles.modes}>
        {modes.map((m) => (
          <TouchableOpacity key={m.id} style={styles.modeBtn} onPress={m.onPress} activeOpacity={0.85}>
            <Ionicons name={m.icon} size={24} color={FUTURISTIC.brand} />
            <Text style={styles.modeLabel}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={FUTURISTIC.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.text, fontSize: 18, fontWeight: "800" },
  cover: { width: "100%", height: 200, marginVertical: 16 },
  modes: { paddingHorizontal: 16, gap: 12 },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: FUTURISTIC.layer2, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: FUTURISTIC.border },
  modeLabel: { flex: 1, color: FUTURISTIC.text, fontSize: 15, fontWeight: "700" },
});
