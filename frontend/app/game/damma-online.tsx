// =============================================================================
// app/game/damma-online.tsx — Real-time online Dominoes (Phase 5)
// =============================================================================
// Single-screen online match driven by the FastAPI WebSocket backend.
//
//   • All gameplay state is server-authoritative (no local engine).
//   • Reuses the same modular UI primitives as the offline screen:
//       WoodenTable, HandTray, PlayerChip, BoneyardPanel.
//   • Rotates the seat layout so the current user is ALWAYS at the bottom,
//     regardless of their pid (player1…player4).
//   • Chat events flow through the global GameCommsBar AND the WS, so any
//     friend that joins can see in-room chat as well.
//   • Shows clear connection state (connecting / reconnecting / disconnect).
// =============================================================================
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  Modal, Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { PlayerId, Domino } from "@/src/games/damma/engine";
import { getPlayableSides } from "@/src/games/damma/engine";
import { useDammaOnline } from "@/src/games/damma/useDammaOnline";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { useTheme } from "@/src/context/ThemeContext";
import { dammaPalette, withAlpha } from "@/src/games/shared/gameTheme";
import { useT } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { getAvatarUrl } from "@/src/constants/avatars";
import GameResultOverlay from "@/src/games/shared/ui/GameResultOverlay";
import PlayerChip from "@/src/games/damma/components/PlayerChip";
import BoneyardPanel from "@/src/games/damma/components/BoneyardPanel";
import WoodenTable from "@/src/games/damma/components/WoodenTable";
import HandTray from "@/src/games/damma/components/HandTray";
import { GOLD } from "@/src/games/damma/components/theme";
import { DAMMA_TEXTURES } from "@/src/games/damma/components/assets";
import GameCommsBar from "@/src/comms/ui/GameCommsBar";
import { playSound } from "@/src/games/sound/SoundManager";

// ── Helpers ─────────────────────────────────────────────────────────────────
function pidAt(idx: number, n: number): PlayerId {
  return `player${((idx % n) + n) % n + 1}` as PlayerId;
}

interface ChatBubble {
  id: string;
  from: string;
  text: string;
  ts: number;
}

