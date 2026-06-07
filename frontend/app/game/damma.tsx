// =============================================================================
// app/game/damma.tsx — Playable Damma (Dominoes) Screen
// =============================================================================
import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createInitialState, playDomino, drawFromBoneyard, passTurn,
  getPlayerOptions, getPlayableSides,
  DammaState, Domino,
} from "@/src/games/damma/engine";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

// Pip dots renderer for a domino half
function Pips({ value }: { value: number }) {
  return (
    <View style={styles.pipHalf}>
      <Text style={styles.pipText}>{value}</Text>
    </View>
  );
}

function DominoTile({ domino, onPress, selected, horizontal }: {
  domino: Domino; onPress?: () => void; selected?: boolean; horizontal?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.tile,
        horizontal && styles.tileHorizontal,
        selected && styles.tileSelected,
      ]}
    >
      <Pips value={domino.left} />
      <View style={styles.tileDivider} />
      <Pips value={domino.right} />
    </TouchableOpacity>
  );
}

export default function DammaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const [state, setState] = useState<DammaState>(() => createInitialState(2));
  const [selectedTile, setSelectedTile] = useState<string | null>(null);

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
    while (cur.turn !== me && cur.phase === "playing" && guard < 20) {
      cur = playAITurn(cur);
      guard++;
    }
    return cur;
  }, [playAITurn]);

  const handlePlay = useCallback((side: "left" | "right") => {
    if (!selectedTile || !isMyTurn) return;
    const next = playDomino(state, me, selectedTile, side);
    if (next) {
      setSelectedTile(null);
      const afterAI = advanceAI(next);
      setState(afterAI);
      checkGameOver(afterAI);
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
    const afterAI = advanceAI(next);
    setState(afterAI);
    checkGameOver(afterAI);
  };

  const checkGameOver = (s: DammaState) => {
    if (s.phase === "game_over") {
      setTimeout(() => Alert.alert(
        t("game_over") || "Game Over",
        s.winner === me ? (t("you_win") || "You win!") : (t("opponent_wins") || "Opponent wins")
      ), 300);
    }
  };

  const reset = () => { setState(createInitialState(2)); setSelectedTile(null); };

  const selectedDomino = state.hands[me].find((d) => d.id === selectedTile);
  const playableSides = selectedDomino ? getPlayableSides(state, selectedDomino) : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
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
          <View key={i} style={styles.tileBack} />
        ))}
      </View>

      {/* Board (played chain) */}
      <View style={styles.boardArea}>
        <Text style={styles.endsLabel}>
          {t("ends") || "Ends"}: {state.leftEnd ?? "—"} / {state.rightEnd ?? "—"}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardScroll}>
          {state.board.length === 0 ? (
            <Text style={styles.emptyBoard}>{t("place_first_tile") || "ضع أول قطعة"}</Text>
          ) : (
            state.board.map((d, i) => (
              <DominoTile key={`${d.id}-${i}`} domino={d} horizontal />
            ))
          )}
        </ScrollView>
      </View>

      {/* Play side buttons (when a tile is selected) */}
      {selectedTile && isMyTurn && state.board.length > 0 && (
        <View style={styles.sideButtons}>
          {playableSides.includes("left") && (
            <TouchableOpacity style={styles.sideBtn} onPress={() => handlePlay("left")}>
              <Ionicons name="arrow-back" size={18} color={FUTURISTIC.bg} />
              <Text style={styles.sideBtnText}>{t("left") || "يسار"}</Text>
            </TouchableOpacity>
          )}
          {playableSides.includes("right") && (
            <TouchableOpacity style={styles.sideBtn} onPress={() => handlePlay("right")}>
              <Text style={styles.sideBtnText}>{t("right") || "يمين"}</Text>
              <Ionicons name="arrow-forward" size={18} color={FUTURISTIC.bg} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* My hand */}
      <View style={styles.myHandArea}>
        <Text style={styles.turnText}>
          {isMyTurn ? (t("your_turn") || "دورك") : (t("opponent_turn") || "دور الخصم")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
          {state.hands[me].map((d) => {
            const playable = isMyTurn && options.playableTiles.some((p) => p.id === d.id);
            return (
              <DominoTile
                key={d.id}
                domino={d}
                selected={selectedTile === d.id}
                onPress={() => {
                  if (state.board.length === 0 && isMyTurn) {
                    const next = playDomino(state, me, d.id, "left");
                    if (next) { const a = advanceAI(next); setState(a); checkGameOver(a); }
                  } else if (playable) {
                    setSelectedTile(selectedTile === d.id ? null : d.id);
                  }
                }}
              />
            );
          })}
        </ScrollView>

        {/* Draw / Pass */}
        {isMyTurn && options.mustDraw && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDraw}>
            <Ionicons name="download-outline" size={18} color={FUTURISTIC.bg} />
            <Text style={styles.actionText}>{t("draw") || "اسحب"} ({state.boneyard.length})</Text>
          </TouchableOpacity>
        )}
        {isMyTurn && options.mustPass && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: FUTURISTIC.textPrimaryMuted }]} onPress={handlePass}>
            <Text style={styles.actionText}>{t("pass") || "تخطي"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "800" },
  scoreBar: { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 8 },
  scoreBox: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 12, backgroundColor: FUTURISTIC.surface1, borderWidth: 1, borderColor: FUTURISTIC.borderSoft, alignItems: "center" },
  scoreActive: { borderColor: FUTURISTIC.brand },
  scoreLabel: { color: FUTURISTIC.textPrimaryMuted, fontSize: 11 },
  scoreVal: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "900" },
  oppHand: { flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 12, flexWrap: "wrap" },
  tileBack: { width: 24, height: 44, borderRadius: 4, backgroundColor: FUTURISTIC.surface2, borderWidth: 1, borderColor: FUTURISTIC.borderSoft },
  boardArea: { flex: 1, paddingHorizontal: 12, paddingVertical: 8 },
  endsLabel: { color: FUTURISTIC.textPrimaryMuted, fontSize: 12, textAlign: "center", marginBottom: 8 },
  boardScroll: { alignItems: "center", paddingVertical: 20, gap: 2, minWidth: "100%", justifyContent: "center" },
  emptyBoard: { color: FUTURISTIC.textPrimaryMuted, fontSize: 14, fontStyle: "italic" },
  tile: { width: 36, height: 68, backgroundColor: "#FBF6E9", borderRadius: 6, borderWidth: 1.5, borderColor: "#A89070", alignItems: "center", justifyContent: "center", padding: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 1, height: 2 } },
  tileHorizontal: { width: 68, height: 36, flexDirection: "row" },
  tileSelected: { borderColor: FUTURISTIC.brand, borderWidth: 2.5, transform: [{ translateY: -8 }], shadowColor: FUTURISTIC.brand, shadowOpacity: 0.7, shadowRadius: 8 },
  tileDivider: { width: "70%", height: 1.5, backgroundColor: "#8B7355", marginVertical: 2 },
  pipHalf: { flex: 1, alignItems: "center", justifyContent: "center" },
  pipText: { fontSize: 18, fontWeight: "900", color: "#2A2A2A", textShadowColor: "rgba(255,255,255,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  sideButtons: { flexDirection: "row", justifyContent: "center", gap: 12, paddingVertical: 8 },
  sideBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: FUTURISTIC.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  sideBtnText: { color: FUTURISTIC.bg, fontWeight: "800", fontSize: 14 },
  myHandArea: { paddingVertical: 12, paddingHorizontal: 8, backgroundColor: FUTURISTIC.surface1, borderTopWidth: 1, borderTopColor: FUTURISTIC.borderSoft },
  turnText: { color: FUTURISTIC.textPrimary, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  handScroll: { gap: 6, paddingHorizontal: 8, alignItems: "flex-end", minHeight: 76 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: FUTURISTIC.brand, marginTop: 12, marginHorizontal: 40, paddingVertical: 12, borderRadius: 12 },
  actionText: { color: FUTURISTIC.bg, fontWeight: "800", fontSize: 14 },
});
