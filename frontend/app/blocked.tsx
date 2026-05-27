// /app/frontend/app/blocked.tsx — Phase 7 fully localized.
// Lists blocked users with metallic rows and a neon "UNBLOCK" pill.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getAvatarUrl } from "@/src/constants/avatars";
import { apiGet, apiPost } from "@/src/api/client";
import { FUTURISTIC, TYPO } from "@/src/theme/futuristic";
import ScreenScaffold from "@/src/components/futuristic/ScreenScaffold";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import { useT } from "@/src/context/LanguageContext";

interface Blocked {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  avatar_image?: string;
}

export default function BlockedScreen() {
  const { t } = useT();
  const [list, setList] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ blocked: Blocked[] }>("/users/blocked");
      setList(d.blocked);
    } catch {} finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const unblock = (u: Blocked) => {
    Alert.alert(t("unblock_title"), t("unblock_msg", { name: u.nickname }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("unblock_title"),
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost(`/users/unblock/${u.id}`);
            await load();
          } catch {}
        },
      },
    ]);
  };

  const subtitle =
    list.length === 1
      ? t("blocked_subtitle_one", { n: list.length })
      : t("blocked_subtitle_many", { n: list.length });

  return (
    <ScreenScaffold kicker={t("kicker_safety")} title={t("blocked_title")} subtitle={subtitle}>
      {loading ? (
        <ActivityIndicator color={FUTURISTIC.brand} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyRing}>
                <Ionicons name="shield-checkmark-outline" size={42} color={FUTURISTIC.brand} />
              </View>
              <Text style={styles.emptyTitle}>{t("no_blocked_title")}</Text>
              <Text style={styles.emptySub}>{t("no_blocked_sub")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ marginBottom: 10 }}>
              <MetallicCard padding={12} radius={FUTURISTIC.radius.md} accent="neutral">
                <View style={styles.row}>
                  <LinearGradient
                    colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarRing}
                  >
                    <Image source={{ uri: item.avatar_image || getAvatarUrl(item.avatar) }} style={styles.avatar} />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.nick} numberOfLines={1}>{item.nickname}</Text>
                    <Text style={styles.user} numberOfLines={1}>@{item.username}</Text>
                  </View>
                  <TouchableOpacity onPress={() => unblock(item)} style={styles.unblockBtn} activeOpacity={0.85}>
                    <Text style={styles.unblockText}>{t("unblock_btn")}</Text>
                  </TouchableOpacity>
                </View>
              </MetallicCard>
            </View>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  avatarRing: { width: 50, height: 50, borderRadius: 14, padding: 2 },
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: FUTURISTIC.surface2 },
  nick: { color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  user: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: FUTURISTIC.brandSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  unblockText: { color: FUTURISTIC.brand, fontWeight: "900", letterSpacing: 1.4, fontSize: 11 },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: FUTURISTIC.surface1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyTitle: { ...TYPO.h2, color: FUTURISTIC.textPrimary, marginTop: 18 },
  emptySub: { color: FUTURISTIC.textMuted, fontSize: 13, textAlign: "center" },
});
