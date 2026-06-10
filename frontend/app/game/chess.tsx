// =============================================================================
// app/game/chess.tsx — Playable Chess Screen (SCULPTED REALISTIC PIECES)
// =============================================================================
// Hand-drawn SVG silhouettes (Cburnett-style, public domain) so each piece
// looks carved/sculpted rather than cartoon. Solid ivory/charcoal fills.
// =============================================================================
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  createInitialState, legalMoves, makeMove, getGameResult,
  GameState, Square, PieceType,
} from "@/src/games/chess/engine";
import ChessPieceSvg, { ChessTheme, CHESS_THEMES } from "@/src/games/chess/ChessPieceSvg";
import { pickBotMove, ChessDifficulty } from "@/src/games/chess/ai";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useT } from "@/src/context/LanguageContext";
import { useTheme } from "@/src/context/ThemeContext";
import { gameBackground } from "@/src/games/shared/gameTheme";
import { useAuth } from "@/src/context/AuthContext";
import GameResultOverlay from "@/src/games/shared/ui/GameResultOverlay";
import Countdown from "@/src/games/shared/ui/Countdown";
import { recordResult, RecordResult } from "@/src/games/stats";
import { playSound } from "@/src/games/sound/SoundManager";

const { width } = Dimensions.get("window");
const BOARD = Math.min(width - 24, 360);
const CELL = BOARD / 8;

// Persisted theme key
const THEME_KEY = "chess_piece_theme";
const BOT_KEY = "chess_bot_config";
const THEME_OPTIONS: { id: ChessTheme; label: string; emoji: string }[] = [
  { id: "classic", label: "كلاسيكي", emoji: "🪵" },
  { id: "royal",   label: "ملكي",    emoji: "👑" },
  { id: "ocean",   label: "محيطي",   emoji: "🌊" },
];
const BOT_OPTIONS: { id: ChessDifficulty | "off"; label: string; emoji: string; color: string }[] = [
  { id: "off",    label: "إيقاف البوت (لاعبَين)", emoji: "👥", color: "#888"   },
  { id: "easy",   label: "سهل",   emoji: "🌱", color: "#4ADE80" },
  { id: "medium", label: "متوسط", emoji: "🔥", color: "#F59E0B" },
  { id: "hard",   label: "صعب",   emoji: "💀", color: "#EF4444" },
];

// Bot always plays as BLACK; human plays as WHITE (standard convention).
const BOT_COLOR = "black";

