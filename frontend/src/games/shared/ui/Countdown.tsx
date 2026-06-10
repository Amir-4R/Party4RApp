// =============================================================================
// src/games/shared/ui/Countdown.tsx — Party4R Pre-match Countdown (3·2·1·GO)
// =============================================================================
// عدّاد تنازلي احترافي قبل بدء المباراة. واضح، سريع، أنيق، خفيف على الأداء
// (يستخدم Animated المدمج فقط). يشغّل صوت العدّ ثم صوت البداية تلقائياً (يُتجاهل
// بأمان إن لم تُضف ملفات الصوت بعد).
// =============================================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { withAlpha } from "@/src/games/shared/gameTheme";
import { playSound } from "@/src/games/sound/SoundManager";

export default function Countdown({
  start = 3,
  onDone,
  goLabel = "ابدأ",
}: {
  start?: number;
  onDone: () => void;
  goLabel?: string;
}) {
  // value goes start..1, then 0 means "GO"
  const [value, setValue] = useState(start);
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  // Pop animation each tick
  useEffect(() => {
    scale.setValue(0.4);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    if (value === 0) playSound("match_start");
    else playSound("countdown_beep");
  }, [value, scale, opacity]);

  // Tick driver
  useEffect(() => {
    const id = setTimeout(() => {
      if (value > 1) setValue((v) => v - 1);
      else if (value === 1) setValue(0); // → GO
      else {
        if (!doneRef.current) { doneRef.current = true; onDone(); }
      }
    }, value === 0 ? 600 : 750);
    return () => clearTimeout(id);
  }, [value, onDone]);

  const isGo = value === 0;
  const color = isGo ? FUTURISTIC.success : FUTURISTIC.brand;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <LinearGradient
        colors={[withAlpha("#000000", 0.45), withAlpha("#000000", 0.72)]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <View style={[styles.ring, { borderColor: color, shadowColor: color }]}>
          <Text style={[styles.num, { color }]}>{isGo ? goLabel : value}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 60 },
  ring: {
    minWidth: 140, minHeight: 140, paddingHorizontal: 24,
    borderRadius: 80, borderWidth: 3,
    alignItems: "center", justifyContent: "center",
    backgroundColor: withAlpha("#000000", 0.3),
    shadowOpacity: 0.7, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  num: { fontSize: 64, fontWeight: "900", letterSpacing: 1 },
});
