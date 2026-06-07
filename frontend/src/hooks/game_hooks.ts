// =============================================================================
// src/hooks/useErrorReporter.ts — Automatic error reporting to backend
// =============================================================================
import { useCallback } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { reportError } from "../api/games";

interface ReportPayload {
  error_code: string;
  message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
}

export function useErrorReporter() {
  const report = useCallback(async (payload: ReportPayload) => {
    try {
      await reportError({
        error_code:   payload.error_code,
        message:      payload.message,
        stack_trace:  payload.stack_trace,
        device_info: {
          platform: Platform.OS,
          version:  Platform.Version,
          context:  payload.context ?? {},
        },
        app_version: Constants.expoConfig?.version ?? "unknown",
      });
    } catch {
      // Never throw from error reporter
    }
  }, []);

  const reportCatch = useCallback((err: unknown, context?: Record<string, unknown>) => {
    const error = err instanceof Error ? err : new Error(String(err));
    report({
      error_code:  error.name || "UNKNOWN_ERROR",
      message:     error.message,
      stack_trace: error.stack,
      context,
    });
  }, [report]);

  return { report, reportCatch };
}


// =============================================================================
// src/hooks/useRank.ts — Rank utilities hook
// =============================================================================
import { useMemo } from "react";
import { getRankForRating, getRankProgress, getNextRank, pointsToNextRank, isMaxRank } from "../constants/ranks";
import { useGame } from "../context/GameContext";
import { GameType } from "../api/games";

export function useRank(gameType?: GameType) {
  const { myStats } = useGame();

  return useMemo(() => {
    const stat   = gameType ? myStats.find(s => s.game_type === gameType) : null;
    const rating = stat?.rating ?? 0;
    const rank   = getRankForRating(rating);
    return {
      rating,
      rank,
      progress:       getRankProgress(rating),
      nextRank:       getNextRank(rating),
      pointsToNext:   pointsToNextRank(rating),
      isMax:          isMaxRank(rating),
    };
  }, [myStats, gameType]);
}


// =============================================================================
// src/hooks/useGameSession.ts — Active game session hook
// =============================================================================
import { useState, useEffect, useRef } from "react";
import { useGame } from "../context/GameContext";
import { getGameSession, GameSession } from "../api/games";

export function useGameSession(sessionId: string | null) {
  const { connectGameWs, disconnectGameWs, sendGameEvent, activeSession, setActiveSession } = useGame();
  const [session,   setSession]   = useState<GameSession | null>(null);
  const [gameOver,  setGameOver]  = useState(false);
  const [winnerId,  setWinnerId]  = useState<string | null>(null);
  const [messages,  setMessages]  = useState<Array<{ from: string; text: string; ts: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Load session data
    getGameSession(sessionId)
      .then(setSession)
      .catch(() => {});

    // Connect game WS
    connectGameWs(sessionId);

    return () => { disconnectGameWs(); };
  }, [sessionId]);

  // Handle incoming WS messages from GameContext
  // (GameContext stores ws ref; hook subscribes via onmessage override)

  const sendMove = (move: object, moveNumber: number) => {
    sendGameEvent({ type: "move", move, move_number: moveNumber });
  };

  const sendChat = (text: string) => {
    sendGameEvent({ type: "chat", text });
  };

  const resign = () => {
    sendGameEvent({ type: "resign" });
  };

  const offerDraw = () => {
    sendGameEvent({ type: "draw_offer" });
  };

  return {
    session,
    gameOver,
    winnerId,
    messages,
    sendMove,
    sendChat,
    resign,
    offerDraw,
  };
}
