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
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Dimensions, Animated, Image, Easing } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  createInitialState, playDomino, drawFromBoneyard, passTurn,
  getPlayerOptions, getPlayableSides,
  DammaState, Domino, PlacedDomino, PlayerId,
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

const { width: SCREEN_W } = Dimensions.get("window");
const DIFF_KEY = "damma_bot_difficulty";
const MODE_KEY = "damma_player_count";
const TURN_SECONDS = 60;
const BOT_THINK_MS = 5000;        // ← Bot thinks for 5 s before playing.
const PLAY_ANIM_MS = 450;         // ← Tile slide animation duration (300–600 ms).
const ME: PlayerId = "player1";

// Premium gold accent palette
const GOLD = "#D4AF37";
const GOLD_SOFT = "#B8860B";
const GOLD_DARK = "#7A5C18";
const GOLD_GLOW = "rgba(212,175,55,0.35)";

// ── Premium "luxury table" palette (UI only — no engine changes) ─────────────
const WOOD_OUTER  = "#1A0E06";   // deep mahogany outer rim
const WOOD_MID    = "#4A2E16";   // rich walnut frame
const WOOD_LIGHT  = "#6E4520";   // upper highlight on the wood
const WOOD_DARK   = "#1F0E05";   // shadow side of the wood
const FELT_CENTER = "#0E5A2D";   // center of the green felt
const FELT_EDGE   = "#063318";   // outer felt (darker for vignette)
const FELT_DEEP   = "#02180B";   // deepest shadow under the rim

// ── Pip-dot layouts on a 3×3 grid (true domino faces) ────────────────────────
const PIP_MAP: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function PipFace({ value, size, color }: { value: number; size: number; color: string }) {
  const cells = PIP_MAP[value] || [];
  const dot = Math.max(2.5, size * 0.16);
  return (
    <View style={[styles.pipFace, { width: size, height: size }]}>
      {Array.from({ length: 9 }).map((_, i) => (
        <View key={i} style={styles.pipCell}>
          {cells.includes(i) && (
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
          )}
        </View>
      ))}
    </View>
  );
}

