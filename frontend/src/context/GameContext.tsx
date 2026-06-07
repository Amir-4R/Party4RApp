// =============================================================================
// src/context/GameContext.tsx — Party4R Game State Management
// =============================================================================
// Global context that manages:
//   - Active game session state
//   - Pending invitations count (for badge on tab)
//   - Matchmaking queue status
//   - WebSocket connection for active game
//
// PHASE 1: Structure + invitation badge counter.
// PHASE 2+: Full WebSocket game logic will be wired here.
// =============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import {
  GameSession,
  GameInvitation,
  PlayerStats,
  DailyMission,
  getMyInvitations,
  getMyActiveSessions,
  getMyStats,
  getDailyMissions,
  getGameWsUrl,
  GameType,
} from "../api/games";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchmakingStatus = "idle" | "queued" | "found";

interface GameContextValue {
  // Current active game session (if in a game)
  activeSession: GameSession | null;
  setActiveSession: (s: GameSession | null) => void;

  // Pending invitations (drives the badge on the "Play" tab)
  pendingInvitations: GameInvitation[];
  pendingInvitationsCount: number;
  refreshInvitations: () => Promise<void>;

  // Matchmaking
  matchmakingStatus: MatchmakingStatus;
  matchmakingGame: GameType | null;
  setMatchmaking: (status: MatchmakingStatus, game?: GameType | null) => void;

  // My stats (all games)
  myStats: PlayerStats[];
  refreshStats: () => Promise<void>;

  // Daily missions
  dailyMissions: DailyMission[];
  completedMissionsToday: number;
  refreshMissions: () => Promise<void>;

  // Total unread game notifications (invites + missions ready)
  totalBadgeCount: number;

  // WebSocket for active game session
  gameWs: WebSocket | null;
  connectGameWs: (sessionId: string) => void;
  disconnectGameWs: () => void;
  sendGameEvent: (event: Record<string, unknown>) => void;

  // Loading
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();

  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<GameInvitation[]>([]);
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus>("idle");
  const [matchmakingGame, setMatchmakingGame] = useState<GameType | null>(null);
  const [myStats, setMyStats] = useState<PlayerStats[]>([]);
  const [dailyMissions, setDailyMissions] = useState<DailyMission[]>([]);
  const [loading, setLoading] = useState(false);

  const gameWsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const pendingInvitationsCount = pendingInvitations.filter(
    (inv) => inv.status === "pending"
  ).length;

  const completedMissionsToday = dailyMissions.filter((m) => m.completed).length;

  // Badge = pending invitations (missions badge handled separately if needed)
  const totalBadgeCount = pendingInvitationsCount;

  // ---------------------------------------------------------------------------
  // Refresh helpers (safe — won't crash if backend not ready yet)
  // ---------------------------------------------------------------------------

  const refreshInvitations = useCallback(async () => {
    if (!user) return;
    try {
      const invs = await getMyInvitations();
      setPendingInvitations(invs);
    } catch {
      // Backend game endpoints not yet deployed — silently ignore
    }
  }, [user]);

  const refreshStats = useCallback(async () => {
    if (!user) return;
    try {
      const stats = await getMyStats();
      setMyStats(stats);
    } catch {
      // Silently ignore until backend is ready
    }
  }, [user]);

  const refreshMissions = useCallback(async () => {
    if (!user) return;
    try {
      const missions = await getDailyMissions();
      setDailyMissions(missions);
    } catch {
      // Silently ignore until backend is ready
    }
  }, [user]);

  // ---------------------------------------------------------------------------
  // Initial load + polling for invitations
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) {
      // Clear state on logout
      setPendingInvitations([]);
      setMyStats([]);
      setDailyMissions([]);
      setActiveSession(null);
      return;
    }

    // Initial fetch
    setLoading(true);
    Promise.all([refreshInvitations(), refreshStats(), refreshMissions()]).finally(
      () => setLoading(false)
    );

    // Poll for new invitations every 30 seconds (phase 1 — polling; phase 3 will
    // replace this with a push notification or WebSocket event)
    pollIntervalRef.current = setInterval(() => {
      refreshInvitations();
    }, 30_000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user, refreshInvitations, refreshStats, refreshMissions]);

  // Refresh invitations when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") refreshInvitations();
    });
    return () => sub.remove();
  }, [refreshInvitations]);

  // ---------------------------------------------------------------------------
  // Matchmaking state setter
  // ---------------------------------------------------------------------------

  const setMatchmaking = useCallback(
    (status: MatchmakingStatus, game: GameType | null = null) => {
      setMatchmakingStatus(status);
      setMatchmakingGame(game);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Game WebSocket (for active game sessions)
  // ---------------------------------------------------------------------------

  const connectGameWs = useCallback(
    (sessionId: string) => {
      if (!token) return;
      // Close any existing connection
      if (gameWsRef.current) {
        gameWsRef.current.close();
        gameWsRef.current = null;
      }

      const url = getGameWsUrl(sessionId, token);
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[GameWS] Connected to game session:", sessionId);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          // Phase 2: dispatch to game-specific handlers
          // For now, log to confirm connectivity
          console.log("[GameWS] message:", msg.type);
        } catch {
          // ignore malformed
        }
      };

      ws.onerror = () => {
        console.warn("[GameWS] Error — will attempt reconnect");
      };

      ws.onclose = () => {
        console.log("[GameWS] Connection closed");
        gameWsRef.current = null;
      };

      gameWsRef.current = ws;
    },
    [token]
  );

  const disconnectGameWs = useCallback(() => {
    if (gameWsRef.current) {
      gameWsRef.current.close();
      gameWsRef.current = null;
    }
    setActiveSession(null);
    setMatchmaking("idle");
  }, [setMatchmaking]);

  const sendGameEvent = useCallback((event: Record<string, unknown>) => {
    const ws = gameWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(event));
  }, []);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      if (gameWsRef.current) gameWsRef.current.close();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Provide
  // ---------------------------------------------------------------------------

  return (
    <GameContext.Provider
      value={{
        activeSession,
        setActiveSession,
        pendingInvitations,
        pendingInvitationsCount,
        refreshInvitations,
        matchmakingStatus,
        matchmakingGame,
        setMatchmaking,
        myStats,
        refreshStats,
        dailyMissions,
        completedMissionsToday,
        refreshMissions,
        totalBadgeCount,
        gameWs: gameWsRef.current,
        connectGameWs,
        disconnectGameWs,
        sendGameEvent,
        loading,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
