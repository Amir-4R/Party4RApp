// =============================================================================
// app/game/carrom.tsx — Playable Carrom Screen (TOURNAMENT-GRADE)
// =============================================================================
// Renders the full 740×740 logical board with throw lines, decor circles, four
// corner pockets, all 19 pieces, the striker, and an aim laser. Implements:
//   • Striker movement constrained to the active player's throw line.
//   • Drag-to-aim from the striker → release to shoot (angle + power).
//   • Live 60s turn countdown with auto-pass on timeout.
//   • Live scoreboard (white = 20, black = 10, queen = 50 when covered).
//   • Foul banner when the striker is pocketed.
// =============================================================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder, Dimensions, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createInitialState, simulateStep, resolveTurn, shootStriker,
  setStrikerPosition, tickTurnTimer,
  CarromState, BOARD_SIZE, POCKETS, POCKET_RADIUS,
  CENTER_CIRCLE_RADIUS, DECOR_CIRCLES, DECOR_RING_RADIUS,
  THROW_LINES, THROW_END_CIRCLE_RADIUS, throwLineForPlayer,
} from "@/src/games/carrom/engine";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

const { width } = Dimensions.get("window");
const DISPLAY = Math.min(width - 24, 380);
const SCALE = DISPLAY / BOARD_SIZE;

const COIN_COLORS = {
  white: "#F4ECD8",
  black: "#222226",
  queen: "#D7263D",
};

