// =============================================================================
// src/games/damma/useDammaOnline.ts — React hook wrapping DammaOnlineClient
// =============================================================================
// Phase 5: Real-time multiplayer plumbing for the online Damma screen.
//
// Returns a DammaState-compatible object so the existing presentation
// components (WoodenTable, HandTray, PlayerChip, BoneyardPanel) can render
// it without modification. All gameplay actions go through the WebSocket
// instead of the local engine — the server is the single source of truth.
//
// Responsibilities:
//   • Open WS, subscribe to room/state/chat/end/error events.
//   • Reconcile server payloads into a local React state.
//   • Track which slot ("playerX") corresponds to the current user.
//   • Maintain a small in-memory chat log for the GameCommsBar.
//   • Reconnect gracefully if the socket drops mid-match.
// =============================================================================
import { useEffect, useRef, useState, useCallback } from "react";
import {
  DammaOnlineClient, RoomSnapshot, OnlineGameState, OnlineHand, getDammaClient,
} from "./online";
import type {
  DammaState, PlayerId, PlacedDomino, Domino,
} from "./engine";

export interface DammaOnlineChatMsg {
  id: string;
  from: string;
  text: string;
  ts: number;
}

export interface DammaOnlineEnd {
  winner: PlayerId | null;
  scores: Record<string, number>;
}

export interface UseDammaOnlineOptions {
  /** When false the hook is inert — useful while route params still loading. */
  enabled: boolean;
  rid: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

export interface UseDammaOnlineReturn {
  /** WebSocket connection lifecycle. */
  connecting: boolean;
  connected: boolean;
  reconnecting: boolean;
  error: string | null;

  /** Authoritative server-driven game state (compatible with offline screen). */
  state: DammaState | null;
  /** The pid that maps to the current user (e.g. "player1"). */
  mePid: PlayerId | null;
  /** Latest room snapshot (slots, scores, tile counts, etc.). */
  room: RoomSnapshot | null;
  /** Server-reported seconds remaining in the active turn. */
  turnSecondsLeft: number;

  /** Live chat log. */
  chatMsgs: DammaOnlineChatMsg[];
  /** End-of-match payload (null while still playing). */
  endResult: DammaOnlineEnd | null;

