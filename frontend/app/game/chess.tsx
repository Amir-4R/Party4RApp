// =============================================================================
// app/game/chess.tsx — Playable Chess Screen (PREMIUM 3D LOOK)
// =============================================================================
// • Solid filled glyphs only (NO outline / transparent characters)
// • Each piece sits on a metallic circular podium with LinearGradient
// • Ivory-white for "white" pieces, charcoal-black for "black" pieces
// • Subtle highlight + drop shadow → premium 3-D feel without heavy assets
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
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";

const { width } = Dimensions.get("window");
const BOARD = Math.min(width - 24, 360);
const CELL = BOARD / 8;

// ─── Premium glyphs: ALWAYS use the SOLID (filled) Unicode chess glyphs.
//     The "white" Unicode glyphs (♔♕♖♗♘♙) are outline characters and tend
//     to render thin/translucent on RN — we use the solid set for both
//     colours and recolour them via the `color` style.
const PIECE_GLYPH: Record<PieceType, string> = {
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

// ─── Colour palette for the pieces ────────────────────────────────────────
const WHITE_PIECE = {
  glyphColor: "#FFF7E1",        // warm ivory
  glyphShadow: "rgba(40,25,5,0.55)",
  baseGrad: ["#F8ECD0", "#E2C893", "#B68F4E"] as const, // brushed gold/ivory
  ring: "#F5DEB1",
  shadow: "rgba(180,140,70,0.55)",
};
const BLACK_PIECE = {
  glyphColor: "#0E0E12",        // deep charcoal
  glyphShadow: "rgba(255,255,255,0.18)",
  baseGrad: ["#5B5B68", "#2A2A30", "#0C0C10"] as const, // gunmetal
  ring: "#7A7A88",
  shadow: "rgba(0,0,0,0.65)",
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

  // ─── Premium piece renderer ────────────────────────────────────────────
  const renderPiece = (color: "white" | "black", type: PieceType) => {
    const theme = color === "white" ? WHITE_PIECE : BLACK_PIECE;
    const baseSize = CELL * 0.88;
    return (
      <View style={{
        width: baseSize, height: baseSize,
        alignItems: "center", justifyContent: "center",
      }}>
        {/* Outer rim — gives premium thickness */}
        <LinearGradient
          colors={theme.baseGrad}
          start={{ x: 0.25, y: 0.1 }}
          end={{ x: 0.75, y: 0.95 }}
          style={{
            position: "absolute", inset: 0 as any,
            width: baseSize, height: baseSize,
            borderRadius: baseSize / 2,
            borderWidth: 1.5, borderColor: theme.ring,
            shadowColor: theme.shadow,
            shadowOpacity: 0.85, shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
          }}
        />
        {/* Top sheen highlight (gives 3-D pop) */}
        <View pointerEvents="none" style={{
          position: "absolute",
          top: baseSize * 0.08, left: baseSize * 0.22,
          width: baseSize * 0.45, height: baseSize * 0.16,
          borderRadius: baseSize,
          backgroundColor: color === "w" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)",
        }} />
        {/* Solid glyph (always the filled chess character) */}
        <Text style={{
          fontSize: baseSize * 0.62,
          color: theme.glyphColor,
          textShadowColor: theme.glyphShadow,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
          // Bake-in weight (RN ignores font-weight on emojis but harmless)
          fontWeight: "900",
          textAlign: "center",
          // Center perfectly inside the podium
          marginTop: -baseSize * 0.04,
        }}>
          {PIECE_GLYPH[type]}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_chess") || "Chess"}</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
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
                    {/* Cell background with subtle gradient — gives premium wood feel */}
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
                    {/* Highlight indicators */}
                    {isHighlight && !piece && <View style={styles.dot} />}
                    {isHighlight && piece && <View style={styles.captureRing} />}
                    {/* Piece */}
                    {piece && renderPiece(piece.color, piece.type)}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </LinearGradient>
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
