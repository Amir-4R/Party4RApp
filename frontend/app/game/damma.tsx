// =============================================================================
// app/game/damma.tsx — Playable Damma (Dominoes) Screen (PRO — v2)
// =============================================================================
// New in v2 (per UX brief):
//   1) Responsive board — tiles auto-scale as the chain grows, snake-wrap on
//      narrow screens, never overlap the UI.
//   2) Dedicated draw-pile (boneyard) widget with always-visible count.
//   3) AI bot with 3 difficulty levels (easy / medium / hard) — picker modal.
//   4) Professional themed felt table with stitched bevel & ambient lighting.
//   5) 60-second per-turn timer with auto-action on timeout.
// All existing flows (engine, sound, stats, result overlay, countdown) intact.
// =============================================================================
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Animated, Easing, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  createInitialState, playDomino, drawFromBoneyard, passTurn,
  getPlayerOptions, getPlayableSides,
  DammaState, Domino, PlayerId,
} from "@/src/games/damma/engine";
import { pickDammaMove, DammaDifficulty } from "@/src/games/damma/ai";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useTheme } from "@/src/context/ThemeContext";
import { dammaPalette, gameBackground, withAlpha } from "@/src/games/shared/gameTheme";
import { useT } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { getAvatarUrl } from "@/src/constants/avatars";
import GameResultOverlay from "@/src/games/shared/ui/GameResultOverlay";
import Countdown from "@/src/games/shared/ui/Countdown";
import { recordResult, RecordResult } from "@/src/games/stats";
import { playSound } from "@/src/games/sound/SoundManager";

// ── Refactored sub-components (UI only) ─────────────────────────────────────
import DominoTile from "@/src/games/damma/components/DominoTile";
import PlayerCard from "@/src/games/damma/components/PlayerCard";
import BoneyardPanel from "@/src/games/damma/components/BoneyardPanel";
import WoodenTable from "@/src/games/damma/components/WoodenTable";
import HandTray from "@/src/games/damma/components/HandTray";
import { GOLD } from "@/src/games/damma/components/theme";
import { DAMMA_TEXTURES } from "@/src/games/damma/components/assets";

const DIFF_KEY = "damma_bot_difficulty";
const MODE_KEY = "damma_player_count";
const TURN_SECONDS = 60;
const BOT_THINK_MS = 5000;        // ← Bot thinks for 5 s before playing.
const PLAY_ANIM_MS = 450;         // ← Tile slide animation duration (300–600 ms).
const ME: PlayerId = "player1";

// (PipFace + DominoTile now live in /app/frontend/src/games/damma/components/)

// ── Difficulty options ───────────────────────────────────────────────────────
const DIFF_OPTIONS: { id: DammaDifficulty; label: string; emoji: string; hint: string; color: string }[] = [
  { id: "easy",   label: "سهل",   emoji: "🌱", hint: "حركات شبه عشوائية — مناسب للمبتدئين", color: "#4ADE80" },
  { id: "medium", label: "متوسط", emoji: "🔥", hint: "يفضل التخلص من القطع الثقيلة ويحافظ على الدبل", color: "#F59E0B" },
  { id: "hard",   label: "صعب",   emoji: "💀", hint: "تحليل أعمق + محاولة حظر الخصم بأطراف نادرة",   color: "#EF4444" },
];

