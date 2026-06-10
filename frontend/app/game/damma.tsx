// =============================================================================
// app/game/damma.tsx — Playable Damma (Dominoes) Screen (PRO)
// =============================================================================
// Professional themed table:
//   • Themed felt table + rail derived from the active Party4R theme.
//   • Real domino pip-dot tiles (not plain numbers) for hand, board & opponent.
//   • Themed full-screen background.
//   • In-screen Win/Lose overlay (no system Alert).
// Game logic is unchanged — it uses the existing damma engine as-is.
// =============================================================================
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  createInitialState, playDomino, drawFromBoneyard, passTurn,
  getPlayerOptions, getPlayableSides,
  DammaState, Domino, PlacedDomino,
} from "@/src/games/damma/engine";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useTheme } from "@/src/context/ThemeContext";
import { dammaPalette, gameBackground, withAlpha } from "@/src/games/shared/gameTheme";
import { useT } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import GameResultOverlay from "@/src/games/shared/ui/GameResultOverlay";
import Countdown from "@/src/games/shared/ui/Countdown";
import { recordResult, RecordResult } from "@/src/games/stats";
import { playSound } from "@/src/games/sound/SoundManager";

// ── Pip-dot layouts on a 3×3 grid (true domino faces) ────────────────────────
// Each value maps to which of the 9 grid cells carry a dot.
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
  const dot = Math.max(3, size * 0.16);
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

