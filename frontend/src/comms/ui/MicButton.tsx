// =============================================================================
// src/comms/ui/MicButton.tsx — Push-to-talk mic + privacy menu
// =============================================================================
// • ضغطة مطوّلة = تحدّث أثناء الضغط (push-to-talk).
// • ضغطة واحدة = كتم/إيقاف المايك.
// • أحمر واضح عند التشغيل، عادي عند الإيقاف.
// • قائمة صغيرة لخصوصية المايك (الخصم/الأصدقاء/الجميع/مطفي) محفوظة.
// • يطلب الصلاحية عند الحاجة، ويظهر رسالة واضحة عند الرفض.
// تصميم زجاجي متناسق مع Party4R، صغير ولا يغطّي اللعب.
// =============================================================================
import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, TouchableOpacity, Alert, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { withAlpha } from "@/src/games/shared/gameTheme";
import { useComms, MicMode } from "@/src/comms/CommsContext";
import { useT } from "@/src/context/LanguageContext";

const MODE_META: Record<MicMode, { icon: string; labelKey: string; fallback: string }> = {
  off:      { icon: "mic-off",       labelKey: "mic_off",      fallback: "مطفي" },
  opponent: { icon: "person",        labelKey: "mic_opponent", fallback: "الخصم فقط" },
  friends:  { icon: "people",        labelKey: "mic_friends",  fallback: "الأصدقاء فقط" },
  everyone: { icon: "earth",         labelKey: "mic_everyone", fallback: "الجميع" },
};

export default function MicButton({ style, compact }: { style?: ViewStyle; compact?: boolean }) {
  const { t } = useT();
  const { micMode, setMicMode, micActive, startTalking, stopTalking, ensureMicPermission } = useComms();
  const [menuOpen, setMenuOpen] = useState(false);
  const holdRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastModeRef = useRef<MicMode>("everyone");

  const onPressIn = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Hold threshold → push-to-talk.
    timerRef.current = setTimeout(async () => {
      if (micMode === "off") {
        // Holding while muted does nothing but inform the user once.
        return;
      }
      holdRef.current = true;
      const p = await ensureMicPermission();
      if (p === "denied") {
        holdRef.current = false;
        Alert.alert(
          t("mic_perm_title") || "صلاحية المايك",
          t("mic_perm_body") || "فعّل صلاحية الميكروفون من إعدادات الجهاز لاستخدام التحدّث الصوتي.",
        );
        return;
      }
      startTalking();
    }, 200);
  };

  const onPressOut = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (holdRef.current) {
      holdRef.current = false;
      stopTalking();
    } else {
      // Quick tap = toggle mute on/off.
      if (micMode === "off") setMicMode(lastModeRef.current || "everyone");
      else { lastModeRef.current = micMode; setMicMode("off"); }
    }
  };

  const active = micActive;
  const muted = micMode === "off";
  const baseColor = active ? "#FF3B3B" : muted ? FUTURISTIC.textMuted : FUTURISTIC.brand;
  const size = compact ? 44 : 52;

  return (
    <View style={[styles.wrap, style]}>
      {/* Privacy mode chip */}
      <TouchableOpacity style={styles.modeChip} onPress={() => setMenuOpen(true)} activeOpacity={0.85}>
        <Ionicons name={MODE_META[micMode].icon as any} size={12} color={FUTURISTIC.textSecondary} />
        <Text style={styles.modeChipText} numberOfLines={1}>
          {t(MODE_META[micMode].labelKey) || MODE_META[micMode].fallback}
        </Text>
      </TouchableOpacity>

      {/* Push-to-talk button */}
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.btn,
          {
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: withAlpha(baseColor, active ? 0.28 : 0.14),
            borderColor: baseColor,
            shadowColor: baseColor,
            shadowOpacity: active ? 0.8 : 0.3,
            transform: [{ scale: pressed && !muted ? 1.08 : 1 }],
          },
        ]}
      >
        <Ionicons name={active ? "mic" : muted ? "mic-off" : "mic-outline"} size={size * 0.5} color={baseColor} />
      </Pressable>
      <Text style={[styles.hint, { color: active ? "#FF6B6B" : FUTURISTIC.textMuted }]}>
        {active ? (t("talking") || "يتحدّث…") : muted ? (t("mic_muted") || "مكتوم") : (t("hold_to_talk") || "اضغط مطوّلاً")}
      </Text>

      {/* Privacy menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{t("mic_privacy") || "من يسمع صوتي؟"}</Text>
            {(["opponent", "friends", "everyone", "off"] as MicMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.menuItem, micMode === m && { backgroundColor: withAlpha(FUTURISTIC.brand, 0.14) }]}
                onPress={() => { if (m !== "off") lastModeRef.current = m; setMicMode(m); setMenuOpen(false); }}
                activeOpacity={0.85}
              >
                <Ionicons name={MODE_META[m].icon as any} size={18} color={micMode === m ? FUTURISTIC.brand : FUTURISTIC.textSecondary} />
                <Text style={[styles.menuItemText, micMode === m && { color: FUTURISTIC.brand, fontWeight: "900" }]}>
                  {t(MODE_META[m].labelKey) || MODE_META[m].fallback}
                </Text>
                {micMode === m && <Ionicons name="checkmark" size={16} color={FUTURISTIC.brand} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  modeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: FUTURISTIC.glassFill, borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    maxWidth: 120,
  },
  modeChipText: { color: FUTURISTIC.textSecondary, fontSize: 10, fontWeight: "700" },
  btn: {
    alignItems: "center", justifyContent: "center", borderWidth: 2,
    shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  hint: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  menuCard: {
    width: "100%", maxWidth: 320, backgroundColor: FUTURISTIC.surface1,
    borderRadius: 18, borderWidth: 1, borderColor: FUTURISTIC.border, padding: 14, gap: 6,
  },
  menuTitle: { color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "900", marginBottom: 4, textAlign: "center" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12 },
  menuItemText: { flex: 1, color: FUTURISTIC.textSecondary, fontSize: 14, fontWeight: "700" },
});
