// =============================================================================
// src/comms/ui/GameCommsBar.tsx — In-game comms cluster
// =============================================================================
// مجموعة أزرار عائمة داخل اللعبة: دردشة الخصم + أصدقاء + مايك.
//   • لا تغطّي اللوحة (عمود صغير على الحافة، يراعي SafeArea).
//   • Badge صغير عند وصول رسالة جديدة والدردشة مغلقة.
//   • تصميم زجاجي متناسق مع Party4R، مؤثّر ضغط خفيف.
//   • الحالة تُحفظ داخل هذا المكوّن (يبقى مُركَّباً مع اللعبة) فلا تضيع الدردشة
//     عند الإغلاق أو الخروج المؤقت.
// =============================================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ViewStyle,
  PanResponder, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { storage } from "@/src/utils/storage";
import GameChatSheet, { ChatMessage } from "./GameChatSheet";
import FriendsQuickOverlay from "./FriendsQuickOverlay";
import MicButton from "./MicButton";

const BOT_REPLIES = ["👍", "حظ موفق!", "لعبة حلوة 😄", "هههه", "تمام", "ماشي 🔥"];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function GameCommsBar({
  opponentName = "Bot",
  opponentAvatar,
  showMic = true,
  botReplies = true,
  style,
  // ── Online-mode bridge: when provided, every "send" is routed through
  //    this callback (WS → server → broadcast) instead of the local bot
  //    simulator. Incoming messages should be piped in via `externalMessages`.
  onSendInGame,
  externalMessages,
  // ── Carrom edit-mode (opt-in). When false (default) every other game keeps
  //    the exact same fixed cluster. When true, the three controls become
  //    individually draggable, with an Edit toggle + Reset, persisted per
  //    `persistKey` (e.g. per user). #12/#13.
  editable = false,
  persistKey,
}: {
  opponentName?: string;
  opponentAvatar?: string;
  showMic?: boolean;
  botReplies?: boolean;
  style?: ViewStyle;
  onSendInGame?: (text: string) => void;
  externalMessages?: { id: string; from: string; text: string; ts: number; fromMe?: boolean }[];
  editable?: boolean;
  persistKey?: string;
}) {
  const insets = useSafeAreaInsets();
  const [chatOpen, setChatOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalIdRef = useRef<string | null>(null);

  // When the screen wires `externalMessages` (e.g. online match) we mirror
  // them into the chat sheet's message list so the player sees everything in
  // ONE conversation panel. Local "fromMe" messages get tagged accordingly.
  useEffect(() => {
    if (!externalMessages || externalMessages.length === 0) return;
    const last = externalMessages[externalMessages.length - 1];
    if (lastExternalIdRef.current === last.id) return;
    lastExternalIdRef.current = last.id;
    const newOnes = externalMessages.filter((m) => {
      // De-dupe by id so we don't add the same message twice.
      return !messages.some((existing) => existing.id === m.id);
    });
    if (newOnes.length === 0) return;
    setMessages((prev) => [...prev, ...newOnes.map((m) => ({
      id: m.id,
      fromMe: !!m.fromMe,
      name: m.fromMe ? "" : m.from,
      text: m.text,
      ts: m.ts,
    } as ChatMessage))]);
    // Surface unread if the panel is closed and the message wasn't from me.
    setChatOpen((open) => {
      if (!open && !last.fromMe) setUnread((u) => u + 1);
      return open;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalMessages]);

  const handleSend = useCallback((text: string) => {
    // Online mode: route through the parent callback and DO NOT add a local
    // bubble — the server will echo it back via `externalMessages`.
    if (onSendInGame) {
      onSendInGame(text);
      return;
    }
    setMessages((prev) => [...prev, { id: `me_${Date.now()}`, fromMe: true, name: "", text, ts: Date.now() }]);
    // Light, local bot acknowledgement so chat feels alive in practice mode.
    if (botReplies) {
      if (replyTimer.current) clearTimeout(replyTimer.current);
      replyTimer.current = setTimeout(() => {
        const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        setMessages((prev) => [...prev, {
          id: `op_${Date.now()}`, fromMe: false, name: opponentName, avatar: opponentAvatar, text: reply, ts: Date.now(),
        }]);
        setChatOpen((open) => {
          if (!open) setUnread((u) => u + 1);
          return open;
        });
      }, 900 + Math.random() * 800);
    }
  }, [botReplies, opponentName, opponentAvatar, onSendInGame]);

  const openChat = () => { setChatOpen(true); setUnread(0); };

  // ── Edit-mode (carrom only) ────────────────────────────────────────────
  const SZ = 44;
  const DEFAULTS: Record<DragKey, Pos> = {
    chat:    { x: SCREEN_W - SZ - 6, y: SCREEN_H * 0.40 },
    friends: { x: SCREEN_W - SZ - 6, y: SCREEN_H * 0.40 + 54 },
    mic:     { x: SCREEN_W - SZ - 6, y: SCREEN_H * 0.40 + 108 },
  };
  const [positions, setPositions] = useState<Record<DragKey, Pos>>(DEFAULTS);
  const [editMode, setEditMode] = useState(false);

  // Load saved positions for this user/game.
  useEffect(() => {
    if (!editable || !persistKey) return;
    let alive = true;
    (async () => {
      try {
        const raw = (await storage.getItem(persistKey, "")) as string;
        if (raw && alive) setPositions({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, persistKey]);

  const commitPos = useCallback((key: DragKey, p: Pos) => {
    setPositions((prev) => {
      const next = { ...prev, [key]: p };
      if (persistKey) storage.setItem(persistKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [persistKey]);

  const resetPositions = useCallback(() => {
    setPositions(DEFAULTS);
    if (persistKey) storage.setItem(persistKey, JSON.stringify(DEFAULTS)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  const chatBtn = (
    <TouchableOpacity testID="comms-chat-button" style={styles.btn} onPress={openChat} activeOpacity={0.85} disabled={editMode}>
      <Ionicons name="chatbubbles" size={20} color={FUTURISTIC.brand} />
      {unread > 0 && (
        <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>
      )}
    </TouchableOpacity>
  );
  const friendsBtn = (
    <TouchableOpacity testID="comms-friends-button" style={styles.btn} onPress={() => setFriendsOpen(true)} activeOpacity={0.85} disabled={editMode}>
      <Ionicons name="people" size={20} color={FUTURISTIC.brand} />
    </TouchableOpacity>
  );
  const micBtn = showMic ? <MicButton compact /> : null;

  const sheets = (
    <>
      <GameChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        onSend={handleSend}
      />
      <FriendsQuickOverlay visible={friendsOpen} onClose={() => setFriendsOpen(false)} />
    </>
  );

  // Editable layout (carrom): each control is independently draggable, clamped
  // to the screen, positions saved per user. Other games keep the fixed bar.
  if (editable) {
    return (
      <>
        <DraggableNode editMode={editMode} position={positions.chat} size={{ w: SZ, h: SZ }} onCommit={(p) => commitPos("chat", p)}>
          {chatBtn}
        </DraggableNode>
        <DraggableNode editMode={editMode} position={positions.friends} size={{ w: SZ, h: SZ }} onCommit={(p) => commitPos("friends", p)}>
          {friendsBtn}
        </DraggableNode>
        {micBtn && (
          <DraggableNode editMode={editMode} position={positions.mic} size={{ w: 120, h: 96 }} onCommit={(p) => commitPos("mic", p)}>
            {micBtn}
          </DraggableNode>
        )}

        {/* Edit + Reset controls (fixed, never overlap the board area) */}
        <View style={styles.editDock} pointerEvents="box-none">
          {editMode && (
            <TouchableOpacity testID="carrom-btns-reset" style={[styles.editFab, styles.resetFab]} onPress={resetPositions} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.editFabText}>إعادة ضبط</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            testID="carrom-btns-edit"
            style={[styles.editFab, editMode && styles.editFabActive]}
            onPress={() => setEditMode((e) => !e)}
            activeOpacity={0.85}
          >
            <Ionicons name={editMode ? "checkmark" : "move"} size={16} color="#fff" />
            <Text style={styles.editFabText}>{editMode ? "تم" : "تحرير"}</Text>
          </TouchableOpacity>
        </View>

        {sheets}
      </>
    );
  }

  // Default (unchanged) fixed cluster — chess / damma / damma-online.
  return (
    <>
      <View style={[styles.bar, { top: insets.top + 120 }, style]} pointerEvents="box-none">
        {chatBtn}
        {friendsBtn}
        {micBtn && <View style={styles.micWrap}>{micBtn}</View>}
      </View>
      {sheets}
    </>
  );
}

// ── Draggable wrapper used only in carrom edit mode ────────────────────────
type DragKey = "chat" | "friends" | "mic";
interface Pos { x: number; y: number; }

function DraggableNode({
  editMode, position, size, onCommit, children,
}: {
  editMode: boolean;
  position: Pos;
  size: { w: number; h: number };
  onCommit: (p: Pos) => void;
  children: React.ReactNode;
}) {
  const editRef = useRef(editMode);
  editRef.current = editMode;
  const [pos, setPos] = useState<Pos>(position);
  const posRef = useRef<Pos>(position);
  const startRef = useRef<Pos>(position);

  // Sync external changes (load / reset).
  useEffect(() => {
    posRef.current = position;
    setPos(position);
  }, [position.x, position.y]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editRef.current,
      onMoveShouldSetPanResponder: (_e, g) =>
        editRef.current && (Math.abs(g.dx) + Math.abs(g.dy) > 2),
      onPanResponderGrant: () => { startRef.current = posRef.current; },
      onPanResponderMove: (_e, g) => {
        const nx = Math.max(4, Math.min(startRef.current.x + g.dx, SCREEN_W - size.w - 4));
        const ny = Math.max(4, Math.min(startRef.current.y + g.dy, SCREEN_H - size.h - 4));
        posRef.current = { x: nx, y: ny };
        setPos(posRef.current);
      },
      onPanResponderRelease: () => onCommit(posRef.current),
      onPanResponderTerminate: () => onCommit(posRef.current),
    })
  ).current;

  return (
    <View
      style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: 40 }}
      {...(editMode ? pan.panHandlers : {})}
    >
      {children}
      {editMode && (
        <View pointerEvents="none" style={styles.dragHalo}>
          <Ionicons name="move" size={14} color={FUTURISTIC.brand} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute", right: 8,
    alignItems: "center", gap: 10, zIndex: 30,
  },
  btn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: FUTURISTIC.glassFill,
    borderWidth: 1, borderColor: FUTURISTIC.borderSoft,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  micWrap: { marginTop: 2 },
  badge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#FF3B3B", alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: FUTURISTIC.bg,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  editDock: {
    position: "absolute", left: 10, bottom: 16, flexDirection: "row", gap: 8, zIndex: 50,
  },
  editFab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, height: 36, borderRadius: 18,
    backgroundColor: FUTURISTIC.brand,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  editFabActive: { backgroundColor: "#1DB954" },
  resetFab: { backgroundColor: "#555" },
  editFabText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  dragHalo: {
    position: "absolute", top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 26, borderWidth: 1.5, borderColor: FUTURISTIC.brand,
    borderStyle: "dashed", alignItems: "flex-end", justifyContent: "flex-start",
    paddingTop: 1, paddingRight: 1,
  },
});
