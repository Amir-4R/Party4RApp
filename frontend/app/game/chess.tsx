// =============================================================================
// app/game/chess.tsx — Playable Chess Screen
// =============================================================================
import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createInitialState, legalMoves, makeMove, getGameResult,
  GameState, Square, Piece, PieceType,
} from "@/src/games/chess/engine";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

const { width } = Dimensions.get("window");
const BOARD = Math.min(width - 24, 360);
const CELL = BOARD / 8;

// Unicode chess glyphs
const GLYPH: Record<string, string> = {
  "white_k": "♔", "white_q": "♕", "white_r": "♖", "white_b": "♗", "white_n": "♘", "white_p": "♙",
  "black_k": "♚", "black_q": "♛", "black_r": "♜", "black_b": "♝", "black_n": "♞", "black_p": "♟",
};

export default function ChessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const params = useLocalSearchParams<{ mode?: string }>();

  const [state, setState] = useState<GameState>(createInitialState);
  const [selected, setSelected] = useState<Square | null>(null);
  const [highlights, setHighlights] = useState<Square[]>([]);

  const result = useMemo(() => getGameResult(state), [state]);

  const onCellPress = useCallback((row: number, col: number) => {
    const piece = state.board[row][col];

    // If a piece is already selected, try to move
    if (selected) {
      const isLegal = highlights.some((h) => h.row === row && h.col === col);
      if (isLegal) {
        let promotion: PieceType | undefined;
        const movingPiece = state.board[selected.row][selected.col];
        if (movingPiece?.type === "p" && (row === 0 || row === 7)) {
          promotion = "q"; // auto-queen (UI picker can be added)
        }
        const next = makeMove(state, selected, { row, col }, promotion);
        if (next) {
          setState(next);
          const res = getGameResult(next);
          if (res.status === "checkmate") {
            setTimeout(() => Alert.alert(t("checkmate") || "Checkmate!",
              `${res.winner === "white" ? t("white_wins") || "White wins" : t("black_wins") || "Black wins"}`), 300);
          } else if (res.status === "stalemate") {
            setTimeout(() => Alert.alert(t("stalemate") || "Stalemate", t("draw") || "Draw"), 300);
          }
        }
        setSelected(null);
        setHighlights([]);
        return;
      }
      // Reselect or deselect
      if (piece && piece.color === state.turn) {
        setSelected({ row, col });
        setHighlights(legalMoves(state, { row, col }));
      } else {
        setSelected(null);
        setHighlights([]);
      }
      return;
    }

    // Select a piece of the current turn
    if (piece && piece.color === state.turn) {
      setSelected({ row, col });
      setHighlights(legalMoves(state, { row, col }));
    }
  }, [state, selected, highlights, t]);

  const reset = () => {
    setState(createInitialState());
    setSelected(null);
    setHighlights([]);
  };

  const statusText = useMemo(() => {
    if (result.status === "checkmate") return t("checkmate") || "Checkmate";
    if (result.status === "stalemate") return t("stalemate") || "Stalemate";
    if (result.status === "check") return t("check") || "Check!";
    if (result.status === "draw") return t("draw") || "Draw";
    return state.turn === "white" ? (t("white_turn") || "White's turn") : (t("black_turn") || "Black's turn");
  }, [result, state.turn, t]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_chess") || "Chess"}</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={FUTURISTIC.text} />
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={styles.statusBar}>
        <Text style={[styles.statusText, result.status === "check" && { color: "#FF6B6B" }]}>
          {statusText}
        </Text>
      </View>

      {/* Board */}
      <View style={styles.boardWrap}>
        <View style={[styles.board, { width: BOARD, height: BOARD }]}>
          {state.board.map((rowArr, row) =>
            rowArr.map((piece, col) => {
              const isDark = (row + col) % 2 === 1;
              const isSelected = selected?.row === row && selected?.col === col;
              const isHighlight = highlights.some((h) => h.row === row && h.col === col);
              return (
                <TouchableOpacity
                  key={`${row}-${col}`}
                  activeOpacity={0.7}
                  onPress={() => onCellPress(row, col)}
                  style={[
                    styles.cell,
                    { width: CELL, height: CELL, left: col * CELL, top: row * CELL },
                    { backgroundColor: isDark ? "#8B6F47" : "#E8D9B8" },
                    isSelected && { backgroundColor: "#7BAE5C" },
                  ]}
                >
                  {isHighlight && !piece && <View style={styles.dot} />}
                  {isHighlight && piece && <View style={styles.captureRing} />}
                  {piece && (
                    <Text style={[styles.piece, { fontSize: CELL * 0.7 }]}>
                      {GLYPH[`${piece.color}_${piece.type}`]}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      {/* Move count */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t("moves") || "Moves"}: {state.moveHistory.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.text, fontSize: 18, fontWeight: "800" },
  statusBar: { alignItems: "center", paddingVertical: 12 },
  statusText: { color: FUTURISTIC.text, fontSize: 16, fontWeight: "700" },
  boardWrap: { alignItems: "center", marginTop: 12 },
  board: { position: "relative", borderRadius: 8, overflow: "hidden", borderWidth: 2, borderColor: FUTURISTIC.border },
  cell: { position: "absolute", alignItems: "center", justifyContent: "center" },
  piece: { textAlign: "center" },
  dot: { width: CELL * 0.25, height: CELL * 0.25, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)" },
  captureRing: { position: "absolute", width: CELL * 0.9, height: CELL * 0.9, borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,80,80,0.7)" },
  footer: { alignItems: "center", marginTop: 20 },
  footerText: { color: FUTURISTIC.textMuted, fontSize: 13 },
});
