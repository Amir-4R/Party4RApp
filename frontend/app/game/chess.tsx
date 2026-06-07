// =============================================================================
// app/game/chess.tsx — Playable Chess Screen (SCULPTED REALISTIC PIECES)
// =============================================================================
// Hand-drawn SVG silhouettes (Cburnett-style, public domain) so each piece
// looks carved/sculpted rather than cartoon. Solid ivory/charcoal fills.
// =============================================================================
import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  createInitialState, legalMoves, makeMove, getGameResult,
  GameState, Square, PieceType,
} from "@/src/games/chess/engine";
import ChessPieceSvg from "@/src/games/chess/ChessPieceSvg";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

const { width } = Dimensions.get("window");
const BOARD = Math.min(width - 24, 360);
const CELL = BOARD / 8;

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
    if (selected) {
      const isLegal = highlights.some((h) => h.row === row && h.col === col);
      if (isLegal) {
        let promotion: PieceType | undefined;
        const movingPiece = state.board[selected.row][selected.col];
        if (movingPiece?.type === "p" && (row === 0 || row === 7)) {
          promotion = "q";
        }
        const next = makeMove(state, selected, { row, col }, promotion);
        if (next) {
          setState(next);
          const res = getGameResult(next);
          if (res.status === "checkmate") {
            setTimeout(() => Alert.alert(
              t("checkmate") || "Checkmate!",
              res.winner === "white" ? (t("white_wins") || "White wins") : (t("black_wins") || "Black wins"),
            ), 300);
          } else if (res.status === "stalemate") {
            setTimeout(() => Alert.alert(t("stalemate") || "Stalemate", t("draw") || "Draw"), 300);
          }
        }
        setSelected(null);
        setHighlights([]);
        return;
      }
      if (piece && piece.color === state.turn) {
        setSelected({ row, col });
        setHighlights(legalMoves(state, { row, col }));
      } else {
        setSelected(null);
        setHighlights([]);
      }
      return;
    }
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_chess") || "Chess"}</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <Text style={[styles.statusText, result.status === "check" && { color: "#FF6B6B" }]}>
          {statusText}
        </Text>
      </View>

      <View style={styles.boardWrap}>
        <LinearGradient
          colors={["#3A1F0E", "#2A1508"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.boardFrame, { width: BOARD + 12, height: BOARD + 12 }]}
        >
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
                    ]}
                  >
                    <LinearGradient
                      colors={
                        isSelected
                          ? ["#9BCE74", "#5F8C44"]
                          : isDark
                            ? ["#8B5A2B", "#5C3A18"]
                            : ["#F7E7CB", "#E0CBA1"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill as any}
                    />
                    {isHighlight && !piece && <View style={styles.dot} />}
                    {isHighlight && piece && <View style={styles.captureRing} />}
                    {piece && (
                      <ChessPieceSvg
                        type={piece.type}
                        color={piece.color}
                        size={CELL * 0.92}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </LinearGradient>
      </View>

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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "800" },
  statusBar: { alignItems: "center", paddingVertical: 12 },
  statusText: { color: FUTURISTIC.textPrimary, fontSize: 16, fontWeight: "700" },
  boardWrap: { alignItems: "center", marginTop: 12 },
  boardFrame: {
    padding: 6, borderRadius: 12,
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  board: {
    position: "relative", borderRadius: 6, overflow: "hidden",
    borderWidth: 1, borderColor: "#1B0E04",
  },
  cell: {
    position: "absolute", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  dot: {
    width: CELL * 0.28, height: CELL * 0.28, borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  captureRing: {
    position: "absolute", width: CELL * 0.92, height: CELL * 0.92,
    borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,80,80,0.85)",
  },
  footer: { alignItems: "center", marginTop: 20 },
  footerText: { color: FUTURISTIC.textMuted, fontSize: 13 },
});