  // ── Outgoing actions (all no-op while disconnected). ────────────────────
  play: (tileId: string, side: "left" | "right") => void;
  draw: () => void;
  pass: () => void;
  sendChat: (text: string) => void;
  disconnect: () => Promise<void>;
}

// Build a DammaState shape from the server's payload so the existing
// presentation components keep working without changes.
function reconcileState(
  prev: DammaState | null,
  room: RoomSnapshot,
  online: OnlineGameState,
  hand: OnlineHand[],
  mePid: PlayerId,
): DammaState {
  const n = room.num_players;
  const players: PlayerId[] = Array.from({ length: n }, (_, i) => (`player${i + 1}`) as PlayerId);

  // Hands: I see my own; opponents' hands are represented as N face-down
  // placeholders so PlayerChip's tile counter is still correct. The face-down
  // tiles never get rendered because they live behind chip-only UI.
  const hands = {} as Record<PlayerId, Domino[]>;
  for (const pid of players) {
    if (pid === mePid) {
      hands[pid] = hand.map((t) => ({ id: t.id, left: t.left, right: t.right }));
    } else {
      const count = room.tile_counts?.[pid] ?? 0;
      hands[pid] = Array.from({ length: count }, (_, i) => ({
        id: `${pid}_hidden_${i}`, left: -1, right: -1,
      }));
    }
  }

  const board: PlacedDomino[] = (online.board || []).map((t) => ({
    id: t.id, left: t.left, right: t.right, flipped: false,
  }));

  // Map server "phase" string → engine phase + winner detection.
  let phase: DammaState["phase"] = "playing";
  let winner: PlayerId | null = null;
  if (room.phase === "game_over") {
    phase = "game_over";
    // Winner is determined by an "end" payload; we'll set it externally too.
    winner = prev?.winner ?? null;
  }

  return {
    players,
    hands,
    board,
    leftEnd: online.left_end,
    rightEnd: online.right_end,
    boneyard: Array.from({ length: room.boneyard_count }, (_, i) => ({
      id: `boneyard_${i}`, left: -1, right: -1,
    })),
    turn: (room.turn || "player1") as PlayerId,
    scores: {
      player1: room.scores?.player1 ?? 0,
      player2: room.scores?.player2 ?? 0,
      player3: room.scores?.player3 ?? 0,
      player4: room.scores?.player4 ?? 0,
    } as Record<PlayerId, number>,
    phase,
    winner,
    passCount: 0,
  };
}

export function useDammaOnline(opts: UseDammaOnlineOptions): UseDammaOnlineReturn {
  const { enabled, rid, userId, userName, userAvatar } = opts;

  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [state, setState] = useState<DammaState | null>(null);
  const [chatMsgs, setChatMsgs] = useState<DammaOnlineChatMsg[]>([]);
  const [endResult, setEndResult] = useState<DammaOnlineEnd | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(60);

  const clientRef = useRef<DammaOnlineClient | null>(null);
  const mePidRef = useRef<PlayerId | null>(null);
  const stateRef = useRef<DammaState | null>(null);
  const reconnectAttempt = useRef(0);
  const teardownRef = useRef(false);

  // Keep stateRef in sync so we can rebuild a DammaState shape from the
  // latest snapshot without re-reading useState (which would be stale).
  useEffect(() => { stateRef.current = state; }, [state]);

  // Resolve "me" — find the slot that matches my userId. Falls back to slot
  // 0 if we can't (host-only quick join scenarios in dev).
  const resolveMePid = useCallback((r: RoomSnapshot): PlayerId | null => {
    const mine = r.slots.find((s) => s.user_id === userId);
    if (mine) return mine.pid as PlayerId;
    return null;
  }, [userId]);

  // ── Open the socket whenever `enabled && rid` is set ──────────────────────
  useEffect(() => {
    if (!enabled || !rid || !userId) return;
    teardownRef.current = false;
    const client = getDammaClient();
    clientRef.current = client;

    const open = async () => {
      setError(null);
      setConnecting(true);
      try {
        // Make sure we have a slot in the room first. If the room was just
        // matched (queue auto-create), the server already placed us; but on
        // direct-link entry we may need an explicit join.
        try {
          await client.joinRoom(rid, userId, userName, userAvatar || "avatar_ninja");
        } catch {
          // Already in room or room full — non-fatal.
        }

        await client.connect(rid, userId, {
          onRoom: (r) => {
            setRoom(r);
            const pid = resolveMePid(r);
            if (pid) mePidRef.current = pid;
            setTurnSecondsLeft(Math.max(0, r.turn_seconds_left || 0));
            // If we have no game state yet but the room snapshot says we're
            // in lobby, expose a minimal placeholder so the board can still
            // render its "waiting" emptiness.
            if (!stateRef.current && r.phase === "lobby" && pid) {
              const placeholder: DammaState = {
                players: Array.from({ length: r.num_players }, (_, i) => (`player${i + 1}`) as PlayerId),
                hands: {
                  player1: [], player2: [], player3: [], player4: [],
                } as Record<PlayerId, Domino[]>,
                board: [],
                leftEnd: null,
                rightEnd: null,
                boneyard: [],
                turn: (r.turn || "player1") as PlayerId,
                scores: {
                  player1: 0, player2: 0, player3: 0, player4: 0,
                } as Record<PlayerId, number>,
                phase: "playing",
                winner: null,
                passCount: 0,
              };
              setState(placeholder);
              stateRef.current = placeholder;
            }
          },
          onState: (g, hand, r) => {
            setRoom(r);
            const pid = resolveMePid(r);
            if (pid) mePidRef.current = pid;
            const next = reconcileState(stateRef.current, r, g, hand, pid || "player1");
            setState(next);
            setTurnSecondsLeft(Math.max(0, r.turn_seconds_left || 0));
          },
          onChat: (m) => {
            setChatMsgs((prev) => [
              ...prev,
              { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                from: m.from, text: m.text, ts: Date.now() },
            ].slice(-200));
          },
          onEnd: (e) => {
            // Map server's `winner` ("player2"…) → DammaState.winner.
            setEndResult({ winner: (e.winner as PlayerId) || null, scores: e.scores });
            setState((prev) => prev ? { ...prev, phase: "game_over", winner: (e.winner as PlayerId) || null } : prev);
          },
          onError: (m) => {
            setError(m || "Unknown error");
          },
          onClose: () => {
            setConnected(false);
            if (teardownRef.current) return;
            // Try to reconnect a few times with backoff before giving up.
            if (reconnectAttempt.current < 5) {
              reconnectAttempt.current += 1;
              setReconnecting(true);
              const wait = Math.min(8000, 600 * 2 ** reconnectAttempt.current);
              setTimeout(() => {
                if (teardownRef.current) return;
                open().catch(() => {});
              }, wait);
            } else {
              setError("تعذر الاتصال بالخادم. أعد المحاولة.");
              setReconnecting(false);
            }
          },
        });
        reconnectAttempt.current = 0;
        setReconnecting(false);
        setConnected(true);
      } catch (e: any) {
        setError(String(e?.message || e || "connect failed"));
      } finally {
        setConnecting(false);
      }
    };

    open().catch(() => {});

    return () => {
      teardownRef.current = true;
      try { clientRef.current?.disconnect(); } catch {}
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rid, userId]);

  // ── Server-driven countdown (decrement once per second). We keep the local
  // timer in sync but trust the next `state` push to snap it back.
  useEffect(() => {
    if (!connected || !room || room.phase !== "playing") return;
    const id = setInterval(() => {
      setTurnSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, room?.phase, room?.turn]);

  // ── Action helpers — all no-op until connected. ───────────────────────────
  const play = useCallback((tileId: string, side: "left" | "right") => {
    if (!connected) return;
    clientRef.current?.play(tileId, side);
  }, [connected]);
  const draw = useCallback(() => {
    if (!connected) return;
    clientRef.current?.draw();
  }, [connected]);
  const pass = useCallback(() => {
    if (!connected) return;
    clientRef.current?.pass();
  }, [connected]);
  const sendChat = useCallback((text: string) => {
    if (!connected || !text.trim()) return;
    clientRef.current?.chat(text.trim());
  }, [connected]);
  const disconnect = useCallback(async () => {
    teardownRef.current = true;
    try { clientRef.current?.disconnect(); } catch {}
    try {
      if (rid && userId) {
        // Best-effort REST leave so server can free the slot.
        await getDammaClient().leaveRoom(rid, userId, userName);
      }
    } catch {}
    setConnected(false);
  }, [rid, userId, userName]);

  return {
    connecting,
    connected,
    reconnecting,
    error,
    state,
    mePid: mePidRef.current,
    room,
    turnSecondsLeft,
    chatMsgs,
    endResult,
    play, draw, pass, sendChat, disconnect,
  };
}
