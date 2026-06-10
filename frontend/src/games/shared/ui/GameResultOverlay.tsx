// =============================================================================
// src/games/shared/ui/GameResultOverlay.tsx — Party4R Unified End Screen
// =============================================================================
// شاشة نهاية مباراة موحّدة لكل الألعاب: فوز / خسارة / تعادل.
// تعرض: العنوان، النقاط المكتسبة/المفقودة، الرتبة الحالية، التقدّم نحو الرتبة
// التالية، نتيجة المباراة، إحصائيات إضافية اختيارية، وأزرار (إعادة / رجوع).
// مؤثرات خفيفة (Animated مدمج) + أصوات تُتجاهل بأمان إن لم تُضف بعد.
// =============================================================================
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { withAlpha } from "@/src/games/shared/gameTheme";
import { useT } from "@/src/context/LanguageContext";
import { RANKS, rankProgress } from "@/src/games/ranks";
import type { RecordResult } from "@/src/games/stats";
import RankBadge from "./RankBadge";
import { playSound } from "@/src/games/sound/SoundManager";

export type ResultOutcome = "win" | "loss" | "draw";

export interface ScoreLine {
  you: number; opp: number;
  youLabel?: string; oppLabel?: string;
}

export default function GameResultOverlay({
  outcome,
  record,
  score,
  statsRows,
  onPlayAgain,
  onExit,
}: {
  outcome: ResultOutcome;
  record?: RecordResult | null;
  score?: ScoreLine;
  statsRows?: { label: string; value: string | number }[];
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const { t } = useT();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    playSound(outcome === "win" ? "victory" : outcome === "loss" ? "defeat" : "draw");
    if (record?.rankedUp) {
      const id = setTimeout(() => playSound("rank_up"), 650);
      return () => clearTimeout(id);
    }
  }, [outcome, record, scale, opacity]);

  const accent =
    outcome === "win" ? FUTURISTIC.success
    : outcome === "loss" ? FUTURISTIC.error
    : FUTURISTIC.warning;

  const title =
    outcome === "win" ? (t("you_win") || "فوز!")
    : outcome === "loss" ? (t("opponent_wins") || "خسارة")
    : (t("its_a_draw") || "تعادل!");

  const icon = outcome === "win" ? "trophy" : outcome === "loss" ? "sad" : "remove-circle";

  const prog = record ? rankProgress(record.stats.rankPoints) : null;
  const nextTier = prog?.nextTier ?? null;
  const delta = record?.delta ?? 0;

  return (
    <View style={styles.overlay}>
      <LinearGradient colors={[withAlpha("#000000", 0.55), withAlpha("#000000", 0.82)]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.card, { borderColor: accent, shadowColor: accent, transform: [{ scale }], opacity }]}>
        {/* Rank-up ribbon */}
        {record?.rankedUp && (
          <View style={[styles.rankUp, { backgroundColor: withAlpha(accent, 0.16), borderColor: accent }]}>
            <Ionicons name="arrow-up-circle" size={15} color={accent} />
            <Text style={[styles.rankUpText, { color: accent }]}>{t("rank_up") || "ترقية رتبة!"}</Text>
          </View>
        )}

        <View style={[styles.icon, { backgroundColor: withAlpha(accent, 0.15), borderColor: accent }]}>
          <Ionicons name={icon as any} size={42} color={accent} />
        </View>
        <Text style={[styles.title, { color: accent }]}>{title}</Text>

        {outcome === "loss" && (
          <Text style={styles.encourage}>{t("loss_encourage") || "حظ أوفر في المرة القادمة — أنت تتحسّن!"}</Text>
        )}

        {/* Score line */}
        {score && (
          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreLabel}>{score.youLabel || (t("you") || "أنت")}</Text>
              <Text style={[styles.scoreVal, { color: FUTURISTIC.brand }]}>{score.you}</Text>
            </View>
            <Text style={styles.scoreDash}>—</Text>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreLabel}>{score.oppLabel || (t("opponent") || "الخصم")}</Text>
              <Text style={[styles.scoreVal, { color: FUTURISTIC.textSecondary }]}>{score.opp}</Text>
            </View>
          </View>
        )}

        {/* Rank + points */}
        {record && prog && (
          <View style={styles.rankBlock}>
            <View style={styles.rankBlockTop}>
              <RankBadge rankId={record.newRankId} points={record.stats.rankPoints} size="md" />
              <Text style={[styles.delta, { color: delta >= 0 ? FUTURISTIC.success : FUTURISTIC.error }]}>
                {delta >= 0 ? `+${delta}` : `${delta}`} {t("rank_points") || "نقطة"}
              </Text>
            </View>
            {/* Progress to next rank */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(prog.progress * 100)}%`, backgroundColor: accent }]} />
            </View>
            <Text style={styles.progressLabel}>
              {nextTier
                ? `${prog.pointsIntoTier}/${prog.tierSpan} ${t("to_next_rank") || "نحو"} ${nextTier.nameAr}`
                : (t("max_rank") || "أعلى رتبة")}
            </Text>
          </View>
        )}

        {/* Extra match stats */}
        {statsRows && statsRows.length > 0 && (
          <View style={styles.statsRows}>
            {statsRows.map((r, i) => (
              <View key={i} style={styles.statRow}>
                <Text style={styles.statRowLabel}>{r.label}</Text>
                <Text style={styles.statRowValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Buttons */}
        <View style={styles.btns}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onExit} activeOpacity={0.85}>
            <Ionicons name="grid-outline" size={18} color={FUTURISTIC.textSecondary} />
            <Text style={[styles.btnText, { color: FUTURISTIC.textSecondary }]}>{t("back_to_games") || "الألعاب"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: FUTURISTIC.brand }]} onPress={onPlayAgain} activeOpacity={0.9}>
            <Ionicons name="refresh" size={18} color={FUTURISTIC.bg} />
            <Text style={[styles.btnText, { color: FUTURISTIC.bg }]}>{t("play_again") || "إعادة"}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// expose tiers length for callers if needed
export const RANK_COUNT = RANKS.length;

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 70, paddingHorizontal: 26 },
  card: {
    width: "100%", maxWidth: 380, backgroundColor: FUTURISTIC.surface1,
    borderRadius: 24, borderWidth: 1.5, paddingVertical: 26, paddingHorizontal: 22,
    alignItems: "center", gap: 12,
    shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  rankUp: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  rankUpText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  icon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  title: { fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  encourage: { color: FUTURISTIC.textMuted, fontSize: 13, textAlign: "center", marginTop: -4 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginVertical: 2 },
  scoreCol: { alignItems: "center", minWidth: 84 },
  scoreLabel: { color: FUTURISTIC.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  scoreVal: { fontSize: 32, fontWeight: "900" },
  scoreDash: { color: FUTURISTIC.textMuted, fontSize: 22, fontWeight: "900" },
  rankBlock: { width: "100%", gap: 8, marginTop: 2 },
  rankBlockTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  delta: { fontSize: 14, fontWeight: "900" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: FUTURISTIC.surface3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  progressLabel: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "700", textAlign: "right" },
  statsRows: { width: "100%", gap: 6, marginTop: 2 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: FUTURISTIC.borderSoft },
  statRowLabel: { color: FUTURISTIC.textMuted, fontSize: 13, fontWeight: "600" },
  statRowValue: { color: FUTURISTIC.textPrimary, fontSize: 13, fontWeight: "800" },
  btns: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnGhost: { borderWidth: 1, borderColor: FUTURISTIC.border, backgroundColor: "transparent" },
  btnText: { fontSize: 14, fontWeight: "800" },
});