function DominoTile({
  domino, onPress, selected, horizontal, pal,
}: {
  domino: Domino | PlacedDomino;
  onPress?: () => void;
  selected?: boolean;
  horizontal?: boolean;
  pal: ReturnType<typeof dammaPalette>;
}) {
  const faceSize = horizontal ? 30 : 28;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      style={[
        styles.tile,
        horizontal && styles.tileHorizontal,
        { backgroundColor: pal.tileFace, borderColor: pal.tileBorder },
        selected && { borderColor: FUTURISTIC.brand, borderWidth: 2.5, shadowColor: FUTURISTIC.brand, shadowOpacity: 0.7, shadowRadius: 8, transform: [{ translateY: -10 }] },
      ]}
    >
      <LinearGradient
        colors={[pal.tileFace, pal.tileFaceEdge]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.tileInner, horizontal && styles.tileInnerH]}
      >
        <PipFace value={domino.left} size={faceSize} color={pal.pip} />
        <View style={[horizontal ? styles.dividerV : styles.dividerH, { backgroundColor: pal.divider }]} />
        <PipFace value={domino.right} size={faceSize} color={pal.pip} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

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
  const recordedRef = useRef(false);

  const me = "player1";
  const isMyTurn = state.turn === me;
  const options = useMemo(() => getPlayerOptions(state, me), [state]);

  // Simple AI for opponent (practice mode)
  const playAITurn = useCallback((s: DammaState) => {
    if (s.turn === me || s.phase !== "playing") return s;
    const ai = s.turn;
    const opts = getPlayerOptions(s, ai);
    if (opts.playableTiles.length > 0) {
      const tile = opts.playableTiles[0];
      const sides = getPlayableSides(s, tile);
      const next = playDomino(s, ai, tile.id, sides[0]);
      return next || s;
    } else if (opts.mustDraw) {
      return drawFromBoneyard(s, ai) || s;
    } else {
      return passTurn(s, ai);
    }
  }, []);

  // Advance AI turns until it's my turn again
  const advanceAI = useCallback((s: DammaState) => {
    let cur = s;
    let guard = 0;
    while (cur.turn !== me && cur.phase === "playing" && guard < 40) {
      cur = playAITurn(cur);
      guard++;
    }
    return cur;
  }, [playAITurn]);

  const handlePlay = useCallback((side: "left" | "right") => {
    if (!selectedTile || !isMyTurn) return;
    const next = playDomino(state, me, selectedTile, side);
    if (next) {
      playSound("domino_move");
      setSelectedTile(null);
      setState(advanceAI(next));
    }
  }, [selectedTile, isMyTurn, state, advanceAI]);

  const handleDraw = () => {
    if (!isMyTurn || !options.mustDraw) return;
    const next = drawFromBoneyard(state, me);
    if (next) setState(next);
  };

  const handlePass = () => {
    if (!isMyTurn || !options.mustPass) return;
    const next = passTurn(state, me);
    setState(advanceAI(next));
  };

  const reset = () => {
    setState(createInitialState(2));
    setSelectedTile(null);
    setResult(null);
    recordedRef.current = false;
    setCounting(true);
  };

  // Auto-run the bot's turn(s) — covers the case where the bot is the starter
  // and keeps play flowing without requiring a user action to "kick" the AI.
  useEffect(() => {
    if (counting || state.phase !== "playing" || state.turn === me) return;
    const id = setTimeout(() => setState((s) => advanceAI(s)), 600);
    return () => clearTimeout(id);
  }, [counting, state.phase, state.turn, advanceAI]);

  // Record the finished match into the unified stats/rank system (once).
  useEffect(() => {
    if (state.phase !== "game_over" || recordedRef.current) return;
    recordedRef.current = true;
    const outcome = state.winner === me ? "win" : "loss"; // dominoes has no draw
    recordResult(user?.id || "guest", "damma", outcome).then(setResult).catch(() => {});
  }, [state.phase, state.winner, user]);

  const selectedDomino = state.hands[me].find((d) => d.id === selectedTile);
  const playableSides = selectedDomino ? getPlayableSides(state, selectedDomino) : [];

  const gameOver = state.phase === "game_over";
  const won = state.winner === me;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Themed background */}
      <LinearGradient colors={bg} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_damma") || "Damma"}</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Scores */}
      <View style={styles.scoreBar}>
        <View style={[styles.scoreBox, isMyTurn && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>{t("you") || "You"}</Text>
          <Text style={styles.scoreVal}>{state.scores.player1}</Text>
        </View>
        <View style={[styles.scoreBox, !isMyTurn && styles.scoreActive]}>
          <Text style={styles.scoreLabel}>{t("opponent") || "Opponent"}</Text>
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

      {/* Felt table (played chain) */}
      <View style={[styles.tableWrap, { shadowColor: pal.glow }]}>
        <LinearGradient
          colors={[pal.feltCenter, pal.feltEdge]}
          start={{ x: 0.3, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.table, { borderColor: pal.rail }]}
        >
          {/* inner rail bevel */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tableInlay, { borderColor: withAlpha(pal.railLight, 0.4) }]} />
          <Text style={[styles.endsLabel, { color: withAlpha("#FFFFFF", 0.75) }]}>
            {t("ends") || "Ends"}: {state.leftEnd ?? "—"} / {state.rightEnd ?? "—"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.boardScroll}
          >
            {state.board.length === 0 ? (
              <Text style={styles.emptyBoard}>{t("place_first_tile") || "ضع أول قطعة"}</Text>
            ) : (
              state.board.map((d, i) => (
                <DominoTile key={`${d.id}-${i}`} domino={d} horizontal pal={pal} />
              ))
            )}
          </ScrollView>
        </LinearGradient>
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
          {state.hands[me].map((d) => {
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
                      const next = playDomino(state, me, d.id, "left");
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

        {/* Draw / Pass */}
        {isMyTurn && options.mustDraw && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDraw} activeOpacity={0.9}>
            <Ionicons name="download-outline" size={18} color={FUTURISTIC.bg} />
            <Text style={styles.actionText}>{t("draw") || "اسحب"} ({state.boneyard.length})</Text>
          </TouchableOpacity>
        )}
        {isMyTurn && options.mustPass && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: FUTURISTIC.textMuted }]} onPress={handlePass} activeOpacity={0.9}>
            <Text style={styles.actionText}>{t("pass") || "تخطي"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Pre-match countdown (3·2·1·GO) ── */}
      {counting && <Countdown onDone={() => setCounting(false)} />}

      {/* ── Unified end-of-match screen ── */}
      {gameOver && (
        <GameResultOverlay
          outcome={won ? "win" : "loss"}
          record={result}
          score={{
            you: state.scores.player1,
            opp: state.scores.player2,
            youLabel: user?.nickname || (t("you") || "أنت"),
            oppLabel: `🤖 ${t("opponent") || "الخصم"}`,
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

  scoreBar: { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 8 },
  scoreBox: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 12, backgroundColor: FUTURISTIC.surface1, borderWidth: 1, borderColor: FUTURISTIC.borderSoft, alignItems: "center", minWidth: 110 },
  scoreActive: { borderColor: FUTURISTIC.brand, backgroundColor: withAlpha(FUTURISTIC.brand, 0.08) },
  scoreLabel: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "700" },
  scoreVal: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "900" },

  oppHand: { flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 10, flexWrap: "wrap" },
  tileBack: { width: 22, height: 40, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  // Felt table
  tableWrap: { flex: 1, marginHorizontal: 12, marginVertical: 8, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  table: { flex: 1, borderRadius: 18, borderWidth: 8, paddingVertical: 10, paddingHorizontal: 8, overflow: "hidden" },
  tableInlay: { margin: 4, borderRadius: 12, borderWidth: 1 },
  endsLabel: { fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  boardScroll: { alignItems: "center", paddingVertical: 16, gap: 3, minWidth: "100%", justifyContent: "center" },
  emptyBoard: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic" },

  // Tiles
  tile: { width: 40, height: 72, borderRadius: 8, borderWidth: 1.5, padding: 2, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 1, height: 2 } },
  tileHorizontal: { width: 72, height: 40 },
  tileInner: { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "space-around", borderRadius: 6, paddingVertical: 3 },
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

  // Result overlay
  resultOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 50, paddingHorizontal: 28 },
  resultCard: { width: "100%", maxWidth: 360, backgroundColor: FUTURISTIC.surface1, borderRadius: 24, borderWidth: 1.5, paddingVertical: 28, paddingHorizontal: 24, alignItems: "center", gap: 14, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  resultIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  resultTitle: { fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  resultScoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginVertical: 4 },
  resultScoreCol: { alignItems: "center", minWidth: 90 },
  resultScoreLabel: { color: FUTURISTIC.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  resultScoreVal: { fontSize: 34, fontWeight: "900" },
  resultScoreDash: { color: FUTURISTIC.textMuted, fontSize: 24, fontWeight: "900" },
  resultBtns: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  resultBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  resultBtnGhost: { borderWidth: 1, borderColor: FUTURISTIC.border, backgroundColor: "transparent" },
  resultBtnText: { fontSize: 14, fontWeight: "800" },
});