export default function ChessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { themeId } = useTheme();
  const bg = gameBackground(themeId);
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();

  const [counting, setCounting] = useState(true);
  const [matchRecord, setMatchRecord] = useState<RecordResult | null>(null);
  const recordedRef = useRef(false);

  const [state, setState] = useState<GameState>(createInitialState);
  const [selected, setSelected] = useState<Square | null>(null);
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [theme, setTheme] = useState<ChessTheme>("royal");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [botMode, setBotMode] = useState<ChessDifficulty | "off">("off");
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [botThinking, setBotThinking] = useState(false);

  // Load saved theme + bot config on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v && (v === "classic" || v === "royal" || v === "ocean")) {
        setTheme(v as ChessTheme);
      }
    }).catch(() => {});
    AsyncStorage.getItem(BOT_KEY).then((v) => {
      if (v && (v === "off" || v === "easy" || v === "medium" || v === "hard")) {
        setBotMode(v as ChessDifficulty | "off");
      }
    }).catch(() => {});
  }, []);

  const pickTheme = useCallback((id: ChessTheme) => {
    setTheme(id);
    AsyncStorage.setItem(THEME_KEY, id).catch(() => {});
    setShowThemePicker(false);
  }, []);

  const pickBot = useCallback((id: ChessDifficulty | "off") => {
    setBotMode(id);
    AsyncStorage.setItem(BOT_KEY, id).catch(() => {});
    setShowBotPicker(false);
    // Clear selection when bot mode changes
    setSelected(null);
    setHighlights([]);
  }, []);

  const result = useMemo(() => getGameResult(state), [state]);

  // ─── Bot auto-play ────────────────────────────────────────────────────────
  // When bot is enabled and it's the bot's turn (black) and game not over →
  // ask the AI for a move after a short "thinking" delay.
  useEffect(() => {
    if (botMode === "off" || counting) return;
    if (state.turn !== BOT_COLOR) return;
    if (result.status === "checkmate" || result.status === "stalemate" || result.status === "draw") return;
    setBotThinking(true);
    // setTimeout lets the UI render the human's move first before the bot
    // blocks the main thread with minimax.
    const handle = setTimeout(() => {
      const move = pickBotMove(state, botMode);
      if (move) {
        const next = makeMove(state, move.from, move.to, move.promotion);
        if (next) {
          setState(next);
          playSound("piece_move");
        }
      }
      setBotThinking(false);
    }, 400);
    return () => clearTimeout(handle);
  }, [state, botMode, result.status, counting]);

  const onCellPress = useCallback((row: number, col: number) => {
    if (counting) return;
    // While bot is thinking or it's bot's turn, ignore taps
    if (botMode !== "off" && (state.turn === BOT_COLOR || botThinking)) return;
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
          playSound("piece_move");
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
  }, [state, selected, highlights, botMode, botThinking, counting]);

  // Record finished game into the unified stats/rank system (once). The human
  // plays White; in 2-player mode White is treated as "you".
  useEffect(() => {
    const over = result.status === "checkmate" || result.status === "stalemate" || result.status === "draw";
    if (!over || recordedRef.current) return;
    recordedRef.current = true;
    const outcome = result.status === "checkmate" ? (result.winner === "white" ? "win" : "loss") : "draw";
    recordResult(user?.id || "guest", "chess", outcome).then(setMatchRecord).catch(() => {});
  }, [result.status, result.winner, user]);

  const reset = () => {
    setState(createInitialState());
    setSelected(null);
    setHighlights([]);
    setBotThinking(false);
    setMatchRecord(null);
    recordedRef.current = false;
    setCounting(true);
  };

  const statusText = useMemo(() => {
    if (result.status === "checkmate") return t("checkmate") || "Checkmate";
    if (result.status === "stalemate") return t("stalemate") || "Stalemate";
    if (result.status === "check") return t("check") || "Check!";
    if (result.status === "draw") return t("draw") || "Draw";
    if (botMode !== "off" && botThinking) return "🤖 البوت يفكر...";
    if (botMode !== "off") {
      return state.turn === "white" ? "دورك ♔" : "🤖 دور البوت";
    }
    return state.turn === "white" ? (t("white_turn") || "White's turn") : (t("black_turn") || "Black's turn");
  }, [result, state.turn, t, botMode, botThinking]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={bg} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("play_chess") || "Chess"}</Text>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity onPress={() => setShowBotPicker(true)} style={styles.iconBtn}>
            <Ionicons name="hardware-chip-outline" size={22} color={botMode === "off" ? FUTURISTIC.textPrimary : "#4ADE80"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowThemePicker(true)} style={styles.iconBtn}>
            <Ionicons name="color-palette-outline" size={22} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} style={styles.iconBtn}>
            <Ionicons name="refresh" size={22} color={FUTURISTIC.textPrimary} />
          </TouchableOpacity>
        </View>
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
                        theme={theme}
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

      {/* Theme picker modal */}
      <Modal
        visible={showThemePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowThemePicker(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>اختر ألوان القطع</Text>
            {THEME_OPTIONS.map((opt) => {
              const sel = theme === opt.id;
              const cols = CHESS_THEMES[opt.id];
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.themeRow, sel && styles.themeRowActive]}
                  onPress={() => pickTheme(opt.id)}
                >
                  <Text style={styles.themeEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.themeLabel}>{opt.label}</Text>
                    <View style={{ flexDirection: "row", marginTop: 6, gap: 6 }}>
                      <View style={[styles.swatch, { backgroundColor: cols.fillWhite, borderColor: cols.strokeWhite }]} />
                      <View style={[styles.swatch, { backgroundColor: cols.fillBlack, borderColor: cols.strokeBlack }]} />
                    </View>
                  </View>
                  {sel && <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bot picker modal */}
      <Modal
        visible={showBotPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBotPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBotPicker(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>🤖 صعوبة البوت</Text>
            <Text style={styles.modalSubtitle}>أنت تلعب بالأبيض، البوت يلعب بالأسود</Text>
            {BOT_OPTIONS.map((opt) => {
              const sel = botMode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.themeRow, sel && styles.themeRowActive]}
                  onPress={() => pickBot(opt.id)}
                >
                  <Text style={styles.themeEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.themeLabel}>{opt.label}</Text>
                    <Text style={[styles.themeHint, { color: opt.color }]}>
                      {opt.id === "off" && "بدون ذكاء اصطناعي"}
                      {opt.id === "easy" && "حركات شبه عشوائية مع تفضيل الأخذ"}
                      {opt.id === "medium" && "تفكير بحركتين للأمام (Minimax)"}
                      {opt.id === "hard" && "تفكير بـ 3 حركات + تقييم متقدم"}
                    </Text>
                  </View>
                  {sel && <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Pre-match countdown (3·2·1·GO) ── */}
      {counting && <Countdown onDone={() => setCounting(false)} />}

      {/* ── Unified end-of-match screen ── */}
      {(result.status === "checkmate" || result.status === "stalemate" || result.status === "draw") && (
        <GameResultOverlay
          outcome={result.status === "checkmate" ? (result.winner === "white" ? "win" : "loss") : "draw"}
          record={matchRecord}
          onPlayAgain={reset}
          onExit={() => router.back()}
        />
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
  // Theme picker modal
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%", maxWidth: 360,
    backgroundColor: "#1A1B22",
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "#2A2C36",
  },
  modalTitle: {
    color: "#FFF", fontSize: 18, fontWeight: "800",
    textAlign: "center", marginBottom: 6,
  },
  modalSubtitle: {
    color: "#9CA3AF", fontSize: 12, textAlign: "center", marginBottom: 14,
  },
  themeHint: { fontSize: 12, marginTop: 2 },
  themeRow: {
    flexDirection: "row", alignItems: "center",
    padding: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
    borderWidth: 1, borderColor: "transparent",
  },
  themeRowActive: {
    backgroundColor: "rgba(74,222,128,0.10)",
    borderColor: "rgba(74,222,128,0.40)",
  },
  themeEmoji: { fontSize: 30, marginRight: 12 },
  themeLabel: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  swatch: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
  },
});