export default function DammaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { user } = useAuth();
  const { themeId } = useTheme();
  const pal = dammaPalette();
  const bg = gameBackground(themeId);

  const [state, setState] = useState<DammaState>(() => createInitialState(2));
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [showModePicker, setShowModePicker] = useState(false);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [counting, setCounting] = useState(true);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [difficulty, setDifficulty] = useState<DammaDifficulty>("medium");
  const [showDiffPicker, setShowDiffPicker] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_SECONDS);
  // ── Animation: a tile currently sliding from origin → target.
  // While `flying` is set, the move is NOT yet committed to engine state.
  const [flying, setFlying] = useState<{ domino: Domino; side: "left" | "right" } | null>(null);
  // ── Bot thinking indicator (shows for BOT_THINK_MS before the bot plays).
  const [botThinking, setBotThinking] = useState(false);
  const recordedRef = useRef(false);
  const lastTurnRef = useRef<PlayerId>(state.turn);
  const flyAnim = useRef(new Animated.Value(0)).current;

  const isMyTurn = state.turn === ME;
  const options = useMemo(() => getPlayerOptions(state, ME), [state]);

  // ── Persisted difficulty + player count ────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(DIFF_KEY).then((v) => {
      if (v === "easy" || v === "medium" || v === "hard") setDifficulty(v);
    }).catch(() => {});
    AsyncStorage.getItem(MODE_KEY).then((v) => {
      if (v === "4") {
        setPlayerCount(4);
        setState(createInitialState(4));
      }
    }).catch(() => {});
  }, []);
  const pickDifficulty = useCallback((d: DammaDifficulty) => {
    setDifficulty(d);
    AsyncStorage.setItem(DIFF_KEY, d).catch(() => {});
    setShowDiffPicker(false);
  }, []);
  const pickMode = useCallback((n: 2 | 4) => {
    setPlayerCount(n);
    AsyncStorage.setItem(MODE_KEY, String(n)).catch(() => {});
    setState(createInitialState(n));
    setSelectedTile(null);
    setTurnTimeLeft(TURN_SECONDS);
    setShowModePicker(false);
    setCounting(true);
    recordedRef.current = false;
    setResult(null);
  }, []);

  // ── Animated tile-play helper ──────────────────────────────────────────────
  // Starts the slide animation, then commits the move once the animation
  // finishes. This is shared by manual taps, side buttons, and the timeout
  // auto-action.
  const animateAndPlay = useCallback((dominoId: string, side: "left" | "right") => {
    const tile = state.hands[ME].find((d) => d.id === dominoId);
    if (!tile) return;
    setFlying({ domino: tile, side });
    flyAnim.setValue(0);
    Animated.timing(flyAnim, {
      toValue: 1,
      duration: PLAY_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      const next = playDomino(state, ME, dominoId, side);
      setFlying(null);
      if (next) {
        playSound("domino_move");
        setSelectedTile(null);
        setState(next); // ← bot scheduling is handled by useEffect below
      }
    });
  }, [state, flyAnim]);

  // ── AI move (uses the difficulty-aware planner) ────────────────────────────
  const playAITurn = useCallback((s: DammaState): DammaState => {
    if (s.turn === ME || s.phase !== "playing") return s;
    const plan = pickDammaMove(s, s.turn, difficulty);
    if (plan.kind === "play" && plan.tileId && plan.side) {
      return playDomino(s, s.turn, plan.tileId, plan.side) || s;
    }
    if (plan.kind === "draw") {
      const after = drawFromBoneyard(s, s.turn);
      if (!after) return passTurn(s, s.turn);
      return playAITurn(after);
    }
    return passTurn(s, s.turn);
  }, [difficulty]);

  // Cascade AI turns until the human plays or the game ends.
  const advanceAI = useCallback((s: DammaState): DammaState => {
    let cur = s;
    let guard = 0;
    while (cur.turn !== ME && cur.phase === "playing" && guard < 40) {
      cur = playAITurn(cur);
      guard++;
    }
    return cur;
  }, [playAITurn]);

  // ── Player actions ─────────────────────────────────────────────────────────
  const handlePlay = useCallback((side: "left" | "right") => {
    if (!selectedTile || !isMyTurn || flying) return;
    animateAndPlay(selectedTile, side);
  }, [selectedTile, isMyTurn, flying, animateAndPlay]);

  const handleDraw = () => {
    if (!isMyTurn || !options.mustDraw) return;
    const next = drawFromBoneyard(state, ME);
    if (next) setState(next);
  };

  const handlePass = () => {
    if (!isMyTurn || !options.mustPass) return;
    setState(passTurn(state, ME));
  };

  const reset = () => {
    setState(createInitialState(playerCount));
    setSelectedTile(null);
    setResult(null);
    recordedRef.current = false;
    setCounting(true);
    setTurnTimeLeft(TURN_SECONDS);
  };

  // Auto-run bot if it's the bot's turn. We now wait 5 seconds and show a
  // visible "Thinking..." indicator before the bot actually plays.
  useEffect(() => {
    if (counting || state.phase !== "playing" || state.turn === ME) {
      setBotThinking(false);
      return;
    }
    setBotThinking(true);
    const id = setTimeout(() => {
      setBotThinking(false);
      setState((s) => advanceAI(s));
    }, BOT_THINK_MS);
    return () => clearTimeout(id);
  }, [counting, state.phase, state.turn, advanceAI]);

  // Record finished match into stats/rank system (once).
  useEffect(() => {
    if (state.phase !== "game_over" || recordedRef.current) return;
    recordedRef.current = true;
    const outcome = state.winner === ME ? "win" : "loss";
    recordResult(user?.id || "guest", "damma", outcome).then(setResult).catch(() => {});
  }, [state.phase, state.winner, user]);

  // ── 60s per-turn timer ─────────────────────────────────────────────────────
  // Reset whenever the turn changes; tick down once per second; on hitting 0
  // perform an auto-action (play first valid tile → else draw → else pass).
  useEffect(() => {
    if (counting || state.phase !== "playing") return;
    if (lastTurnRef.current !== state.turn) {
      lastTurnRef.current = state.turn;
      setTurnTimeLeft(TURN_SECONDS);
    }
  }, [state.turn, state.phase, counting]);

  useEffect(() => {
    if (counting || state.phase !== "playing") return;
    if (!isMyTurn) return; // only tick the human's turn (bot is instant)
    if (turnTimeLeft <= 0) return;
    const id = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-action on timeout
          const opts = getPlayerOptions(state, ME);
          if (opts.playableTiles.length > 0) {
            const tile = opts.playableTiles[0];
            const side = getPlayableSides(state, tile)[0];
            animateAndPlay(tile.id, side);
            return TURN_SECONDS;
          } else if (opts.mustDraw) {
            const next = drawFromBoneyard(state, ME);
            if (next) setState(next);
            return TURN_SECONDS;
          } else {
            setState(passTurn(state, ME));
            return TURN_SECONDS;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [counting, state, isMyTurn, turnTimeLeft, advanceAI]);

  // ── Chain layout is now OWNED by WoodenTable ────────────────────────────
  // The board component measures its own playable felt area and does the
  // snake-wrap + scaling internally. damma.tsx just hands it the raw board.

  // (countdown removed for diff brevity — present below)

  const selectedDomino = state.hands[ME].find((d) => d.id === selectedTile);
  const playableSides = selectedDomino ? getPlayableSides(state, selectedDomino) : [];
  const gameOver = state.phase === "game_over";
  const won = state.winner === ME;
  const diffMeta = DIFF_OPTIONS.find((o) => o.id === difficulty)!;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Premium dark luxury backdrop (UI only) ─────────────────────────
          Layered: deep charcoal base + soft brand-tinted radial glow at
          top-center + edge vignette. No image asset → lightweight. */}
      <LinearGradient
        colors={["#0B0F0C", "#06080A", "#000000"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.bgRadialGlow} />
      <View pointerEvents="none" style={styles.bgVignetteTop} />
      <View pointerEvents="none" style={styles.bgVignetteBottom} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="damma-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        {/* Premium centered title pill with gold filigree (real generated ornament asset) */}
        <View style={styles.titleWrap}>
          <Image
            source={DAMMA_TEXTURES.ornament}
            style={[styles.titleOrnamentImg, { transform: [{ scaleX: -1 }] }]}
            resizeMode="contain"
          />
          <View style={{ alignItems: "center" }}>
            <Text style={styles.titleArabic}>ضمنة</Text>
            <Text style={styles.titleSubtitle}>Classic Game</Text>
          </View>
          <Image
            source={DAMMA_TEXTURES.ornament}
            style={styles.titleOrnamentImg}
            resizeMode="contain"
          />
        </View>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity testID="damma-lobby-link" onPress={() => router.push("/game/damma-lobby")} style={styles.iconBtn}>
            <Ionicons name="people-circle-outline" size={24} color={GOLD} />
          </TouchableOpacity>
          <TouchableOpacity testID="damma-mode-picker" onPress={() => setShowModePicker(true)} style={styles.iconBtn}>
            <Ionicons name={playerCount === 4 ? "people" : "person"} size={22} color={GOLD} />
          </TouchableOpacity>
          <TouchableOpacity testID="damma-difficulty-picker" onPress={() => setShowDiffPicker(true)} style={styles.iconBtn}>
            <Ionicons name="hardware-chip-outline" size={22} color={diffMeta.color} />
          </TouchableOpacity>
          <TouchableOpacity testID="damma-reset-btn" onPress={reset} style={styles.iconBtn}>
            <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Compact top status row ────────────────────────────────────────
          A minimal strip with:
            • 1v1 mode → BOT chip on the right.
            • 4P  mode → P3 compact card centered.
          The big ME card has been moved into the HandTray header to free
          up vertical space for the board.                                    */}
      <View style={[styles.scoreBar, playerCount === 4 && styles.scoreBarCompact]}>
        {/* In 4P: P3 (top opposite) chip occupies the centre; in 1v1: empty
            spacer keeps the timer on the right. */}
        {playerCount === 4 && state.hands.player3 ? (
          <View style={{ flex: 1, alignItems: "center" }}>
            <PlayerCard
              testID="damma-player-card-top"
              variant="top"
              name="🤖 لاعب 3"
              score={state.scores.player3 ?? 0}
              tileCount={state.hands.player3.length}
              active={state.turn === "player3"}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* Turn timer (always shown) */}
        <View testID="damma-timer" style={[styles.timerBox, isMyTurn && turnTimeLeft <= 10 && styles.timerWarn]}>
          <Ionicons
            name="time-outline" size={16}
            color={isMyTurn && turnTimeLeft <= 10 ? "#FF5C5C" : FUTURISTIC.brand}
          />
          <Text style={[
            styles.timerText,
            isMyTurn && turnTimeLeft <= 10 && { color: "#FF5C5C" },
          ]}>
            {isMyTurn ? `${turnTimeLeft}s` : "—"}
          </Text>
        </View>

        {/* 1v1 BOT compact chip (replaces the old large BOT card). */}
        {playerCount === 2 && (
          <PlayerCard
            testID="damma-player-card-bot"
            variant="bot"
            name={`🤖 ${diffMeta.label}`}
            score={state.scores.player2}
            iconColor={diffMeta.color}
            active={!isMyTurn}
          />
        )}
      </View>

      {/* (Opponent face-down tile row REMOVED in both modes — was using up
          vertical space without adding gameplay value. Tile counts are now
          shown as badges on each compact player card.) */}

      {/* Table row (4P wraps the table with vertical side indicators). */}
      <View style={styles.tableRow}>
        {playerCount === 4 && (
          <View style={[styles.sideColumn, state.turn === "player2" && styles.sideColumnActive]} testID="damma-player-card-left">
            <Image
              source={{ uri: getAvatarUrl("avatar_robot") }}
              style={[styles.sideColumnAvatar, state.turn === "player2" && styles.sideColumnAvatarActive]}
            />
            <Text style={styles.sideColumnName}>P2</Text>
            <View style={styles.sideColumnBadge}>
              <Ionicons name="apps" size={9} color={GOLD} />
              <Text style={styles.sideColumnBadgeText}>{state.hands.player2?.length ?? 0}</Text>
            </View>
          </View>
        )}

        {/* Wooden frame + green felt + chain (self-measuring) */}
        <WoodenTable
          board={state.board}
          leftEnd={state.leftEnd}
          rightEnd={state.rightEnd}
          pal={pal}
          endsLabel={t("ends") || "Ends"}
          emptyText={t("place_first_tile") || "ضع أول قطعة"}
        />

        {playerCount === 4 && (
          <View style={[styles.sideColumn, state.turn === "player4" && styles.sideColumnActive]} testID="damma-player-card-right">
            <Image
              source={{ uri: getAvatarUrl("avatar_tiger") }}
              style={[styles.sideColumnAvatar, state.turn === "player4" && styles.sideColumnAvatarActive]}
            />
            <Text style={styles.sideColumnName}>P4</Text>
            <View style={styles.sideColumnBadge}>
              <Ionicons name="apps" size={9} color={GOLD} />
              <Text style={styles.sideColumnBadgeText}>{state.hands.player4?.length ?? 0}</Text>
            </View>
          </View>
        )}

        {/* Boneyard pile (extracted) */}
        <BoneyardPanel
          count={state.boneyard.length}
          canDraw={isMyTurn && options.mustDraw}
          onDraw={handleDraw}
          pal={pal}
          label={t("boneyard") || "السحب"}
          hint={t("tap_to_draw") || "اضغط للسحب"}
          emptyLabel="فارغ"
        />
      </View>

      {/* My hand — premium wooden tray (extracted) */}
      <HandTray
        hand={state.hands[ME]}
        playableTiles={options.playableTiles}
        isMyTurn={isMyTurn}
        boardEmpty={state.board.length === 0}
        selectedTileId={selectedTile}
        flyingTileId={flying?.domino.id ?? null}
        botThinking={botThinking}
        mustPass={options.mustPass}
        playableSides={playableSides}
        bottomInset={insets.bottom}
        pal={pal}
        meName={user?.nickname || user?.username || (t("you") || "أنت")}
        meScore={state.scores.player1}
        meAvatarUri={getAvatarUrl(user?.avatar || "avatar_ninja")}
        turnText={isMyTurn ? (t("your_turn") || "دورك") : (t("opponent_turn") || "دور الخصم")}
        thinkingText={t("thinking") || "البوت يفكر..."}
        leftText={t("left") || "يسار"}
        rightText={t("right") || "يمين"}
        passText={t("pass") || "تخطي"}
        onTilePress={(d, playable) => {
          if (!isMyTurn || counting || flying) return;
          if (state.board.length === 0) {
            // First tile: animate it onto the empty board too.
            animateAndPlay(d.id, "left");
          } else if (playable) {
            setSelectedTile(selectedTile === d.id ? null : d.id);
          }
        }}
        onPlay={handlePlay}
        onPass={handlePass}
      />

      {/* ── Flying tile (slides from hand → board) ─────────────────────────── */}
      {flying && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingTile,
            {
              opacity: flyAnim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0.95, 1, 1] }),
              transform: [
                // From the hand row (near bottom of screen, x= ~50% screen) →
                // up into the board (y= screen height * 0.3).
                {
                  translateY: flyAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -260],
                  }),
                },
                {
                  scale: flyAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.12, 0.95],
                  }),
                },
                {
                  rotate: flyAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", flying.side === "left" ? "-6deg" : "6deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <DominoTile domino={flying.domino} horizontal pal={pal} />
        </Animated.View>
      )}

      {/* Difficulty picker modal */}
      <Modal visible={showDiffPicker} transparent animationType="fade" onRequestClose={() => setShowDiffPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDiffPicker(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>            <Text style={styles.modalTitle}>🤖 صعوبة البوت</Text>
            <Text style={styles.modalSubtitle}>اختر مستوى التحدي</Text>
            {DIFF_OPTIONS.map((opt) => {
              const sel = difficulty === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  testID={`damma-diff-${opt.id}`}
                  style={[styles.diffRow, sel && styles.diffRowActive]}
                  onPress={() => pickDifficulty(opt.id)}
                >
                  <Text style={styles.diffEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.diffLabel}>{opt.label}</Text>
                    <Text style={[styles.diffHint, { color: opt.color }]}>{opt.hint}</Text>
                  </View>
                  {sel && <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Mode picker modal (1v1 vs 4-Player) */}
      <Modal visible={showModePicker} transparent animationType="fade" onRequestClose={() => setShowModePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowModePicker(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>🎯 وضع اللعب</Text>
            <Text style={styles.modalSubtitle}>اختر عدد اللاعبين على الطاولة</Text>
            {[
              { id: 2 as const, label: "ثنائي (1 vs 1)", emoji: "👤", hint: "أنت ضد بوت واحد" },
              { id: 4 as const, label: "رباعي (4 لاعبين)", emoji: "👥", hint: "أنت + 3 بوتات حول الطاولة" },
            ].map((opt) => {
              const sel = playerCount === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  testID={`damma-mode-${opt.id}`}
                  style={[styles.diffRow, sel && styles.diffRowActive]}
                  onPress={() => pickMode(opt.id)}
                >
                  <Text style={styles.diffEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.diffLabel}>{opt.label}</Text>
                    <Text style={[styles.diffHint, { color: GOLD }]}>{opt.hint}</Text>
                  </View>
                  {sel && <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {counting && <Countdown onDone={() => setCounting(false)} />}

      {gameOver && (
        <GameResultOverlay
          outcome={won ? "win" : "loss"}
          record={result}
          score={{
            you: state.scores.player1,
            opp: state.scores.player2,
            youLabel: user?.nickname || (t("you") || "أنت"),
            oppLabel: `🤖 ${diffMeta.label}`,
          }}
          onPlayAgain={reset}
          onExit={() => router.back()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  // ── Premium dark luxury background layers ───────────────────────────────
  bgRadialGlow: {
    position: "absolute", top: -120, left: "20%", right: "20%", height: 360,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.04)", // very faint warm gold halo
  },
  bgVignetteTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: 130,
    backgroundColor: "transparent",
    shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: -10 },
  },
  bgVignetteBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 160,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  // ── Header & title ──────────────────────────────────────────────────────
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 34, height: 40, alignItems: "center", justifyContent: "center" },
  titleWrap: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 10,
  },
  titleOrnament: {
    width: 22, height: 2,
    backgroundColor: GOLD,
    borderRadius: 1,
    opacity: 0.8,
  },
  // Gold filigree ornament image (real generated PNG) flanking the title.
  titleOrnamentImg: {
    width: 46, height: 18,
  },
  titleArabic: {
    color: GOLD, fontSize: 20, fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: "rgba(212,175,55,0.55)",
    textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  titleSubtitle: {
    color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "700",
    letterSpacing: 1, marginTop: 3,
  },

  // ── Score-bar row (parent layout only — PlayerCard owns its visuals) ────
  scoreBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  // 4-Player variant: slimmer (no bot-card on the right, so use less vertical chrome)
  scoreBarCompact: { paddingVertical: 4 },
  timerBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.4), minWidth: 70, justifyContent: "center",
  },
  timerWarn: { borderColor: "#FF5C5C", backgroundColor: "#FF5C5C15" },
  timerText: { color: GOLD, fontWeight: "900", fontSize: 14 },

  // ── Opponent face-down hand row + 4-Player side cards row ───────────────
  oppHand: { flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 6, flexWrap: "wrap" },
  tileBack: { width: 22, height: 40, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  // 4P top player card row — minimal vertical chrome, just enough room.
  topPlayerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 12, paddingTop: 2, paddingBottom: 0,
  },
  sidePlayersRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 10, paddingVertical: 2, gap: 8,
  },

  // Table row container — WoodenTable + BoneyardPanel are siblings here.
  tableRow: { flex: 1, flexDirection: "row", marginHorizontal: 6, marginVertical: 2, gap: 4 },

  // 4-Player: vertical compact column flanking the table (P2 left, P4 right).
  // Replaces the wide horizontal sidePlayerCard so the board can stretch.
  sideColumn: {
    width: 42,
    alignItems: "center", justifyContent: "center",
    paddingVertical: 6, gap: 4,
    borderRadius: 12,
    backgroundColor: "rgba(20,22,28,0.85)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.30),
  },
  sideColumnActive: {
    borderColor: "#4ADE80",
    backgroundColor: "rgba(74,222,128,0.10)",
  },
  sideColumnAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#1F2530",
  },
  sideColumnAvatarActive: {
    borderWidth: 2, borderColor: "#4ADE80",
  },
  sideColumnName: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  sideColumnBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: withAlpha(GOLD, 0.18),
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.45),
  },
  sideColumnBadgeText: { color: GOLD, fontSize: 9, fontWeight: "900" },

  // Flying tile (slides from hand → board)
  flyingTile: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    left: "50%",
    marginLeft: -36,
    zIndex: 100,
    elevation: 12,
  },

  // ── Modals (Difficulty & Mode pickers) ──────────────────────────────────
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  modalCard: {
    width: "100%", maxWidth: 360,
    backgroundColor: "#1A1B22",
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "#2A2C36",
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  modalSubtitle: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginBottom: 14 },
  diffRow: {
    flexDirection: "row", alignItems: "center",
    padding: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
    borderWidth: 1, borderColor: "transparent",
  },
  diffRowActive: {
    backgroundColor: "rgba(74,222,128,0.10)",
    borderColor: "rgba(74,222,128,0.40)",
  },
  diffEmoji: { fontSize: 30, marginRight: 12 },
  diffLabel: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  diffHint: { fontSize: 12, marginTop: 2 },
});
