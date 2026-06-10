// =============================================================================
// damma/online-arch/matchClient.ts — PUBLIC API consumed by screens & lobby
// =============================================================================
// This is the ONE module the rest of the app should import. It wraps the mock
// service today and will wrap a real WebSocket client tomorrow — callers will
// not need to change a single line.
//
// The flag `ONLINE_ENABLED` is read from `EXPO_PUBLIC_DAMMA_ONLINE` at runtime
// so we can ship the architecture today, switch to the real backend by setting
// the env var, and roll back instantly if anything misbehaves.
// =============================================================================
import type {
  GameState, Match, MatchLobby, MatchSettings,
  OnlineConnectionStatus, Player, PlayerMove, ServerEvent,
} from "./types";
import { mockService } from "./mockService";

// ── Feature flag ─────────────────────────────────────────────────────────────
export const ONLINE_ENABLED: boolean =
  String(process.env.EXPO_PUBLIC_DAMMA_ONLINE ?? "false").toLowerCase() === "true";

// Today we always use the mock. When ONLINE_ENABLED becomes true we will swap
// in `realService` (a thin wrapper around the existing damma/online.ts WS
// client). The signatures will remain identical — see /online-arch/types.ts.
const service = mockService;

// ── Connection-status broadcaster ─────────────────────────────────────────────
class ConnectionStatusEmitter {
  private status: OnlineConnectionStatus = "idle";
  private listeners = new Set<(s: OnlineConnectionStatus) => void>();

  get(): OnlineConnectionStatus { return this.status; }

  set(next: OnlineConnectionStatus) {
    if (this.status === next) return;
    this.status = next;
    this.listeners.forEach((l) => l(next));
  }

  subscribe(listener: (s: OnlineConnectionStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status); // emit current immediately
    return () => this.listeners.delete(listener);
  }
}
export const connectionStatus = new ConnectionStatusEmitter();

// =============================================================================
//                           PUBLIC API (Phase 5 scaffold)
// =============================================================================
// All 9 functions the user requested. The signatures are stable — swap the
// internal `service` to a real WS implementation later without touching any
// caller.
// =============================================================================

/** Create a new match (the caller becomes the host). */
export async function createMatch(host: Player, settings?: Partial<MatchSettings>): Promise<Match> {
  connectionStatus.set("connecting");
  const m = await service.createMatch(host, settings);
  connectionStatus.set("connected");
  return m;
  // 📡 BACKEND HOOK: replace `service.createMatch` with WS "create_match" message.
}

/** Join an existing match by id (typically via invite code or matchmaking). */
export async function joinMatch(matchId: string, player: Player): Promise<Match | null> {
  connectionStatus.set("connecting");
  const m = await service.joinMatch(matchId, player);
  connectionStatus.set(m ? "connected" : "error");
  return m;
}

/** Send invitations to friends — a no-op in mock mode. */
export async function inviteFriends(matchId: string, friendIds: string[]): Promise<void> {
  return service.inviteFriends(matchId, friendIds);
}

/** Join the public matchmaking queue and resolve with a match. */
export async function publicMatchmaking(player: Player, mode: "1v1" | "4p"): Promise<Match> {
  connectionStatus.set("connecting");
  const match = await service.publicMatchmaking(player, mode);
  connectionStatus.set("connected");
  return match;
}

/** Send the local player's move to the server. */
export async function sendMove(matchId: string, playerId: string, move: PlayerMove): Promise<void> {
  return service.sendMove(matchId, playerId, move);
}

/** Subscribe to remote move/state events. Returns an unsubscribe function. */
export function receiveMove(
  matchId: string,
  listener: (ev: ServerEvent) => void,
): () => void {
  return service.subscribe(matchId, listener);
}

/** Fetch the authoritative game state from the server (e.g. on reconnect). */
export async function syncGameState(matchId: string): Promise<GameState | null> {
  return service.syncGameState(matchId);
}

/** Resume a match after a transient disconnect. */
export async function reconnectToMatch(matchId: string, playerId: string) {
  connectionStatus.set("reconnecting");
  const out = await service.reconnectToMatch(matchId, playerId);
  connectionStatus.set(out ? "connected" : "error");
  return out;
}

/** Permanently leave a match. */
export async function leaveMatch(matchId: string, playerId: string): Promise<void> {
  await service.leaveMatch(matchId, playerId);
  connectionStatus.set("idle");
}

// =============================================================================
//                             LOBBY HELPERS
// =============================================================================
// Convenience read-only accessors used by the lobby screen.
export async function getLobby(matchId: string): Promise<MatchLobby | null> {
  return service._peekLobby(matchId) ?? null;
}

export function isAllReady(lobby: MatchLobby): boolean {
  if (!lobby) return false;
  const occupied = lobby.slots.every((s) => s.player !== null);
  const readyEveryone = lobby.slots.every((s) => s.ready || s.player === null);
  return occupied && readyEveryone;
}

// =============================================================================
//                  Default export — grouped helper namespace
// =============================================================================
const matchClient = {
  ONLINE_ENABLED,
  connectionStatus,
  createMatch,
  joinMatch,
  inviteFriends,
  publicMatchmaking,
  sendMove,
  receiveMove,
  syncGameState,
  reconnectToMatch,
  leaveMatch,
  getLobby,
  isAllReady,
};
export default matchClient;
