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
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Dimensions } from "react-native";
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
import GameResultOverlay from "@/src/games/shared/ui/GameResultOverlay";
import Countdown from "@/src/games/shared/ui/Countdown";
import { recordResult, RecordResult } from "@/src/games/stats";
import { playSound } from "@/src/games/sound/SoundManager";

const { width: SCREEN_W } = Dimensions.get("window");
const DIFF_KEY = "damma_bot_difficulty";
const TURN_SECONDS = 60;
const ME: PlayerId = "player1";

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
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [counting, setCounting] = useState(true);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [difficulty, setDifficulty] = useState<DammaDifficulty>("medium");
  const [showDiffPicker, setShowDiffPicker] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_SECONDS);
  const recordedRef = useRef(false);
  const lastTurnRef = useRef<PlayerId>(state.turn);

  const isMyTurn = state.turn === ME;
  const options = useMemo(() => getPlayerOptions(state, ME), [state]);

  // ── Persisted difficulty ───────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(DIFF_KEY).then((v) => {
      if (v === "easy" || v === "medium" || v === "hard") setDifficulty(v);
    }).catch(() => {});
  }, []);
  const pickDifficulty = useCallback((d: DammaDifficulty) => {
    setDifficulty(d);
    AsyncStorage.setItem(DIFF_KEY, d).catch(() => {});
    setShowDiffPicker(false);
  }, []);

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
      // try again with the drawn tile
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
    if (!selectedTile || !isMyTurn) return;
    const next = playDomino(state, ME, selectedTile, side);
    if (next) {
      playSound("domino_move");
      setSelectedTile(null);
      setState(advanceAI(next));
    }
  }, [selectedTile, isMyTurn, state, advanceAI]);

  const handleDraw = () => {
    if (!isMyTurn || !options.mustDraw) return;
    const next = drawFromBoneyard(state, ME);
    if (next) setState(next);
  };

  const handlePass = () => {
    if (!isMyTurn || !options.mustPass) return;
    setState(advanceAI(passTurn(state, ME)));
  };

  const reset = () => {
    setState(createInitialState(2));
    setSelectedTile(null);
    setResult(null);
    recordedRef.current = false;
    setCounting(true);
    setTurnTimeLeft(TURN_SECONDS);
  };

  // Auto-run bot if it's the bot's turn after countdown / a player move.
  useEffect(() => {
    if (counting || state.phase !== "playing" || state.turn === ME) return;
    const id = setTimeout(() => setState((s) => advanceAI(s)), 600);
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
            const next = playDomino(state, ME, tile.id, side);
            if (next) {
              playSound("domino_move");
              setSelectedTile(null);
              setState(advanceAI(next));
              return TURN_SECONDS;
            }
          } else if (opts.mustDraw) {
            const next = drawFromBoneyard(state, ME);
            if (next) setState(next);
            return TURN_SECONDS;
          } else {
            setState(advanceAI(passTurn(state, ME)));
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
      {/* Themed background */}
      <LinearGradient colors={bg} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_damma") || "Damma"}</Text>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity onPress={() => setShowDiffPicker(true)} style={styles.iconBtn}>
            <Ionicons name="hardware-chip-outline" size={22} color={diffMeta.color} />
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} style={styles.iconBtn}>
            <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scores + Turn timer */}
      <View style={styles.scoreBar}>
        <View style={[styles.scoreBox, isMyTurn && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>{t("you") || "You"}</Text>
          <Text style={styles.scoreVal}>{state.scores.player1}</Text>
        </View>

        {/* Turn timer — visible during the human's turn so the player sees the
            countdown. We show a static "—" during the bot's turn. */}
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

        <View style={[styles.scoreBox, !isMyTurn && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>🤖 {diffMeta.label}</Text>
          <Text style={styles.scoreVal}>{state.scores.player2}</Text>
        </View>
      </View>

      {/* Opponent hand (face down) */}
      <View style={styles.oppHand}>
        {state.hands.player2.map((_, i) => (
          <LinearGradient
            key={i}
            colors={[pal.railLight, pal.rail]}
            style={styles.tileBack}
          />
        ))}
      </View>

      {/* Felt table + Boneyard side-pile */}
      <View style={styles.tableRow}>
        <View style={[styles.tableWrap, { shadowColor: pal.glow }]}>
          <LinearGradient
            colors={[pal.feltCenter, pal.feltEdge]}
            start={{ x: 0.3, y: 0.1 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.table, { borderColor: pal.rail }]}
          >
            {/* Inner stitched bevel */}
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

        {/* Dedicated Boneyard pile (always visible count + tap to draw) */}
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
      </View>

      {/* Play side buttons (when a tile is selected) */}
      {selectedTile && isMyTurn && state.board.length > 0 && (
        <View style={styles.sideButtons}>
          {playableSides.includes("left") && (
            <TouchableOpacity style={styles.sideBtn} onPress={() => handlePlay("left")} activeOpacity={0.9}>
              <Ionicons name="arrow-back" size={18} color={FUTURISTIC.bg} />
              <Text style={styles.sideBtnText}>{t("left") || "يسار"}</Text>
            </TouchableOpacity>
          )}
          {playableSides.includes("right") && (
            <TouchableOpacity style={styles.sideBtn} onPress={() => handlePlay("right")} activeOpacity={0.9}>
              <Text style={styles.sideBtnText}>{t("right") || "يمين"}</Text>
              <Ionicons name="arrow-forward" size={18} color={FUTURISTIC.bg} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* My hand */}
      <View style={[styles.myHandArea, { backgroundColor: FUTURISTIC.surface1, borderTopColor: FUTURISTIC.borderSoft }]}>
        <Text style={styles.turnText}>
          {isMyTurn ? (t("your_turn") || "دورك") : (t("opponent_turn") || "دور الخصم")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
          {state.hands[ME].map((d) => {
            const playable = isMyTurn && options.playableTiles.some((p) => p.id === d.id);
            const dimmed = isMyTurn && !playable && state.board.length > 0;
            return (
              <View key={d.id} style={dimmed ? { opacity: 0.45 } : undefined}>
                <DominoTile
                  domino={d}
                  pal={pal}
                  selected={selectedTile === d.id}
                  onPress={() => {
                    if (!isMyTurn || counting) return;
                    if (state.board.length === 0) {
                      const next = playDomino(state, ME, d.id, "left");
                      if (next) { playSound("domino_move"); setState(advanceAI(next)); }
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

      {/* Difficulty picker modal */}
      <Modal visible={showDiffPicker} transparent animationType="fade" onRequestClose={() => setShowDiffPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDiffPicker(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>🤖 صعوبة البوت</Text>
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
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "800" },

  scoreBar: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, paddingVertical: 8 },
  scoreBox: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 12, backgroundColor: FUTURISTIC.surface1, borderWidth: 1, borderColor: FUTURISTIC.borderSoft, alignItems: "center", minWidth: 100 },
  scoreActive: { borderColor: FUTURISTIC.brand, backgroundColor: withAlpha(FUTURISTIC.brand, 0.08) },
  scoreLabel: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "700" },
  scoreVal: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "900" },

  timerBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1, borderColor: FUTURISTIC.brandEdge, minWidth: 70, justifyContent: "center",
  },
  timerWarn: { borderColor: "#FF5C5C", backgroundColor: "#FF5C5C15" },
  timerText: { color: FUTURISTIC.brand, fontWeight: "900", fontSize: 14 },

  oppHand: { flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 10, flexWrap: "wrap" },
  tileBack: { width: 22, height: 40, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  // ── Table row (felt + boneyard) ────────────────────────────────────────────
  tableRow: { flex: 1, flexDirection: "row", marginHorizontal: 8, marginVertical: 4, gap: 6 },
  tableWrap: { flex: 1, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  table: { flex: 1, borderRadius: 18, borderWidth: 8, paddingVertical: 10, paddingHorizontal: 8, overflow: "hidden" },
  tableInlay: { margin: 4, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  tableGlow: { position: "absolute", top: -40, left: -40, width: 180, height: 180, borderRadius: 999, opacity: 0.8 },
  tableGlowB: { position: "absolute", bottom: -50, right: -50, width: 200, height: 200, borderRadius: 999 },
  endsLabel: { fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 6 },

  // Board chain layout (snake-wrap)
  boardWrap: { paddingVertical: 8, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  boardRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 2 },
  emptyBoard: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic" },

  // ── Boneyard pile ──────────────────────────────────────────────────────────
  boneyard: {
    width: 70, alignItems: "center", justifyContent: "flex-start",
    paddingTop: 18, gap: 4,
  },
  boneyardLabel: {
    color: FUTURISTIC.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1,
  },
  boneyardPile: {
    width: 56, height: 78,
    borderRadius: 8, borderWidth: 2, padding: 0,
    alignItems: "center", justifyContent: "center",
    shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    position: "relative",
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
    backgroundColor: FUTURISTIC.brand,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2, borderColor: FUTURISTIC.bg,
  },
  boneyardCount: { color: FUTURISTIC.bg, fontSize: 11, fontWeight: "900" },
  boneyardHint: { color: FUTURISTIC.brand, fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 4 },

  // Tiles
  tile: {
    padding: 2, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 1, height: 2 },
  },
  tileInner: { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "space-around", paddingVertical: 3 },
  tileInnerH: { flexDirection: "row", paddingVertical: 0, paddingHorizontal: 3 },
  dividerH: { width: "62%", height: 1.5, borderRadius: 1 },
  dividerV: { height: "62%", width: 1.5, borderRadius: 1 },
  pipFace: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  pipCell: { width: "33.33%", height: "33.33%", alignItems: "center", justifyContent: "center" },

  sideButtons: { flexDirection: "row", justifyContent: "center", gap: 12, paddingVertical: 8 },
  sideBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: FUTURISTIC.brand, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  sideBtnText: { color: FUTURISTIC.bg, fontWeight: "800", fontSize: 14 },

  myHandArea: { paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1 },
  turnText: { color: FUTURISTIC.textPrimary, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  handScroll: { gap: 6, paddingHorizontal: 8, paddingTop: 12, alignItems: "flex-end", minHeight: 90 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: FUTURISTIC.brand, marginTop: 12, marginHorizontal: 40, paddingVertical: 12, borderRadius: 12 },
  actionText: { color: FUTURISTIC.bg, fontWeight: "800", fontSize: 14 },

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
});