// ─── Screen ────────────────────────────────────────────────────────────────
export default function DammaOnlineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { user } = useAuth();
  const { themeId: _themeId } = useTheme(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const pal = dammaPalette();

  const params = useLocalSearchParams<{ rid?: string }>();
  const rid = (params.rid || "").toString();

  // ── Online plumbing (WS + state hydration) ──────────────────────────────
  const online = useDammaOnline({
    enabled: !!rid && !!user,
    rid,
    userId: user?.id || "",
    userName: user?.nickname || user?.username || "Player",
    userAvatar: user?.avatar || "avatar_ninja",
  });

  const state = online.state;
  const mePid = online.mePid || "player1";
  const room = online.room;
  const isMyTurn = state?.turn === mePid;

  // ── Tile selection (local UI state) ─────────────────────────────────────
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  useEffect(() => { setSelectedTile(null); }, [state?.turn]);

  // ── Exit-confirmation modal (cross-platform — Alert.alert is silent on web)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  // ── Local chat overlay (in addition to GameCommsBar) ────────────────────
  const [chatBubbles, setChatBubbles] = useState<ChatBubble[]>([]);
  useEffect(() => {
    if (!online.chatMsgs.length) return;
    const last = online.chatMsgs[online.chatMsgs.length - 1];
    setChatBubbles((prev) => [...prev.slice(-3), {
      id: last.id, from: last.from, text: last.text, ts: last.ts,
    }]);
    const id = setTimeout(() => {
      setChatBubbles((prev) => prev.filter((b) => b.id !== last.id));
    }, 4500);
    return () => clearTimeout(id);
  }, [online.chatMsgs]);

  // ── Derived per-tile playability (we can't rely on the local engine since
  // the server is authoritative, but checking adjacency to current ends is
  // safe to do client-side for visual hints). ─────────────────────────────
  const myHand: Domino[] = useMemo(() => {
    if (!state) return [];
    return state.hands[mePid] || [];
  }, [state, mePid]);

  const playableTiles: Domino[] = useMemo(() => {
    if (!state || !isMyTurn) return [];
    if (state.board.length === 0) return myHand;
    const sides = getPlayableSides;
    return myHand.filter((d) => sides(state, d).length > 0);
  }, [state, myHand, isMyTurn]);

  const playableSides = useMemo(() => {
    if (!state || !isMyTurn || !selectedTile) return [] as ("left" | "right")[];
    const tile = myHand.find((d) => d.id === selectedTile);
    if (!tile) return [];
    return getPlayableSides(state, tile);
  }, [state, isMyTurn, selectedTile, myHand]);

  const mustDraw = isMyTurn && playableTiles.length === 0 && (state?.boneyard.length || 0) > 0;
  const mustPass = isMyTurn && playableTiles.length === 0 && (state?.boneyard.length || 0) === 0;

  // ── Action handlers (all go through WS) ─────────────────────────────────
  const handleTilePress = useCallback((d: Domino, playable: boolean) => {
    if (!isMyTurn || !state) return;
    if (state.board.length === 0) {
      // First move — just play immediately on the empty board.
      online.play(d.id, "left");
      playSound("domino_move");
    } else if (playable) {
      setSelectedTile((cur) => cur === d.id ? null : d.id);
    }
  }, [isMyTurn, state, online]);

  const handlePlay = useCallback((side: "left" | "right") => {
    if (!selectedTile || !isMyTurn) return;
    online.play(selectedTile, side);
    playSound("domino_move");
    setSelectedTile(null);
  }, [selectedTile, isMyTurn, online]);

  const handleDraw = useCallback(() => {
    if (!mustDraw) return;
    online.draw();
  }, [mustDraw, online]);

  const handlePass = useCallback(() => {
    if (!mustPass) return;
    online.pass();
  }, [mustPass, online]);

  const exitMatch = useCallback(async () => {
    try { await online.disconnect(); } catch {}
    router.back();
  }, [online, router]);

  const confirmExit = useCallback(() => {
    setExitConfirmOpen(true);
  }, []);

  const cancelExit = useCallback(() => {
    setExitConfirmOpen(false);
  }, []);

  const confirmExitAndLeave = useCallback(() => {
    setExitConfirmOpen(false);
    exitMatch();
  }, [exitMatch]);

  // ── Compute seat order so MY pid is always at the bottom ────────────────
  // For 4-player: { bottom: me, left: me+1, top: me+2, right: me+3 }
  // For 2-player: { bottom: me, top: opponent }
  const seatOrder = useMemo(() => {
    if (!room) return { bottom: mePid as PlayerId, left: null as PlayerId | null, top: null as PlayerId | null, right: null as PlayerId | null };
    const n = room.num_players;
    const meIdx = parseInt(mePid.replace("player", ""), 10) - 1;
    if (n === 2) {
      return {
        bottom: mePid as PlayerId,
        top: pidAt(meIdx + 1, n),
        left: null as PlayerId | null,
        right: null as PlayerId | null,
      };
    }
    return {
      bottom: mePid as PlayerId,
      left: pidAt(meIdx + 1, n),
      top: pidAt(meIdx + 2, n),
      right: pidAt(meIdx + 3, n),
    };
  }, [room, mePid]);

  const slotFor = useCallback((pid: PlayerId | null) => {
    if (!pid || !room) return null;
    return room.slots.find((s) => s.pid === pid) || null;
  }, [room]);

  const tilesFor = useCallback((pid: PlayerId | null) => {
    if (!pid || !room) return 0;
    return room.tile_counts?.[pid] ?? 0;
  }, [room]);

  // ── Connection overlays ─────────────────────────────────────────────────
  const showConnecting = online.connecting || (online.connected && !state);
  const showError = !!online.error && !online.reconnecting;
  const showReconnecting = online.reconnecting;

  // ── Game end overlay ────────────────────────────────────────────────────
  const gameOver = state?.phase === "game_over" || !!online.endResult;
  const won = online.endResult?.winner === mePid;
  const myScore = state?.scores?.[mePid] ?? 0;
  // For the score banner: total of every OTHER pid combined → represents "opponents".
  const oppScore = state ?
    (Object.entries(state.scores) as [PlayerId, number][])
      .filter(([k]) => k !== mePid)
      .reduce((a, [, v]) => a + (v || 0), 0)
    : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#0B0F0C", "#06080A", "#000000"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.bgRadialGlow} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity testID="damma-online-back" onPress={confirmExit} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={FUTURISTIC.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Image source={DAMMA_TEXTURES.ornament} style={[styles.titleOrnamentImg, { transform: [{ scaleX: -1 }] }]} resizeMode="contain" />
          <View style={{ alignItems: "center" }}>
            <Text style={styles.titleArabic}>ضمنة • أونلاين</Text>
            <Text style={styles.titleSubtitle}>
              {rid ? `Room • ${rid.slice(0, 6)}` : "Live"}
            </Text>
          </View>
          <Image source={DAMMA_TEXTURES.ornament} style={styles.titleOrnamentImg} resizeMode="contain" />
        </View>
        <View style={styles.iconBtn}>
          <View style={[styles.connDot, online.connected ? styles.connDotOn : styles.connDotOff]} />
        </View>
      </View>

      {/* ── Board ─────────────────────────────────────────────────────────── */}
      <View style={styles.boardArea}>
        <WoodenTable
          board={state?.board || []}
          leftEnd={state?.leftEnd ?? null}
          rightEnd={state?.rightEnd ?? null}
          pal={pal}
          endsLabel={t("ends") || "Ends"}
          emptyText={t("place_first_tile") || "ضع أول قطعة"}
        />

        {/* Top seat */}
        {seatOrder.top && (
          <View style={styles.chipTop} pointerEvents="box-none">
            <PlayerChip
              testID="damma-online-chip-top"
              name={slotFor(seatOrder.top)?.name || "—"}
              tileCount={tilesFor(seatOrder.top)}
              score={state?.scores?.[seatOrder.top] ?? 0}
              avatarUri={slotFor(seatOrder.top)?.avatar ? getAvatarUrl(slotFor(seatOrder.top)!.avatar) : undefined}
              active={state?.turn === seatOrder.top}
              popupDirection="bottom"
              subLabel={slotFor(seatOrder.top)?.is_bot ? "Bot" : (slotFor(seatOrder.top)?.online ? "Online" : "Offline")}
            />
          </View>
        )}

        {seatOrder.left && (
          <View style={styles.chipLeft} pointerEvents="box-none">
            <PlayerChip
              testID="damma-online-chip-left"
              name={slotFor(seatOrder.left)?.name || "—"}
              tileCount={tilesFor(seatOrder.left)}
              score={state?.scores?.[seatOrder.left] ?? 0}
              avatarUri={slotFor(seatOrder.left)?.avatar ? getAvatarUrl(slotFor(seatOrder.left)!.avatar) : undefined}
              active={state?.turn === seatOrder.left}
              popupDirection="right"
              subLabel={slotFor(seatOrder.left)?.is_bot ? "Bot" : (slotFor(seatOrder.left)?.online ? "Online" : "Offline")}
            />
          </View>
        )}

        {seatOrder.right && (
          <View style={styles.chipRight} pointerEvents="box-none">
            <PlayerChip
              testID="damma-online-chip-right"
              name={slotFor(seatOrder.right)?.name || "—"}
              tileCount={tilesFor(seatOrder.right)}
              score={state?.scores?.[seatOrder.right] ?? 0}
              avatarUri={slotFor(seatOrder.right)?.avatar ? getAvatarUrl(slotFor(seatOrder.right)!.avatar) : undefined}
              active={state?.turn === seatOrder.right}
              popupDirection="left"
              subLabel={slotFor(seatOrder.right)?.is_bot ? "Bot" : (slotFor(seatOrder.right)?.online ? "Online" : "Offline")}
            />
          </View>
        )}

        {/* Turn timer (server-driven) */}
        <View testID="damma-online-timer" style={[styles.chipTimer, isMyTurn && online.turnSecondsLeft <= 10 && styles.chipTimerWarn]} pointerEvents="box-none">
          <Ionicons
            name="time-outline" size={13}
            color={isMyTurn && online.turnSecondsLeft <= 10 ? "#FF5C5C" : GOLD}
          />
          <Text style={[styles.chipTimerText, isMyTurn && online.turnSecondsLeft <= 10 && { color: "#FF5C5C" }]}>
            {online.turnSecondsLeft}s
          </Text>
        </View>

        {/* Boneyard */}
        <View style={styles.chipBoneyard} pointerEvents="box-none">
          <View style={{ height: 92 }}>
            <BoneyardPanel
              count={state?.boneyard.length || 0}
              canDraw={mustDraw}
              onDraw={handleDraw}
              pal={pal}
              label={t("boneyard") || "السحب"}
              hint={t("tap_to_draw") || "اضغط للسحب"}
              emptyLabel="فارغ"
            />
          </View>
        </View>

        {/* Floating chat bubbles ABOVE the board */}
        {chatBubbles.length > 0 && (
          <View style={styles.bubbleStack} pointerEvents="none">
            {chatBubbles.map((b) => (
              <View key={b.id} style={styles.bubble}>
                <Text style={styles.bubbleFrom}>{b.from}</Text>
                <Text style={styles.bubbleText} numberOfLines={2}>{b.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Hand tray ─────────────────────────────────────────────────────── */}
      <HandTray
        hand={myHand}
        playableTiles={playableTiles}
        isMyTurn={isMyTurn}
        boardEmpty={(state?.board.length || 0) === 0}
        selectedTileId={selectedTile}
        flyingTileId={null}
        botThinking={false}
        mustPass={mustPass}
        playableSides={playableSides}
        bottomInset={insets.bottom}
        pal={pal}
        meName={user?.nickname || user?.username || (t("you") || "أنت")}
        meScore={myScore}
        meAvatarUri={getAvatarUrl(user?.avatar || "avatar_ninja")}
        turnText={isMyTurn ? (t("your_turn") || "دورك") : (t("opponent_turn") || "دور الخصم")}
        thinkingText={t("thinking") || "..."}
        leftText={t("left") || "يسار"}
        rightText={t("right") || "يمين"}
        passText={t("pass") || "تخطي"}
        onTilePress={handleTilePress}
        onPlay={handlePlay}
        onPass={handlePass}
      />

      {/* ── Connecting overlay ───────────────────────────────────────────── */}
      <Modal visible={showConnecting && !gameOver} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.connectCard}>
            <ActivityIndicator color={GOLD} size="large" />
            <Text style={styles.connectTitle}>🌐 جاري الاتصال...</Text>
            <Text style={styles.connectSubtitle}>
              نحضّر الغرفة لك. قد يستغرق ذلك لحظات.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Reconnecting overlay (non-blocking) */}
      {showReconnecting && !gameOver && (
        <View style={styles.reconnectBanner} pointerEvents="none">
          <ActivityIndicator color={GOLD} size="small" />
          <Text style={styles.reconnectText}>إعادة الاتصال…</Text>
        </View>
      )}

      {/* Error overlay */}
      <Modal visible={showError} transparent animationType="fade" onRequestClose={exitMatch}>
        <Pressable style={styles.modalBackdrop} onPress={exitMatch}>
          <Pressable style={styles.errorCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="warning" size={40} color="#EF4444" />
            <Text style={styles.errorTitle}>تعذّر الاتصال</Text>
            <Text style={styles.errorSubtitle}>{online.error}</Text>
            <TouchableOpacity onPress={exitMatch} style={styles.errorBtn} activeOpacity={0.85}>
              <Text style={styles.errorBtnText}>عودة إلى Lobby</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Game end overlay */}
      {gameOver && (
        <GameResultOverlay
          outcome={won ? "win" : "loss"}
          record={null}
          score={{
            you: myScore,
            opp: oppScore,
            youLabel: user?.nickname || (t("you") || "أنت"),
            oppLabel: "الخصوم",
          }}
          onPlayAgain={exitMatch}
          onExit={exitMatch}
        />
      )}

      {/* In-game comms bar (global friends/mic) + bridge to room chat */}
      <GameCommsBar
        opponentName={(() => {
          if (!room || !mePid) return "Opponent";
          const others = room.slots.filter((s) => s.pid !== mePid && s.user_id);
          return others.map((s) => s.name).filter(Boolean).join(", ") || "Opponents";
        })()}
        onSendInGame={(text) => online.sendChat(text)}
        externalMessages={online.chatMsgs.map((m) => ({
          id: m.id,
          from: m.from,
          text: m.text,
          ts: m.ts,
          // Mark messages from "me" so the bubble appears on the right side.
          fromMe: m.from === (user?.nickname || user?.username || "Player"),
        }))}
      />

      {/* Exit confirmation — cross-platform Modal (Alert.alert is silent on web) */}
      <Modal
        visible={exitConfirmOpen}
        transparent animationType="fade"
        onRequestClose={cancelExit}
      >
        <Pressable
          testID="damma-online-exit-backdrop"
          style={styles.modalBackdrop}
          onPress={cancelExit}
        >
          <Pressable
            testID="damma-online-exit-card"
            style={styles.exitCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Ionicons name="exit-outline" size={42} color="#EF4444" />
            <Text style={styles.exitTitle}>الخروج من المباراة</Text>
            <Text style={styles.exitSubtitle}>
              هل أنت متأكد من الخروج؟ سيُعتبر هذا انسحاباً.
            </Text>
            <View style={styles.exitActions}>
              <TouchableOpacity
                testID="damma-online-exit-cancel"
                onPress={cancelExit}
                style={[styles.exitBtn, styles.exitBtnCancel]}
                activeOpacity={0.85}
              >
                <Text style={styles.exitBtnCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="damma-online-exit-confirm"
                onPress={confirmExitAndLeave}
                style={[styles.exitBtn, styles.exitBtnDestructive]}
                activeOpacity={0.85}
              >
                <Text style={styles.exitBtnDestructiveText}>خروج</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Background glows
  bgRadialGlow: {
    position: "absolute", top: -120, left: "20%", right: "20%", height: 360,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.04)",
  },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  titleWrap: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 10,
  },
  titleOrnamentImg: { width: 46, height: 18 },
  titleArabic: {
    color: GOLD, fontSize: 19, fontWeight: "900", letterSpacing: 0.8,
    textShadowColor: "rgba(212,175,55,0.55)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  titleSubtitle: {
    color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "700",
    letterSpacing: 1, marginTop: 3,
  },
  connDot: { width: 10, height: 10, borderRadius: 5 },
  connDotOn: { backgroundColor: "#4ADE80", shadowColor: "#4ADE80", shadowOpacity: 0.7, shadowRadius: 5 },
  connDotOff: { backgroundColor: "#EF4444" },

  // Board area
  boardArea: {
    flex: 1, marginHorizontal: 6, marginTop: 28, marginBottom: 2,
    position: "relative",
  },
  chipTop: { position: "absolute", top: -28, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  chipLeft:  { position: "absolute", left: 4, top: "50%", marginTop: -16, zIndex: 10 },
  chipRight: { position: "absolute", right: 4, top: "50%", marginTop: -16, zIndex: 10 },

  chipTimer: {
    position: "absolute", top: -26, right: 6,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(20,22,28,0.92)",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.45),
    zIndex: 10,
  },
  chipTimerWarn: { borderColor: "#FF5C5C", backgroundColor: "rgba(255,92,92,0.18)" },
  chipTimerText: { color: GOLD, fontSize: 11, fontWeight: "900" },

  chipBoneyard: { position: "absolute", right: 4, bottom: 4, zIndex: 10 },

  // Chat bubbles floating above the board
  bubbleStack: {
    position: "absolute", top: 8, left: 12, right: 12,
    gap: 4, zIndex: 11,
  },
  bubble: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.35),
    maxWidth: "75%",
  },
  bubbleFrom: { color: GOLD, fontSize: 10, fontWeight: "900", marginBottom: 2 },
  bubbleText: { color: "#FFF", fontSize: 12, fontWeight: "600" },

  // Connect overlay
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  connectCard: {
    width: "100%", maxWidth: 320,
    borderRadius: 18, padding: 22,
    backgroundColor: "#0F1F18",
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.45),
    alignItems: "center",
  },
  connectTitle: {
    color: FUTURISTIC.textPrimary, fontSize: 17, fontWeight: "900",
    marginTop: 14, letterSpacing: 0.3,
  },
  connectSubtitle: {
    color: FUTURISTIC.textMuted, fontSize: 12,
    marginTop: 6, textAlign: "center", lineHeight: 18,
  },

  // Reconnect banner
  reconnectBanner: {
    position: "absolute", top: 60, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "rgba(212,175,55,0.18)",
    borderRadius: 999,
    borderWidth: 1, borderColor: withAlpha(GOLD, 0.55),
    zIndex: 50,
  },
  reconnectText: { color: GOLD, fontSize: 12, fontWeight: "800" },

  // Error overlay
  errorCard: {
    width: "100%", maxWidth: 340,
    borderRadius: 18, padding: 24,
    backgroundColor: "#1A0E0E",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.55)",
    alignItems: "center",
  },
  errorTitle: { color: "#EF4444", fontSize: 18, fontWeight: "900", marginTop: 12 },
  errorSubtitle: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 6, textAlign: "center" },
  errorBtn: {
    marginTop: 18, paddingHorizontal: 22, paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.5)",
  },
  errorBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "800" },

  // Exit-confirmation modal (cross-platform replacement for Alert.alert)
  exitCard: {
    width: "100%", maxWidth: 340,
    borderRadius: 18, padding: 24,
    backgroundColor: "#0F1419",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.45)",
    alignItems: "center",
  },
  exitTitle: { color: FUTURISTIC.textPrimary, fontSize: 18, fontWeight: "900", marginTop: 12 },
  exitSubtitle: { color: FUTURISTIC.textMuted, fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 20 },
  exitActions: {
    flexDirection: "row", gap: 12, marginTop: 22, width: "100%",
  },
  exitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  exitBtnCancel: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  exitBtnCancelText: { color: FUTURISTIC.textPrimary, fontSize: 14, fontWeight: "800" },
  exitBtnDestructive: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderColor: "rgba(239,68,68,0.55)",
  },
  exitBtnDestructiveText: { color: "#FF6B6B", fontSize: 14, fontWeight: "900" },
});