export default function CarromScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const [state, setState] = useState<CarromState>(createInitialState);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2);
  const [power, setPower] = useState(0);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Physics loop ──────────────────────────────────────────────────────────
  const runSimulation = useCallback(() => {
    const step = () => {
      const { state: next, settled } = simulateStep(stateRef.current);
      setState({ ...next });
      stateRef.current = next;
      if (settled) {
        const resolved = resolveTurn(next);
        setState(resolved);
        stateRef.current = resolved;
        if (resolved.phase === "game_over") {
          setTimeout(() => Alert.alert(
            t("game_over") || "Game Over",
            resolved.winner === "draw"
              ? (t("its_a_draw") || "It's a draw!")
              : resolved.winner === "player1"
                ? (t("you_win") || "You win!")
                : (t("opponent_wins") || "Opponent wins"),
          ), 250);
        }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [t]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── 60s turn countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "aiming") return;
    const id = setInterval(() => {
      setState((s) => tickTurnTimer(s, 1));
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  // ── Drag to aim ───────────────────────────────────────────────────────────
  const boardOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current.phase === "aiming",
      onMoveShouldSetPanResponder: () => stateRef.current.phase === "aiming",
      onPanResponderMove: (e, gesture) => {
        const s = stateRef.current;
        if (s.phase !== "aiming") return;
        const line = throwLineForPlayer(s.turn);
        // The first touch DOWN starts at the striker; subsequent moves draw an
        // angled arrow.  The player drags AWAY from the target — releasing
        // catapults the striker in the OPPOSITE direction.
        const touchBoardX = (e.nativeEvent.pageX - boardOriginRef.current.x) / SCALE;
        const touchBoardY = (e.nativeEvent.pageY - boardOriginRef.current.y) / SCALE;
        const dx = touchBoardX - s.striker.pos.x;
        const dy = touchBoardY - s.striker.pos.y;

        // While the touch is *along the throw line* (horizontal for top/bottom,
        // vertical for left/right) we treat it as repositioning. Otherwise we
        // treat it as aiming.
        // Heuristic: if drag is mostly along the line axis AND power is tiny,
        // it's a slide; otherwise it's an aim drag.
        const dragLen = Math.hypot(dx, dy);
        const alongLine = line.horizontal ? Math.abs(dx) > Math.abs(dy) * 1.5 : Math.abs(dy) > Math.abs(dx) * 1.5;

        if (alongLine && dragLen < 60) {
          // Slide the striker along the line
          if (line.horizontal) {
            setState((prev) => setStrikerPosition(prev, touchBoardX));
          } else {
            setState((prev) => setStrikerPosition(prev, line.start.x, touchBoardY));
          }
          return;
        }

        // Aiming: angle points FROM the drag-end BACK to the striker, so the
        // striker shoots in the OPPOSITE direction of the drag (slingshot).
        const angle = Math.atan2(-dy, -dx);
        setAimAngle(angle);
        setPower(Math.min(1, dragLen / 160));
      },
      onPanResponderRelease: () => {
        const s = stateRef.current;
        if (s.phase !== "aiming" || power < 0.05) {
          setPower(0);
          return;
        }
        const shot = shootStriker(s, aimAngle, power);
        setState(shot);
        stateRef.current = shot;
        setPower(0);
        runSimulation();
      },
      onPanResponderTerminate: () => setPower(0),
    }),
  ).current;

  const reset = () => {
    setState(createInitialState());
    setAimAngle(-Math.PI / 2);
    setPower(0);
  };

  const moveStriker = (dir: -1 | 1) => {
    const line = throwLineForPlayer(state.turn);
    const step = 25;
    if (line.horizontal) {
      setState((s) => setStrikerPosition(s, s.striker.pos.x + dir * step));
    } else {
      setState((s) => setStrikerPosition(s, line.start.x, s.striker.pos.y + dir * step));
    }
  };

  const activeLine = throwLineForPlayer(state.turn);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_carrom") || "Carrom"}</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Scores + Timer */}
      <View style={styles.scoreBar}>
        <View style={[styles.scoreBox, state.turn === "player1" && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>{t("you") || "You"}</Text>
          <Text style={styles.scoreVal}>{state.scores.player1}</Text>
        </View>
        <View style={[styles.timerBox, state.turnSecondsLeft <= 10 && styles.timerWarn]}>
          <Ionicons name="time-outline" size={18} color={state.turnSecondsLeft <= 10 ? "#FF5C5C" : FUTURISTIC.brand} />
          <Text style={[styles.timerText, state.turnSecondsLeft <= 10 && { color: "#FF5C5C" }]}>
            {Math.ceil(state.turnSecondsLeft)}s
          </Text>
        </View>
        <View style={[styles.scoreBox, state.turn === "player2" && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>{t("opponent") || "Opponent"}</Text>
          <Text style={styles.scoreVal}>{state.scores.player2}</Text>
        </View>
      </View>

      {state.queenPocketed && !state.queenAwarded && (
        <View style={styles.queenHint}>
          <Ionicons name="alert-circle" size={14} color="#D7263D" />
          <Text style={styles.queenHintText}>
            {t("cover_queen") || "Pocket a coin this turn to claim the Queen (+50)"}
          </Text>
        </View>
      )}

      {state.foul && state.foulReason && (
        <View style={styles.foulBanner}>
          <Ionicons name="warning" size={14} color="#FFB147" />
          <Text style={styles.foulText}>
            {state.foulReason === "striker_pocketed"
              ? (t("foul_striker") || "Foul! Striker pocketed — -10 pts")
              : state.foulReason === "turn_timeout"
                ? (t("foul_timeout") || "Time out! Turn passed to opponent")
                : state.foulReason}
          </Text>
        </View>
      )}

      {/* Board */}
      <View style={styles.boardWrap}>
        <View
          style={[styles.board, { width: DISPLAY, height: DISPLAY }]}
          {...panResponder.panHandlers}
          onLayout={(e) => {
            // Capture absolute origin for accurate touch → board coords.
            e.target?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
              boardOriginRef.current = { x: pageX, y: pageY };
            });
          }}
        >
          {/* Throw lines (all 4, but highlight the active one) */}
          {THROW_LINES.map((line, i) => {
            const isActive = activeLine.side === line.side;
            if (line.horizontal) {
              return (
                <View key={i} style={{
                  position: "absolute",
                  left: line.start.x * SCALE,
                  top: line.start.y * SCALE - 1,
                  width: (line.end.x - line.start.x) * SCALE,
                  height: 2,
                  backgroundColor: isActive ? FUTURISTIC.brand : "rgba(255,255,255,0.15)",
                }} />
              );
            }
            return (
              <View key={i} style={{
                position: "absolute",
                left: line.start.x * SCALE - 1,
                top: line.start.y * SCALE,
                width: 2,
                height: (line.end.y - line.start.y) * SCALE,
                backgroundColor: isActive ? FUTURISTIC.brand : "rgba(255,255,255,0.15)",
              }} />
            );
          })}

          {/* Throw line end circles */}
          {THROW_LINES.flatMap((line, i) =>
            [line.start, line.end].map((pt, j) => (
              <View key={`${i}-${j}`} style={{
                position: "absolute",
                left: pt.x * SCALE - THROW_END_CIRCLE_RADIUS * SCALE,
                top: pt.y * SCALE - THROW_END_CIRCLE_RADIUS * SCALE,
                width: THROW_END_CIRCLE_RADIUS * 2 * SCALE,
                height: THROW_END_CIRCLE_RADIUS * 2 * SCALE,
                borderRadius: THROW_END_CIRCLE_RADIUS * SCALE,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.25)",
              }} />
            )),
          )}

          {/* Decor circles (6 around centre) */}
          {DECOR_CIRCLES.map((p, i) => (
            <View key={`dc-${i}`} style={{
              position: "absolute",
              left: p.x * SCALE - CENTER_CIRCLE_RADIUS * SCALE,
              top: p.y * SCALE - CENTER_CIRCLE_RADIUS * SCALE,
              width: CENTER_CIRCLE_RADIUS * 2 * SCALE,
              height: CENTER_CIRCLE_RADIUS * 2 * SCALE,
              borderRadius: CENTER_CIRCLE_RADIUS * SCALE,
              borderWidth: 1,
              borderColor: "rgba(120,80,40,0.4)",
            }} />
          ))}

          {/* Center circle */}
          <View style={{
            position: "absolute",
            left: BOARD_SIZE / 2 * SCALE - CENTER_CIRCLE_RADIUS * SCALE,
            top: BOARD_SIZE / 2 * SCALE - CENTER_CIRCLE_RADIUS * SCALE,
            width: CENTER_CIRCLE_RADIUS * 2 * SCALE,
            height: CENTER_CIRCLE_RADIUS * 2 * SCALE,
            borderRadius: CENTER_CIRCLE_RADIUS * SCALE,
            borderWidth: 2,
            borderColor: "rgba(120,80,40,0.6)",
          }} />

          {/* Decor outer ring */}
          <View style={{
            position: "absolute",
            left: BOARD_SIZE / 2 * SCALE - DECOR_RING_RADIUS * SCALE,
            top: BOARD_SIZE / 2 * SCALE - DECOR_RING_RADIUS * SCALE,
            width: DECOR_RING_RADIUS * 2 * SCALE,
            height: DECOR_RING_RADIUS * 2 * SCALE,
            borderRadius: DECOR_RING_RADIUS * SCALE,
            borderWidth: 1,
            borderColor: "rgba(120,80,40,0.2)",
          }} />

          {/* Pockets */}
          {POCKETS.map((p, i) => (
            <View key={`pocket-${i}`} style={{
              position: "absolute",
              left: p.x * SCALE - POCKET_RADIUS * SCALE,
              top: p.y * SCALE - POCKET_RADIUS * SCALE,
              width: POCKET_RADIUS * 2 * SCALE,
              height: POCKET_RADIUS * 2 * SCALE,
              borderRadius: POCKET_RADIUS * SCALE,
              backgroundColor: "#0A0A0A",
              borderWidth: 1.5,
              borderColor: "#3A2F1F",
            }} />
          ))}

          {/* Coins */}
          {state.coins.filter((c) => c.active).map((coin) => (
            <View key={coin.id} style={[styles.coin, {
              width: coin.radius * 2 * SCALE,
              height: coin.radius * 2 * SCALE,
              borderRadius: coin.radius * SCALE,
              backgroundColor: COIN_COLORS[coin.color],
              left: coin.pos.x * SCALE - coin.radius * SCALE,
              top: coin.pos.y * SCALE - coin.radius * SCALE,
              borderColor: coin.color === "queen" ? "#FFD86B" : "rgba(0,0,0,0.25)",
              borderWidth: coin.color === "queen" ? 2 : 1,
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

          {/* Aim arrow */}
          {state.phase === "aiming" && power > 0.05 && (
            <View pointerEvents="none" style={{
              position: "absolute",
              left: state.striker.pos.x * SCALE,
              top: state.striker.pos.y * SCALE - 1.5,
              width: power * 120,
              height: 3,
              backgroundColor: power > 0.7 ? "#FF5C5C" : FUTURISTIC.brand,
              transform: [{ translateY: -1.5 }, { rotate: `${aimAngle}rad` }],
              transformOrigin: "0% 50%",
            }} />
          )}
        </View>
      </View>

      {/* Controls */}
      {state.phase === "aiming" && (
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => moveStriker(-1)} style={styles.ctrlBtn}>
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.brand} />
          </TouchableOpacity>
          <View style={styles.hintBox}>
            <Text style={styles.hint}>{t("drag_to_aim") || "اسحب للتصويب ثم أفلت"}</Text>
            {power > 0 && (
              <Text style={styles.powerHint}>
                {(t("power") || "Power")}: {Math.round(power * 100)}%
              </Text>
            )}
          </View>
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "800" },
  scoreBar: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  scoreBox: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    alignItems: "center", minWidth: 80,
  },
  scoreActive: { borderColor: FUTURISTIC.brand, shadowColor: FUTURISTIC.brand, shadowOpacity: 0.4, shadowRadius: 8 },
  scoreLabel: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  scoreVal: { color: FUTURISTIC.textPrimary, fontSize: 20, fontWeight: "900" },
  timerBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.brandEdge,
  },
  timerWarn: { borderColor: "#FF5C5C", backgroundColor: "#FF5C5C15" },
  timerText: { color: FUTURISTIC.brand, fontWeight: "900", fontSize: 14 },
  queenHint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#D7263D15", borderColor: "#D7263D55",
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    marginHorizontal: 16, marginTop: 4,
  },
  queenHintText: { color: "#FF8888", fontSize: 11, fontWeight: "700", flex: 1 },
  foulBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFB14715", borderColor: "#FFB14755",
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    marginHorizontal: 16, marginTop: 4,
  },
  foulText: { color: "#FFB147", fontSize: 11, fontWeight: "700", flex: 1 },
  boardWrap: { alignItems: "center", marginTop: 10 },
  board: {
    position: "relative", backgroundColor: "#D4A772",
    borderRadius: 14, borderWidth: 10, borderColor: "#6B4F2E",
    overflow: "hidden",
  },
  coin: { position: "absolute" },
  striker: {
    position: "absolute",
    backgroundColor: "#5BC0EB",
    borderWidth: 2, borderColor: "#fff",
    shadowColor: "#5BC0EB", shadowOpacity: 0.6, shadowRadius: 6,
  },
  controls: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 16, marginTop: 16,
  },
  ctrlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: FUTURISTIC.surface1,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.brandEdge,
  },
  hintBox: { alignItems: "center", minWidth: 180 },
  hint: { color: FUTURISTIC.textMuted, fontSize: 12 },
  powerHint: { color: FUTURISTIC.brand, fontSize: 11, fontWeight: "800", marginTop: 2 },
});
