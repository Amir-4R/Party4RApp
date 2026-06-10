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
  View, Text, StyleSheet, TouchableOpacity, PanResponder, Dimensions, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  createInitialState, simulateStep, resolveTurn, shootStriker,
  setStrikerPosition, tickTurnTimer,
  CarromState, BOARD_SIZE, POCKETS, POCKET_RADIUS,
  CENTER_CIRCLE_RADIUS, DECOR_CIRCLES, DECOR_RING_RADIUS,
  THROW_LINES, THROW_END_CIRCLE_RADIUS, throwLineForPlayer,
} from "@/src/games/carrom/engine";
import { planBotShot } from "@/src/games/carrom/ai";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useTheme } from "@/src/context/ThemeContext";
import { carromPalette, gameBackground, withAlpha } from "@/src/games/shared/gameTheme";
import { useT } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { getAvatarUrl } from "@/src/constants/avatars";
import GameResultOverlay from "@/src/games/shared/ui/GameResultOverlay";
import Countdown from "@/src/games/shared/ui/Countdown";
import { recordResult, RecordResult } from "@/src/games/stats";
import { playSound } from "@/src/games/sound/SoundManager";
import GameCommsBar from "@/src/comms/ui/GameCommsBar";
import { useGamePersistence } from "@/src/comms/useGamePersistence";

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
  const { user } = useAuth();
  const { themeId } = useTheme();
  // Themed palette + background derived from the active Party4R theme.
  // Recomputed each render (cheap) and the screen re-mounts on theme change.
  const pal = carromPalette();
  const bg = gameBackground(themeId);

  const [state, setState] = useState<CarromState>(createInitialState);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2);
  const [power, setPower] = useState(0);
  // Refs to capture the latest aim/power values inside the PanResponder
  // closure (which is created only ONCE on mount). Without these refs the
  // release callback would always see the stale initial values, so the
  // striker never shoots.
  const powerRef = useRef(0);
  const aimAngleRef = useRef(-Math.PI / 2);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Unified framework: intro countdown + match-result recording.
  const [counting, setCounting] = useState(true);
  const countingRef = useRef(true);
  countingRef.current = counting;
  const [result, setResult] = useState<RecordResult | null>(null);
  const recordedRef = useRef(false);

  // ── Game persistence + in-game comms (resume after temporary exit) ─────
  const persist = useGamePersistence<CarromState>({
    key: "carrom",
    userId: user?.id,
    getState: () => stateRef.current,
    restore: (s) => { setState(s); stateRef.current = s; setCounting(false); },
    paused: state.phase === "game_over",
  });
  const exitGame = useCallback(() => { persist.clear(); router.back(); }, [persist, router]);

  // Once the match is over, drop the resume snapshot so it isn't restored later.
  useEffect(() => {
    if (state.phase === "game_over") persist.clear();
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Physics loop ──────────────────────────────────────────────────────────
  const runSimulation = useCallback(() => {
    const step = () => {
      const { state: next, settled } = simulateStep(stateRef.current);
      setState({ ...next });
      stateRef.current = next;
      if (settled) {
        if (next.lastShotPockets.length > 0) playSound("carrom_pocket");
        const resolved = resolveTurn(next);
        setState(resolved);
        stateRef.current = resolved;
        // On game over, record the match into the unified stats/rank system
        // (once). The result drives the unified GameResultOverlay.
        if (resolved.phase === "game_over" && !recordedRef.current) {
          recordedRef.current = true;
          const outcome = resolved.winner === "draw" ? "draw" : resolved.winner === "player1" ? "win" : "loss";
          recordResult(user?.id || "guest", "carrom", outcome).then(setResult).catch(() => {});
        }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [t, user]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── 60s turn countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "aiming" || counting) return;
    const id = setInterval(() => {
      setState((s) => tickTurnTimer(s, 1));
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase, counting]);

  // ── AI bot: plays automatically when it's player2's turn ──────────────────
  useEffect(() => {
    if (state.phase !== "aiming" || counting) return;
    if (state.turn !== "player2") return;
    // Slight delay so the player can see the result of their own shot first.
    const id = setTimeout(() => {
      // Re-check current state (the player may have reset the game)
      const s = stateRef.current;
      if (s.phase !== "aiming" || s.turn !== "player2") return;
      const plan = planBotShot(s);
      // 1) Position the striker on the bot's throw line
      const positioned = setStrikerPosition(s, plan.strikerX, plan.strikerY);
      // 2) Shoot
      const shot = shootStriker(positioned, plan.angle, plan.power);
      setState(shot);
      stateRef.current = shot;
      runSimulation();
    }, 2000);
    return () => clearTimeout(id);
  }, [state.phase, state.turn, runSimulation, counting]);

  // ── Drag to aim ───────────────────────────────────────────────────────────
  const boardOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const boardRef = useRef<View>(null);
  // Re-measure on mount and on window resize so touches map correctly.
  useEffect(() => {
    const update = () => {
      boardRef.current?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
        boardOriginRef.current = { x: pageX, y: pageY };
      });
    };
    update();
    const id = setTimeout(update, 300); // catch post-layout settling
    return () => clearTimeout(id);
  }, []);
  // Drag offset (vector from striker → current touch) in BOARD units.  The
  // striker shoots in the OPPOSITE direction (slingshot) with power
  // proportional to drag length.
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const MAX_DRAG = 160; // board units → full power

  const panResponder = useRef(
    PanResponder.create({
      // Allow any touch on the player's half of the board to start aiming.
      // The PanResponder gate is intentionally loose so users don't need to
      // pixel-hit the small striker. Aim direction is still calculated
      // relative to the striker's actual position.
      onStartShouldSetPanResponder: () => {
        const s = stateRef.current;
        return !countingRef.current && s.phase === "aiming" && s.turn === "player1";
      },
      onMoveShouldSetPanResponder: () => {
        const s = stateRef.current;
        return !countingRef.current && s.phase === "aiming" && s.turn === "player1";
      },
      onPanResponderGrant: () => {
        setDragOffset({ x: 0, y: 0 });
      },
      onPanResponderMove: (e) => {
        const s = stateRef.current;
        if (s.phase !== "aiming") return;
        const touchBoardX = (e.nativeEvent.pageX - boardOriginRef.current.x) / SCALE;
        const touchBoardY = (e.nativeEvent.pageY - boardOriginRef.current.y) / SCALE;
        const dx = touchBoardX - s.striker.pos.x;
        const dy = touchBoardY - s.striker.pos.y;
        // Clamp drag length so the arrow can't extend forever
        const len = Math.hypot(dx, dy);
        const clampedLen = Math.min(len, MAX_DRAG);
        const cx = len > 0 ? (dx / len) * clampedLen : 0;
        const cy = len > 0 ? (dy / len) * clampedLen : 0;
        setDragOffset({ x: cx, y: cy });
        // Aim direction is OPPOSITE the drag (slingshot)
        const angle = Math.atan2(-cy, -cx);
        const p = clampedLen / MAX_DRAG;
        setAimAngle(angle);
        setPower(p);
        // Keep refs in sync so the release callback sees the LATEST values.
        aimAngleRef.current = angle;
        powerRef.current = p;
      },
      onPanResponderRelease: () => {
        const s = stateRef.current;
        const p = powerRef.current;
        const angle = aimAngleRef.current;
        setDragOffset(null);
        if (s.phase !== "aiming" || p < 0.08) {
          setPower(0);
          powerRef.current = 0;
          return;
        }
        const shot = shootStriker(s, angle, p);
        setState(shot);
        stateRef.current = shot;
        setPower(0);
        powerRef.current = 0;
        playSound("piece_move");
        runSimulation();
      },
      onPanResponderTerminate: () => {
        setDragOffset(null);
        setPower(0);
        powerRef.current = 0;
      },
    }),
  ).current;

  const reset = () => {
    setState(createInitialState());
    setAimAngle(-Math.PI / 2);
    setPower(0);
    setResult(null);
    recordedRef.current = false;
    setCounting(true);
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
      {/* Themed background — follows the active Party4R theme */}
      <LinearGradient
        colors={bg}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={exitGame} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_carrom") || "Carrom"}</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Player VS Bot panel */}
      <View style={styles.vsBar}>
        {/* Player (You) */}
        <View style={[styles.playerCard, state.turn === "player1" && styles.playerCardActive]}>
          <Image
            source={{ uri: getAvatarUrl(user?.avatar || "avatar_ninja") }}
            style={[styles.playerAvatar, state.turn === "player1" && styles.playerAvatarActive]}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.playerName} numberOfLines={1}>
              {user?.nickname || user?.username || (t("you") || "You")}
            </Text>
            <Text style={styles.playerScore}>{state.scores.player1}</Text>
          </View>
        </View>

        {/* Timer/VS center */}
        <View style={styles.vsCenter}>
          <Text style={styles.vsText}>VS</Text>
          <View style={[styles.timerBox, state.turnSecondsLeft <= 10 && styles.timerWarn]}>
            <Ionicons name="time-outline" size={14} color={state.turnSecondsLeft <= 10 ? "#FF5C5C" : FUTURISTIC.brand} />
            <Text style={[styles.timerText, state.turnSecondsLeft <= 10 && { color: "#FF5C5C" }]}>
              {Math.ceil(state.turnSecondsLeft)}s
            </Text>
          </View>
        </View>

        {/* Bot opponent */}
        <View style={[styles.playerCard, state.turn === "player2" && styles.playerCardActive]}>
          <View style={{ flex: 1, marginRight: 8, alignItems: "flex-end" }}>
            <Text style={styles.playerName} numberOfLines={1}>🤖 {t("bot") || "Bot"}</Text>
            <Text style={styles.playerScore}>{state.scores.player2}</Text>
          </View>
          <View style={[styles.botAvatar, state.turn === "player2" && styles.playerAvatarActive]}>
            <Ionicons name="hardware-chip" size={28} color={FUTURISTIC.brand} />
          </View>
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
      <View style={[styles.boardWrap, { shadowColor: pal.glow, shadowOpacity: 0.6, shadowRadius: 20 }]}>
        <View
          ref={boardRef}
          style={[
            styles.board,
            {
              width: DISPLAY,
              height: DISPLAY,
              backgroundColor: pal.felt,
              borderColor: pal.frame,
              borderTopColor: pal.frameLight,
              borderBottomColor: pal.frameDark,
            },
          ]}
          {...panResponder.panHandlers}
          onLayout={() => {
            boardRef.current?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
              boardOriginRef.current = { x: pageX, y: pageY };
            });
          }}
        >
          {/* Felt — radial-style vignette via diagonal gradient (themed) */}
          <LinearGradient
            pointerEvents="none"
            colors={[pal.felt, pal.felt, pal.feltEdge]}
            start={{ x: 0.25, y: 0.2 }}
            end={{ x: 0.85, y: 0.95 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Faint theme tint wash over the felt */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: pal.feltTint }]} />
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
                  backgroundColor: isActive ? pal.lineActive : pal.line,
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
                backgroundColor: isActive ? pal.lineActive : pal.line,
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
                borderColor: pal.line,
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
              borderColor: pal.decor,
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
            borderColor: pal.decor,
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
            borderColor: withAlpha(pal.decor, 0.4),
          }} />

          {/* Pockets — balanced (outer edge sits on inner wall) with subtle halo */}
          {POCKETS.map((p, i) => {
            // Visual = hitbox · 1.1  → tiny halo ring for premium look without
            // changing physics behavior.
            const visualRadius = POCKET_RADIUS * 1.1;
            return (
              <View key={`pocket-${i}`} style={{
                position: "absolute",
                left: p.x * SCALE - visualRadius * SCALE,
                top: p.y * SCALE - visualRadius * SCALE,
                width: visualRadius * 2 * SCALE,
                height: visualRadius * 2 * SCALE,
                borderRadius: visualRadius * SCALE,
                backgroundColor: "#050505",
                borderWidth: 2,
                borderColor: "#3A2716",
                zIndex: 5,
                shadowColor: "#000",
                shadowOpacity: 0.85,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                alignItems: "center",
                justifyContent: "center",
              }}>
                <View style={{
                  width: visualRadius * 1.6 * SCALE,
                  height: visualRadius * 1.6 * SCALE,
                  borderRadius: visualRadius * 0.8 * SCALE,
                  backgroundColor: "#000",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }} />
              </View>
            );
          })}

          {/* Coins — with metallic gradient + central ornament */}
          {state.coins.filter((c) => c.active).map((coin) => {
            const size = coin.radius * 2 * SCALE;
            const isQueen = coin.color === "queen";
            const isWhite = coin.color === "white";
            const baseColor = COIN_COLORS[coin.color];
            const ringColor = isQueen ? "#FFD86B" : isWhite ? "#A8A085" : "#444";
            const innerColor = isQueen ? "#FF4D5F" : isWhite ? "#FFF8E8" : "#3A3A40";
            return (
              <View key={coin.id} style={{
                position: "absolute",
                width: size, height: size, borderRadius: size / 2,
                left: coin.pos.x * SCALE - coin.radius * SCALE,
                top: coin.pos.y * SCALE - coin.radius * SCALE,
                backgroundColor: ringColor,
                padding: 1.5,
                shadowColor: isQueen ? "#FFD86B" : "#000",
                shadowOpacity: isQueen ? 0.6 : 0.4,
                shadowRadius: isQueen ? 6 : 2,
              }}>
                <LinearGradient
                  colors={[innerColor, baseColor, isWhite ? "#D8C9A8" : isQueen ? "#9B0F26" : "#000"]}
                  start={{ x: 0.3, y: 0.2 }}
                  end={{ x: 0.7, y: 0.8 }}
                  style={{
                    flex: 1, borderRadius: (size - 3) / 2,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {isQueen ? (
                    <Ionicons name="diamond" size={size * 0.5} color="#FFD86B" />
                  ) : (
                    <Ionicons
                      name="flower-outline"
                      size={size * 0.42}
                      color={isWhite ? "rgba(120,100,60,0.6)" : "rgba(180,180,200,0.5)"}
                    />
                  )}
                  {/* Top highlight */}
                  <View pointerEvents="none" style={{
                    position: "absolute", top: 2, left: size * 0.18,
                    width: size * 0.35, height: size * 0.18, borderRadius: size,
                    backgroundColor: "rgba(255,255,255,0.35)",
                  }} />
                </LinearGradient>
              </View>
            );
          })}

          {/* Striker — premium metallic blue */}
          {state.striker.active && (() => {
            const size = state.striker.radius * 2 * SCALE;
            return (
              <View style={{
                position: "absolute",
                width: size, height: size, borderRadius: size / 2,
                left: state.striker.pos.x * SCALE - state.striker.radius * SCALE,
                top: state.striker.pos.y * SCALE - state.striker.radius * SCALE,
                backgroundColor: pal.strikerLo,
                padding: 2,
                shadowColor: pal.glow, shadowOpacity: 0.7, shadowRadius: 8,
              }}>
                <LinearGradient
                  colors={[pal.strikerHi, pal.strikerMid, pal.strikerLo]}
                  start={{ x: 0.3, y: 0.2 }}
                  end={{ x: 0.7, y: 0.85 }}
                  style={{
                    flex: 1, borderRadius: (size - 4) / 2,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {/* Outer rim ornament */}
                  <View style={{
                    position: "absolute", inset: 2 as any,
                    borderRadius: size / 2,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
                  }} />
                  {/* Central jewel */}
                  <View style={{
                    width: size * 0.42, height: size * 0.42,
                    borderRadius: size * 0.21,
                    backgroundColor: pal.strikerJewel,
                    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name="star" size={size * 0.26} color="#FFD86B" />
                  </View>
                  {/* Top highlight */}
                  <View pointerEvents="none" style={{
                    position: "absolute", top: 3, left: size * 0.2,
                    width: size * 0.4, height: size * 0.18, borderRadius: size,
                    backgroundColor: "rgba(255,255,255,0.5)",
                  }} />
                </LinearGradient>
              </View>
            );
          })()}

          {/* Aim arrow — points FROM the striker in the direction it will go */}
          {state.phase === "aiming" && power > 0.05 && dragOffset && (
            <>
              {/* Drag trail (dashed line FROM striker TO the drag end-point) */}
              <View pointerEvents="none" style={{
                position: "absolute",
                left: state.striker.pos.x * SCALE,
                top: state.striker.pos.y * SCALE,
                width: Math.hypot(dragOffset.x, dragOffset.y) * SCALE,
                height: 2,
                backgroundColor: "rgba(255,255,255,0.35)",
                transform: [{ rotate: `${Math.atan2(dragOffset.y, dragOffset.x)}rad` }],
                transformOrigin: "0% 50%",
              }} />
              {/* Shooting line (solid, opposite direction = where striker GOES) */}
              <View pointerEvents="none" style={{
                position: "absolute",
                left: state.striker.pos.x * SCALE,
                top: state.striker.pos.y * SCALE,
                width: power * 140,
                height: 4,
                backgroundColor: power > 0.75 ? "#FF5C5C" : power > 0.4 ? "#FFB147" : FUTURISTIC.brand,
                borderRadius: 2,
                transform: [{ rotate: `${aimAngle}rad` }],
                transformOrigin: "0% 50%",
              }} />
              {/* Arrowhead — small triangle at the tip of the shooting line */}
              <View pointerEvents="none" style={{
                position: "absolute",
                left: state.striker.pos.x * SCALE + Math.cos(aimAngle) * power * 140 - 6,
                top: state.striker.pos.y * SCALE + Math.sin(aimAngle) * power * 140 - 6,
                width: 12, height: 12, borderRadius: 6,
                backgroundColor: power > 0.75 ? "#FF5C5C" : power > 0.4 ? "#FFB147" : FUTURISTIC.brand,
                borderWidth: 2, borderColor: "#fff",
              }} />
            </>
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

      {/* ── Pre-match countdown (3·2·1·GO) ── */}
      {counting && <Countdown onDone={() => setCounting(false)} />}

      {/* ── Unified end-of-match screen ── */}
      {state.phase === "game_over" && (
        <GameResultOverlay
          outcome={state.winner === "draw" ? "draw" : state.winner === "player1" ? "win" : "loss"}
          record={result}
          score={{
            you: state.scores.player1,
            opp: state.scores.player2,
            youLabel: user?.nickname || (t("you") || "أنت"),
            oppLabel: `🤖 ${t("bot") || "Bot"}`,
          }}
          onPlayAgain={reset}
          onExit={exitGame}
        />
      )}

      {/* In-game comms: opponent chat + friends + mic */}
      <GameCommsBar opponentName={`🤖 ${t("bot") || "Bot"}`} />
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
  vsBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  playerCard: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    minHeight: 56,
  },
  playerCardActive: {
    borderColor: FUTURISTIC.brand,
    backgroundColor: FUTURISTIC.brand + "10",
  },
  playerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: FUTURISTIC.surface2 },
  playerAvatarActive: {
    borderWidth: 2,
    borderColor: FUTURISTIC.brand,
  },
  botAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: FUTURISTIC.surface2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  playerName: { color: FUTURISTIC.textPrimary, fontSize: 12, fontWeight: "800", maxWidth: 110 },
  playerScore: { color: FUTURISTIC.brand, fontSize: 22, fontWeight: "900", marginTop: 2 },
  vsCenter: { alignItems: "center", gap: 4 },
  vsText: {
    color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "900",
    letterSpacing: 1.6,
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
    borderRadius: 6, borderWidth: 8, borderColor: "#6B4F2E",
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

  // ── Result overlay ──
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    zIndex: 50, paddingHorizontal: 28,
  },
  resultCard: {
    width: "100%", maxWidth: 360,
    backgroundColor: FUTURISTIC.surface1,
    borderRadius: 24, borderWidth: 1.5,
    paddingVertical: 28, paddingHorizontal: 24,
    alignItems: "center", gap: 14,
    shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  resultIcon: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: "center", justifyContent: "center", borderWidth: 2,
  },
  resultTitle: { fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  resultScoreRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 20, marginVertical: 4,
  },
  resultScoreCol: { alignItems: "center", minWidth: 90 },
  resultScoreLabel: { color: FUTURISTIC.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  resultScoreVal: { fontSize: 34, fontWeight: "900" },
  resultScoreDash: { color: FUTURISTIC.textMuted, fontSize: 24, fontWeight: "900" },
  resultBtns: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  resultBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  resultBtnGhost: { borderWidth: 1, borderColor: FUTURISTIC.border, backgroundColor: "transparent" },
  resultBtnText: { fontSize: 14, fontWeight: "800" },
});
