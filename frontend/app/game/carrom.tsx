// =============================================================================
// app/game/carrom.tsx — Playable Carrom Screen
// =============================================================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Dimensions, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createInitialState, simulateStep, resolveTurn, shootStriker, setStrikerPosition,
  CarromState, BOARD_SIZE, POCKETS,
} from "@/src/games/carrom/engine";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

const { width } = Dimensions.get("window");
const DISPLAY = Math.min(width - 24, 360);
const SCALE = DISPLAY / BOARD_SIZE;

const COIN_COLORS = {
  white: "#F0E6D2",
  black: "#2A2A2A",
  queen: "#D7263D",
};

export default function CarromScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const [state, setState] = useState<CarromState>(createInitialState);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2);
  const [power, setPower] = useState(0.5);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Physics loop
  const runSimulation = useCallback(() => {
    const step = () => {
      const { state: newState, settled } = simulateStep(stateRef.current);
      setState({ ...newState });
      if (settled) {
        const resolved = resolveTurn(newState);
        setState(resolved);
        if (resolved.phase === "game_over") {
          setTimeout(() => Alert.alert(
            t("game_over") || "Game Over",
            `${resolved.winner === "player1" ? t("you_win") || "You win!" : t("opponent_wins") || "Opponent wins"}`
          ), 300);
        }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [t]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Aim with pan
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current.phase === "aiming",
      onMoveShouldSetPanResponder: () => stateRef.current.phase === "aiming",
      onPanResponderMove: (_, gesture) => {
        const s = stateRef.current;
        if (s.phase !== "aiming") return;
        const strikerX = s.striker.pos.x * SCALE;
        const strikerY = s.striker.pos.y * SCALE;
        const dx = gesture.moveX - strikerX;
        const dy = gesture.moveY - strikerY - 100; // header offset approx
        const angle = Math.atan2(-dy, -dx);
        setAimAngle(angle);
        const dragLen = Math.hypot(dx, dy);
        setPower(Math.min(1, dragLen / 150));
      },
      onPanResponderRelease: () => {
        const s = stateRef.current;
        if (s.phase !== "aiming") return;
        const shot = shootStriker(s, aimAngle, power);
        setState(shot);
        stateRef.current = shot;
        runSimulation();
      },
    })
  ).current;

  const reset = () => setState(createInitialState());

  const moveStriker = (dir: -1 | 1) => {
    const newX = state.striker.pos.x + dir * 20;
    setState(setStrikerPosition(state, newX));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_carrom") || "Carrom"}</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={FUTURISTIC.text} />
        </TouchableOpacity>
      </View>

      {/* Scores */}
      <View style={styles.scoreBar}>
        <View style={[styles.scoreBox, state.turn === "player1" && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>{t("you") || "You"}</Text>
          <Text style={styles.scoreVal}>{state.scores.player1}</Text>
        </View>
        <View style={[styles.scoreBox, state.turn === "player2" && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>{t("opponent") || "Opponent"}</Text>
          <Text style={styles.scoreVal}>{state.scores.player2}</Text>
        </View>
      </View>

      {/* Board */}
      <View style={styles.boardWrap}>
        <View
          style={[styles.board, { width: DISPLAY, height: DISPLAY }]}
          {...panResponder.panHandlers}
        >
          {/* Pockets */}
          {POCKETS.map((p, i) => (
            <View key={i} style={[styles.pocket, {
              left: p.x * SCALE - 16, top: p.y * SCALE - 16,
            }]} />
          ))}
          {/* Center circle */}
          <View style={[styles.centerCircle, {
            left: DISPLAY / 2 - 30, top: DISPLAY / 2 - 30,
          }]} />

          {/* Coins */}
          {state.coins.filter((c) => c.active).map((coin) => (
            <View key={coin.id} style={[styles.coin, {
              width: coin.radius * 2 * SCALE,
              height: coin.radius * 2 * SCALE,
              borderRadius: coin.radius * SCALE,
              backgroundColor: COIN_COLORS[coin.color],
              left: coin.pos.x * SCALE - coin.radius * SCALE,
              top: coin.pos.y * SCALE - coin.radius * SCALE,
            }]} />
          ))}

          {/* Striker */}
          {state.striker.active && (
            <View style={[styles.striker, {
              width: state.striker.radius * 2 * SCALE,
              height: state.striker.radius * 2 * SCALE,
              borderRadius: state.striker.radius * SCALE,
              left: state.striker.pos.x * SCALE - state.striker.radius * SCALE,
              top: state.striker.pos.y * SCALE - state.striker.radius * SCALE,
            }]} />
          )}

          {/* Aim line */}
          {state.phase === "aiming" && (
            <View style={[styles.aimLine, {
              left: state.striker.pos.x * SCALE,
              top: state.striker.pos.y * SCALE,
              width: power * 80,
              transform: [{ rotate: `${aimAngle + Math.PI}rad` }],
            }]} />
          )}
        </View>
      </View>

      {/* Controls */}
      {state.phase === "aiming" && (
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => moveStriker(-1)} style={styles.ctrlBtn}>
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.brand} />
          </TouchableOpacity>
          <Text style={styles.hint}>{t("drag_to_aim") || "اسحب للتصويب ثم أفلت"}</Text>
          <TouchableOpacity onPress={() => moveStriker(1)} style={styles.ctrlBtn}>
            <Ionicons name="chevron-forward" size={24} color={FUTURISTIC.brand} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.text, fontSize: 18, fontWeight: "800" },
  scoreBar: { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 10 },
  scoreBox: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: FUTURISTIC.layer2, borderWidth: 1, borderColor: FUTURISTIC.border, alignItems: "center" },
  scoreActive: { borderColor: FUTURISTIC.brand },
  scoreLabel: { color: FUTURISTIC.textMuted, fontSize: 11 },
  scoreVal: { color: FUTURISTIC.text, fontSize: 20, fontWeight: "900" },
  boardWrap: { alignItems: "center", marginTop: 12 },
  board: { position: "relative", backgroundColor: "#C9A876", borderRadius: 12, borderWidth: 8, borderColor: "#6B4F2E" },
  pocket: { position: "absolute", width: 32, height: 32, borderRadius: 16, backgroundColor: "#1A1A1A" },
  centerCircle: { position: "absolute", width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "#B0916040" },
  coin: { position: "absolute", borderWidth: 1, borderColor: "rgba(0,0,0,0.2)" },
  striker: { position: "absolute", backgroundColor: "#4A90D9", borderWidth: 2, borderColor: "#fff" },
  aimLine: { position: "absolute", height: 2, backgroundColor: "rgba(255,255,255,0.6)" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 20 },
  ctrlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: FUTURISTIC.layer2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: FUTURISTIC.border },
  hint: { color: FUTURISTIC.textMuted, fontSize: 13 },
});
