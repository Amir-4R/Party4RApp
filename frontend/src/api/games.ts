// =============================================================================
// src/api/games.ts — Party4R Complete Games API Client
// =============================================================================
import { apiGet, apiPost, apiPatch, BACKEND_HOST } from "./client";

export type GameType = "chess" | "carrom" | "damma";
export type GameStatus = "waiting" | "active" | "finished" | "cancelled";
export type MatchmakingMode = "random" | "friends" | "private" | "tournament";

export interface GameSession {
  id: string; game_type: GameType; mode: MatchmakingMode; status: GameStatus;
  host_id: string; winner_id?: string; move_count: number;
  state: Record<string, unknown>; started_at?: string; created_at: string;
}
export interface GameInvitation {
  id: string; from_user_id: string; to_user_id: string; game_type: GameType;
  status: "pending"|"accepted"|"declined"|"expired"; expires_at: string; created_at?: string;
}
export interface PlayerStats {
  user_id: string; game_type: GameType; rating: number;
  wins: number; losses: number; draws: number; total_games: number;
  best_streak: number; current_streak: number;
}
export interface LeaderboardEntry {
  rank: number; user_id: string; nickname: string; avatar: string;
  rating: number; wins: number;
}
export interface Achievement {
  id: string; game_type?: GameType; title: string; title_ar: string;
  condition_type: string; condition_value: number; reward_points: number;
  unlocked?: boolean; progress?: number;
}
export interface DailyMission {
  id: string; title: string; title_ar: string; game_type?: GameType;
  target: number; progress: number; reward_points: number;
  completed: boolean; claimed: boolean;
}
export interface Tournament {
  id: string; title: string; title_ar: string; game_type: GameType;
  status: "upcoming"|"registration"|"active"|"finished"; format: string;
  max_players: number; prize_pool?: string;
  start_time: string; registration_deadline: string;
}

// ── Game Sessions ─────────────────────────────────────────────────────────────
export const getAvailableGames   = () => apiGet("/games");
export const createGameSession   = (game_type: GameType, mode: MatchmakingMode = "random") =>
  apiPost<GameSession>("/games/sessions", { game_type, mode });
export const getActiveSession    = () => apiGet<GameSession | null>("/games/sessions/active");
export const getGameSession      = (id: string) => apiGet<GameSession>(`/games/sessions/${id}`);
export const joinGameSession     = (id: string) => apiPost<GameSession>(`/games/sessions/${id}/join`);
export const submitMove          = (id: string, move: object, move_number: number) =>
  apiPost(`/games/sessions/${id}/move`, { move, move_number });
export const resignGame          = (id: string) => apiPost(`/games/sessions/${id}/resign`);

// ── Matchmaking ───────────────────────────────────────────────────────────────
export const joinMatchmakingQueue  = (game_type: GameType) => apiPost("/games/matchmaking/join", { game_type });
export const leaveMatchmakingQueue = (game_type: GameType) => apiPost("/games/matchmaking/leave", { game_type });

// ── Invitations ───────────────────────────────────────────────────────────────
export const getMyInvitations   = () => apiGet<GameInvitation[]>("/games/invitations");
export const sendGameInvitation = (to_user_id: string, game_type: GameType) =>
  apiPost<GameInvitation>("/games/invitations", { to_user_id, game_type });
export const acceptInvitation   = (id: string) => apiPost(`/games/invitations/${id}/accept`);
export const declineInvitation  = (id: string) => apiPost(`/games/invitations/${id}/decline`);

// ── Stats & Leaderboard ───────────────────────────────────────────────────────
export const getMyStats      = () => apiGet<PlayerStats[]>("/games/stats/me");
export const getPlayerStats  = (uid: string, game: GameType) => apiGet<PlayerStats>(`/games/stats/${uid}/${game}`);
export const getLeaderboard  = (game: GameType, limit = 50) =>
  apiGet<LeaderboardEntry[]>(`/games/leaderboard/${game}?limit=${limit}`);

// ── Achievements ──────────────────────────────────────────────────────────────
export const getAchievements   = () => apiGet<Achievement[]>("/games/achievements");
export const getMyAchievements = () => apiGet<Achievement[]>("/games/achievements/me");

// ── Daily Missions ────────────────────────────────────────────────────────────
export const getDailyMissions = () => apiGet<DailyMission[]>("/games/missions/daily");
export const claimMission     = (id: string) => apiPost(`/games/missions/${id}/claim`);

// ── Tournaments ───────────────────────────────────────────────────────────────
export const getTournaments      = () => apiGet<Tournament[]>("/games/tournaments");
export const getTournament       = (id: string) => apiGet<Tournament>(`/games/tournaments/${id}`);
export const enrollInTournament  = (id: string) => apiPost(`/games/tournaments/${id}/enroll`);

// ── Error Reporting ───────────────────────────────────────────────────────────
export const reportError = (payload: {
  error_code: string; message: string; stack_trace?: string;
  device_info?: object; app_version?: string;
}) => apiPost("/errors/report", payload);

// ── WebSocket URLs ────────────────────────────────────────────────────────────
export function getGameWsUrl(sessionId: string, token: string): string {
  return `${BACKEND_HOST.replace(/^http/, "ws")}/api/ws/games/${sessionId}?token=${encodeURIComponent(token)}`;
}
export function getMatchmakingWsUrl(token: string): string {
  return `${BACKEND_HOST.replace(/^http/, "ws")}/api/ws/matchmaking?token=${encodeURIComponent(token)}`;
}
export function getNotificationsWsUrl(token: string): string {
  return `${BACKEND_HOST.replace(/^http/, "ws")}/api/ws/notifications?token=${encodeURIComponent(token)}`;
}