// ── Tile renderer — accepts an explicit `scale` so the board can shrink
// the played chain while the hand keeps its standard size. ───────────────────
function DominoTile({
  domino, onPress, selected, horizontal, pal, scale = 1,
}: {
  domino: Domino | PlacedDomino;
  onPress?: () => void;
  selected?: boolean;
  horizontal?: boolean;
  pal: ReturnType<typeof dammaPalette>;
  scale?: number;
}) {
  const W = (horizontal ? 72 : 40) * scale;
  const H = (horizontal ? 40 : 72) * scale;
  const faceSize = (horizontal ? 30 : 28) * scale;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      style={[
        styles.tile,
        {
          width: W, height: H,
          backgroundColor: pal.tileFace, borderColor: pal.tileBorder,
          borderRadius: 8 * scale, borderWidth: Math.max(1, 1.5 * scale),
        },
        selected && {
          borderColor: FUTURISTIC.brand, borderWidth: 2.5,
          shadowColor: FUTURISTIC.brand, shadowOpacity: 0.7, shadowRadius: 8,
          transform: [{ translateY: -10 }],
        },
      ]}
    >
      <LinearGradient
        colors={[pal.tileFace, pal.tileFaceEdge]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.tileInner,
          horizontal && styles.tileInnerH,
          { borderRadius: 6 * scale },
        ]}
      >
        <PipFace value={domino.left} size={faceSize} color={pal.pip} />
        <View style={[
          horizontal ? styles.dividerV : styles.dividerH,
          { backgroundColor: pal.divider, height: horizontal ? "62%" : Math.max(1, 1.5 * scale), width: horizontal ? Math.max(1, 1.5 * scale) : "62%" },
        ]} />
        <PipFace value={domino.right} size={faceSize} color={pal.pip} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

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

  // ── Responsive tile scale for the chain ────────────────────────────────────
  // Reserve some horizontal padding; tiles are ~72px each plus 3px gap.
  // When the chain grows long, shrink linearly until min 0.55× to keep the
  // chain readable while still fitting more tiles per row.
  const chainScale = useMemo(() => {
    const usableW = Math.max(280, SCREEN_W - 56);
    const TILE_W = 72;
    const GAP = 3;
    const need = state.board.length * (TILE_W + GAP);
    if (need <= usableW) return 1;
    // tiles per row at full scale that fit
    const ratio = usableW / need;
    return Math.max(0.55, ratio);
  }, [state.board.length]);

  // Split the board into rows that fit horizontally (snake wrap) when scaled.
  const boardRows = useMemo(() => {
    if (state.board.length === 0) return [] as PlacedDomino[][];
    const tileW = 72 * chainScale + 3;
    const usableW = Math.max(280, SCREEN_W - 56);
    const perRow = Math.max(1, Math.floor(usableW / tileW));
    const rows: PlacedDomino[][] = [];
    for (let i = 0; i < state.board.length; i += perRow) {
      const slice = state.board.slice(i, i + perRow);
      // Snake direction: every other row reversed so the chain flows L→R then R→L
      if (rows.length % 2 === 1) slice.reverse();
      rows.push(slice);
    }
    return rows;
  }, [state.board, chainScale]);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        {/* Premium centered title pill with gold filigree */}
        <View style={styles.titleWrap}>
          <View style={styles.titleOrnament} />
          <Text style={styles.titleArabic}>ضمنة</Text>
          <Text style={styles.titleSubtitle}>Classic Game</Text>
          <View style={styles.titleOrnament} />
        </View>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity onPress={() => router.push("/game/damma-lobby")} style={styles.iconBtn}>
            <Ionicons name="people-circle-outline" size={24} color={GOLD} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowModePicker(true)} style={styles.iconBtn}>
            <Ionicons name={playerCount === 4 ? "people" : "person"} size={22} color={GOLD} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDiffPicker(true)} style={styles.iconBtn}>
            <Ionicons name="hardware-chip-outline" size={22} color={diffMeta.color} />
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} style={styles.iconBtn}>
            <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scores + Turn timer  ── with avatars & usernames for BOTH players */}
      <View style={styles.scoreBar}>
        {/* Player card (you) */}
        <View style={[styles.playerScoreCard, isMyTurn && styles.scoreActive]}>
          <Image
            source={{ uri: getAvatarUrl(user?.avatar || "avatar_ninja") }}
            style={[styles.avatar, isMyTurn && styles.avatarActive]}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.playerName} numberOfLines={1}>
              {user?.nickname || user?.username || (t("you") || "أنت")}
            </Text>
            <Text style={styles.scoreVal}>{state.scores.player1}</Text>
          </View>
        </View>

        {/* Turn timer */}
        <View style={[styles.timerBox, isMyTurn && turnTimeLeft <= 10 && styles.timerWarn]}>
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

        {/* Opponent card (bot) */}
        <View style={[styles.playerScoreCard, !isMyTurn && styles.scoreActive]}>
          <View style={{ flex: 1, marginRight: 8, alignItems: "flex-end" }}>
            <Text style={styles.playerName} numberOfLines={1}>
              🤖 {diffMeta.label}
            </Text>
            <Text style={styles.scoreVal}>{state.scores.player2}</Text>
          </View>
          <View style={[styles.avatar, styles.botAvatarBox, !isMyTurn && styles.avatarActive]}>
            <Ionicons name="hardware-chip" size={22} color={diffMeta.color} />
          </View>
        </View>
      </View>

      {/* Opponent hand (face down) — top player (player2 in 2P, player3 in 4P) */}
      <View style={styles.oppHand}>
        {playerCount === 4 && state.hands.player3 && (
          <View style={styles.topPlayerCard}>
            <View style={[styles.smallAvatar, state.turn === "player3" && styles.smallAvatarActive]}>
              <Ionicons name="hardware-chip" size={18} color={GOLD} />
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.smallPlayerName}>🤖 لاعب 3</Text>
              <Text style={styles.smallScoreVal}>{state.scores.player3 ?? 0}</Text>
            </View>
            <View style={styles.tileCountBadge}>
              <Ionicons name="apps" size={11} color={GOLD} />
              <Text style={styles.tileCountText}>{state.hands.player3.length}</Text>
            </View>
          </View>
        )}
        {playerCount === 2 && state.hands.player2.map((_, i) => (
          <LinearGradient key={i} colors={[pal.railLight, pal.rail]} style={styles.tileBack} />
        ))}
        {playerCount === 4 && state.hands.player3?.map((_, i) => (
          <LinearGradient key={i} colors={[pal.railLight, pal.rail]} style={styles.tileBack} />
        ))}
      </View>

      {/* Side player cards (for 4-player mode) */}
      {playerCount === 4 && (
        <View style={styles.sidePlayersRow}>
          <View style={[styles.sidePlayerCard, state.turn === "player2" && styles.scoreActive]}>
            <View style={[styles.smallAvatar, state.turn === "player2" && styles.smallAvatarActive]}>
              <Ionicons name="hardware-chip" size={18} color={GOLD} />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.smallPlayerName}>🤖 لاعب 2</Text>
              <Text style={styles.smallScoreVal}>{state.scores.player2}</Text>
            </View>
            <View style={styles.tileCountBadge}>
              <Ionicons name="apps" size={10} color={GOLD} />
              <Text style={styles.tileCountText}>{state.hands.player2?.length ?? 0}</Text>
            </View>
          </View>

          <View style={[styles.sidePlayerCard, state.turn === "player4" && styles.scoreActive]}>
            <View style={[styles.smallAvatar, state.turn === "player4" && styles.smallAvatarActive]}>
              <Ionicons name="hardware-chip" size={18} color={GOLD} />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.smallPlayerName}>🤖 لاعب 4</Text>
              <Text style={styles.smallScoreVal}>{state.scores.player4 ?? 0}</Text>
            </View>
            <View style={styles.tileCountBadge}>
              <Ionicons name="apps" size={10} color={GOLD} />
              <Text style={styles.tileCountText}>{state.hands.player4?.length ?? 0}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Table row */}
      <View style={styles.tableRow}>
        {/* Wooden frame outer wrap (UI only — wraps the existing felt) */}
        <LinearGradient
          colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.woodFrame}
        >
          {/* Thin gold inner trim */}
          <View pointerEvents="none" style={styles.woodGoldTrim} />
          <View style={[styles.tableWrap, { shadowColor: pal.glow }]}>
            <LinearGradient
              colors={[FELT_CENTER, FELT_EDGE, FELT_DEEP]}
              start={{ x: 0.3, y: 0.1 }}
              end={{ x: 0.8, y: 1 }}
              style={[styles.table, { borderColor: "transparent" }]}
            >
              {/* Subtle radial felt highlight (fabric look) */}
              <View pointerEvents="none" style={styles.feltHighlight} />
              {/* Inner stitched bevel — keeps the old elegant dashed inlay */}
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tableInlay, { borderColor: withAlpha(pal.railLight, 0.45) }]} />
              {/* Ambient corner glow (top-left) */}
              <View pointerEvents="none" style={[styles.tableGlow, { backgroundColor: withAlpha(pal.glow, 0.18) }]} />
              {/* Ambient corner glow (bottom-right, opposite tint) */}
              <View pointerEvents="none" style={[styles.tableGlowB, { backgroundColor: withAlpha("#000000", 0.15) }]} />

            <Text style={[styles.endsLabel, { color: withAlpha("#FFFFFF", 0.75) }]}>
              {t("ends") || "Ends"}: {state.leftEnd ?? "—"} / {state.rightEnd ?? "—"}
            </Text>

            {state.board.length === 0 ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={styles.emptyBoard}>{t("place_first_tile") || "ضع أول قطعة"}</Text>
              </View>
            ) : (
              // Snake-wrapped, scaled chain — fully responsive
              <ScrollView
                contentContainerStyle={styles.boardWrap}
                showsVerticalScrollIndicator={false}
              >
                {boardRows.map((row, ri) => (
                  <View
                    key={`row-${ri}`}
                    style={[
                      styles.boardRow,
                      { gap: Math.max(2, 3 * chainScale) },
                    ]}
                  >
                    {row.map((d, i) => (
                      <DominoTile
                        key={`${d.id}-${ri}-${i}`}
                        domino={d}
                        horizontal
                        pal={pal}
                        scale={chainScale}
                      />
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
          </LinearGradient>
        </View>
        </LinearGradient>
        {/* end wooden frame wrap */}

        {/* Dedicated Boneyard pile (always visible count + tap to draw) — now wrapped in a premium wooden panel */}
        <LinearGradient
          colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.boneyardWoodFrame}
        >
          <View pointerEvents="none" style={styles.boneyardGoldTrim} />
          <View style={styles.boneyard}>
            <Text style={styles.boneyardLabel}>{t("boneyard") || "السحب"}</Text>
          <TouchableOpacity
            disabled={!isMyTurn || !options.mustDraw}
            onPress={handleDraw}
            activeOpacity={0.85}
            style={[
              styles.boneyardPile,
              {
                borderColor: isMyTurn && options.mustDraw ? FUTURISTIC.brand : withAlpha(pal.railLight, 0.35),
                shadowColor: isMyTurn && options.mustDraw ? FUTURISTIC.brand : "transparent",
              },
            ]}
          >
            {/* Stacked card visual — three offset rectangles */}
            {state.boneyard.length > 0 ? (
              <>
                {state.boneyard.length > 2 && (
                  <LinearGradient
                    colors={[pal.railLight, pal.rail]}
                    style={[styles.boneyardCard, { transform: [{ translateX: -4 }, { translateY: -4 }] }]}
                  />
                )}
                {state.boneyard.length > 1 && (
                  <LinearGradient
                    colors={[pal.railLight, pal.rail]}
                    style={[styles.boneyardCard, { transform: [{ translateX: -2 }, { translateY: -2 }] }]}
                  />
                )}
                <LinearGradient
                  colors={[pal.railLight, pal.rail]}
                  style={styles.boneyardCard}
                >
                  <Ionicons name="apps" size={20} color={withAlpha("#FFFFFF", 0.6)} />
                </LinearGradient>
              </>
            ) : (
              <View style={[styles.boneyardCard, { backgroundColor: "transparent", borderColor: withAlpha(pal.railLight, 0.25), borderWidth: 1, borderStyle: "dashed" }]}>
                <Text style={{ color: withAlpha("#FFFFFF", 0.4), fontSize: 10 }}>فارغ</Text>
              </View>
            )}
            <View style={styles.boneyardBadge}>
              <Text style={styles.boneyardCount}>{state.boneyard.length}</Text>
            </View>
          </TouchableOpacity>
          {isMyTurn && options.mustDraw && (
            <Text style={styles.boneyardHint}>{t("tap_to_draw") || "اضغط للسحب"}</Text>
          )}
        </View>
        </LinearGradient>
        {/* end boneyard wooden frame */}
      </View>

      {/* My hand — premium wooden tray look */}
      <LinearGradient
        colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.handTrayFrame, { paddingBottom: Math.max(8, insets.bottom + 4) }]}
      >
        <View pointerEvents="none" style={styles.handTrayGoldTrim} />
        <View style={styles.myHandArea}>
        {/* Bot "Thinking..." indicator (5-second delay before AI plays) */}
        {botThinking && (
          <View style={styles.thinkingBox}>
            <View style={styles.thinkingDot} />
            <Text style={styles.thinkingText}>🤖 {t("thinking") || "البوت يفكر..."}</Text>
          </View>
        )}

        {/* Play side buttons — kept BELOW the board, well above the hand,
            with generous horizontal gap so they never overlap the chain. */}
        {selectedTile && isMyTurn && state.board.length > 0 && (
          <View style={styles.sideButtons}>
            {playableSides.includes("left") && (
              <TouchableOpacity style={styles.sideBtn} onPress={() => handlePlay("left")} activeOpacity={0.9}>
                <Ionicons name="arrow-back" size={18} color={FUTURISTIC.bg} />
                <Text style={styles.sideBtnText}>{t("left") || "يسار"}</Text>
              </TouchableOpacity>
            )}
            {/* spacer ensures Left & Right never touch each other */}
            <View style={{ width: 24 }} />
            {playableSides.includes("right") && (
              <TouchableOpacity style={styles.sideBtn} onPress={() => handlePlay("right")} activeOpacity={0.9}>
                <Text style={styles.sideBtnText}>{t("right") || "يمين"}</Text>
                <Ionicons name="arrow-forward" size={18} color={FUTURISTIC.bg} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.turnText}>
          {isMyTurn ? (t("your_turn") || "دورك") : (t("opponent_turn") || "دور الخصم")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
          {state.hands[ME].map((d) => {
            const playable = isMyTurn && options.playableTiles.some((p) => p.id === d.id);
            const dimmed = isMyTurn && !playable && state.board.length > 0;
            const isFlying = flying?.domino.id === d.id;
            return (
              <View
                key={d.id}
                style={[
                  dimmed ? { opacity: 0.45 } : undefined,
                  // While this tile is animating to the board hide it from
                  // the hand so the player sees a single flying piece.
                  isFlying ? { opacity: 0 } : undefined,
                ]}
              >
                <DominoTile
                  domino={d}
                  pal={pal}
                  selected={selectedTile === d.id}
                  onPress={() => {
                    if (!isMyTurn || counting || flying) return;
                    if (state.board.length === 0) {
                      // First tile: animate it onto the empty board too.
                      animateAndPlay(d.id, "left");
                    } else if (playable) {
                      setSelectedTile(selectedTile === d.id ? null : d.id);
                    }
                  }}
                />
              </View>
            );
          })}
        </ScrollView>

        {isMyTurn && options.mustPass && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: FUTURISTIC.textMuted }]} onPress={handlePass} activeOpacity={0.9}>
            <Text style={styles.actionText}>{t("pass") || "تخطي"}</Text>
          </TouchableOpacity>
        )}
        </View>
      </LinearGradient>
      {/* end wooden hand tray */}

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
    borderBottomWidth: 0,
    // soft top vignette via shadow
    shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: -10 },
  },
  bgVignetteBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 160,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "800" },

  // ── Premium centered title with gold filigree ────────────────────────────
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

  // ── Score / player cards ─────────────────────────────────────────────────
  scoreBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  playerScoreCard: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.18),
    minHeight: 56,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: FUTURISTIC.surface2 },
  avatarActive: { borderWidth: 2, borderColor: "#4ADE80" },
  botAvatarBox: {
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  playerName: { color: FUTURISTIC.textPrimary, fontSize: 12, fontWeight: "800", maxWidth: 110 },
  scoreBox: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 12, backgroundColor: FUTURISTIC.surface1, borderWidth: 1, borderColor: FUTURISTIC.borderSoft, alignItems: "center", minWidth: 100 },
  // ✅ Active player: rich green glow (you / human turn). Opponent uses a softer gold tint.
  scoreActive: {
    borderColor: "#4ADE80",
    backgroundColor: "rgba(74,222,128,0.08)",
    shadowColor: "#4ADE80", shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  scoreLabel: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "700" },
  scoreVal: { color: GOLD, fontSize: 22, fontWeight: "900", marginTop: 1 },

  timerBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.4), minWidth: 70, justifyContent: "center",
  },
  timerWarn: { borderColor: "#FF5C5C", backgroundColor: "#FF5C5C15" },
  timerText: { color: GOLD, fontWeight: "900", fontSize: 14 },

  oppHand: { flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 10, flexWrap: "wrap" },
  tileBack: { width: 22, height: 40, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  // ── Table row (felt + boneyard) ──────────────────────────────────────────
  tableRow: { flex: 1, flexDirection: "row", marginHorizontal: 8, marginVertical: 4, gap: 6 },

  // Wooden frame around the felt table — gives the premium "real domino table" feel.
  woodFrame: {
    flex: 1,
    borderRadius: 22,
    padding: 10,
    shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    position: "relative",
    overflow: "hidden",
  },
  // Thin gold trim line just inside the wood
  woodGoldTrim: {
    ...StyleSheet.absoluteFillObject,
    margin: 6,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: withAlpha(GOLD, 0.55),
  },

  tableWrap: { flex: 1, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, borderRadius: 14, overflow: "hidden" },
  table: {
    flex: 1, borderRadius: 14,
    borderWidth: 0,
    paddingVertical: 14, paddingHorizontal: 12,
    overflow: "hidden",
  },
  // Soft radial-style highlight overlay on the felt (gives a fabric/light glow)
  feltHighlight: {
    position: "absolute",
    top: -40, left: "10%", right: "10%", height: 240,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 9999,
  },
  tableInlay: { margin: 4, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" },
  tableGlow: { position: "absolute", top: -40, left: -40, width: 180, height: 180, borderRadius: 999, opacity: 0.8 },
  tableGlowB: { position: "absolute", bottom: -50, right: -50, width: 200, height: 200, borderRadius: 999 },
  endsLabel: { fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 6 },

  // Board chain layout (snake-wrap)
  boardWrap: { paddingVertical: 8, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  boardRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 2 },
  emptyBoard: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic" },

  // ── Boneyard pile (now wrapped in its own wooden panel) ─────────────────
  boneyardWoodFrame: {
    width: 84,
    borderRadius: 18,
    padding: 6,
    shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  boneyardGoldTrim: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(GOLD, 0.5),
  },
  boneyard: {
    flex: 1, alignItems: "center", justifyContent: "flex-start",
    paddingTop: 12, gap: 4,
  },
  boneyardLabel: {
    color: GOLD, fontSize: 10, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 1,
  },
  boneyardPile: {
    width: 56, height: 78,
    borderRadius: 8, borderWidth: 2, padding: 0,
    alignItems: "center", justifyContent: "center",
    shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    position: "relative",
    marginTop: 10,
  },
  boneyardCard: {
    position: "absolute",
    width: 48, height: 70,
    borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  boneyardBadge: {
    position: "absolute", top: -8, right: -8,
    minWidth: 24, height: 24, borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2, borderColor: WOOD_DARK,
  },
  boneyardCount: { color: "#1A0E06", fontSize: 11, fontWeight: "900" },
  boneyardHint: { color: GOLD, fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 4 },

  // Tiles
  tile: {
    padding: 2, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 1, height: 2 },
  },
  tileInner: { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "space-around", paddingVertical: 3 },
  tileInnerH: { flexDirection: "row", paddingVertical: 0, paddingHorizontal: 3 },
  dividerH: { width: "62%", height: 1.5, borderRadius: 1 },
  dividerV: { height: "62%", width: 1.5, borderRadius: 1 },
  pipFace: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  pipCell: { width: "33.33%", height: "33.33%", alignItems: "center", justifyContent: "center" },

  // ── Side buttons (Left / Right) — now premium gold pill style ─────────────
  sideButtons: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingTop: 4, paddingBottom: 12,
    marginBottom: 6,
  },
  sideBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: GOLD,
    paddingHorizontal: 26, paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: GOLD_SOFT,
    shadowColor: GOLD, shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  sideBtnText: { color: "#1A0E06", fontWeight: "900", fontSize: 14 },

  // Bot "Thinking…" indicator
  thinkingBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 14, marginHorizontal: 60,
    backgroundColor: withAlpha(GOLD, 0.12),
    borderRadius: 999,
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.4),
    marginBottom: 6,
  },
  thinkingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: GOLD,
  },
  thinkingText: { color: GOLD, fontSize: 12, fontWeight: "800" },

  // Animated flying tile (slides from hand row up to the board area)
  flyingTile: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    left: "50%",
    marginLeft: -36,
    zIndex: 100,
    elevation: 12,
  },

  // ── Wooden hand tray (bottom) ────────────────────────────────────────────
  handTrayFrame: {
    paddingHorizontal: 6, paddingTop: 6,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    overflow: "hidden",
    position: "relative",
  },
  handTrayGoldTrim: {
    position: "absolute", top: 4, left: 4, right: 4, bottom: 4,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1.2,
    borderColor: withAlpha(GOLD, 0.55),
  },
  myHandArea: {
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: "rgba(8,4,2,0.55)",
    borderRadius: 16,
  },
  turnText: { color: GOLD, fontSize: 14, fontWeight: "800", textAlign: "center", marginBottom: 8, letterSpacing: 0.5 },
  handScroll: { gap: 6, paddingHorizontal: 8, paddingTop: 12, alignItems: "flex-end", minHeight: 90 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: GOLD, marginTop: 12, marginHorizontal: 40, paddingVertical: 12, borderRadius: 12 },
  actionText: { color: "#1A0E06", fontWeight: "900", fontSize: 14 },

  // Difficulty picker modal
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

  // ── 4-player layout: side player cards + top player card ───────────────────
  sidePlayersRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 10, paddingVertical: 4, gap: 8,
  },
  sidePlayerCard: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.30),
    minHeight: 44,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4,
  },
  topPlayerCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.30),
    marginBottom: 6,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4,
  },
  smallAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: FUTURISTIC.surface2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
  },
  smallAvatarActive: {
    borderColor: GOLD,
    shadowColor: GOLD, shadowOpacity: 0.6, shadowRadius: 4,
  },
  smallPlayerName: { color: FUTURISTIC.textPrimary, fontSize: 11, fontWeight: "700" },
  smallScoreVal: { color: GOLD, fontSize: 14, fontWeight: "900" },
  tileCountBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: withAlpha(GOLD, 0.12),
    borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.4),
  },
  tileCountText: { color: GOLD, fontSize: 10, fontWeight: "800" },
});
