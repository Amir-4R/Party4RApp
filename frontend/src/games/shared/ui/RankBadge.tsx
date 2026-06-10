// =============================================================================
// src/games/shared/ui/RankBadge.tsx — Party4R Rank Badge
// =============================================================================
// شارة رتبة موحّدة تُستخدم في بطاقة اللعبة، شاشة ما قبل المباراة، شاشة النتيجة،
// والملف الشخصي. تعرض أيقونة الرتبة + اسمها (عربي/إنجليزي) + النقاط اختيارياً.
// =============================================================================
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RankTierId, RANKS } from "@/src/games/ranks";
import { withAlpha } from "@/src/games/shared/gameTheme";

type Size = "sm" | "md" | "lg";

const DIMS: Record<Size, { icon: number; pad: number; font: number; gap: number }> = {
  sm: { icon: 13, pad: 5, font: 11, gap: 4 },
  md: { icon: 16, pad: 7, font: 13, gap: 5 },
  lg: { icon: 22, pad: 10, font: 16, gap: 7 },
};

export default function RankBadge({
  rankId,
  points,
  size = "md",
  showName = true,
  arabic = true,
}: {
  rankId: RankTierId;
  points?: number;
  size?: Size;
  showName?: boolean;
  arabic?: boolean;
}) {
  const tier = RANKS.find((r) => r.id === rankId) || RANKS[0];
  const d = DIMS[size];
  return (
    <View
      style={[
        styles.badge,
        {
          paddingVertical: d.pad - 2,
          paddingHorizontal: d.pad,
          gap: d.gap,
          borderColor: withAlpha(tier.color, 0.6),
          backgroundColor: withAlpha(tier.color, 0.14),
        },
      ]}
    >
      <Ionicons name={tier.icon as any} size={d.icon} color={tier.color} />
      {showName && (
        <Text style={[styles.name, { color: tier.color, fontSize: d.font }]}>
          {arabic ? tier.nameAr : tier.name}
        </Text>
      )}
      {typeof points === "number" && (
        <Text style={[styles.pts, { fontSize: d.font - 1 }]}>{points}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  name: { fontWeight: "900", letterSpacing: 0.3 },
  pts: { color: "rgba(255,255,255,0.65)", fontWeight: "700" },
});
