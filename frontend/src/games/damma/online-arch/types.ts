// =============================================================================
// damma/online-arch/types.ts — SHARED ONLINE TYPES (Phase 5 scaffold)
// =============================================================================
// All TypeScript contracts the Damma online layer will speak with the future
// backend. Engine, UI and service files all import from here so that swapping
// the mock service for a real WebSocket implementation does not require any
// changes outside of /online-arch/.
//
// ZERO runtime cost — these are types only (except for the const enums which
// are erased at compile time).
// =============================================================================

import type { Domino, PlacedDomino, PlayerId } from "@/src/games/damma/engine";

// ── Re-export DominoTile under the user-requested name ───────────────────────
export type DominoTile = Domino;
export type PlacedDominoTile = PlacedDomino;

// ── PLAYER ───────────────────────────────────────────────────────────
export interface Player {
  /** Permanent unique user id (Mongo ObjectId / UUID). */
  id: string;
  /** Display name shown in lobbies and during play. */
  name: string;
  /** Avatar identifier OR remote URL. */
  avatar: string;
  /** Has this player tapped "Ready" in the lobby? */
  ready?: boolean;
  /** True if this is a local AI bot rather than a real online player. */
  isBot?: boolean;
  /** Bot difficulty when isBot===true ("easy" | "medium" | "hard"). */
  botDifficulty?: "easy" | "medium" | "hard";
  /** True when the player has lost connection but the match is still waiting. */
  disconnected?: boolean;
  /** Last time the player was seen (epoch ms). Useful for timeout decisions. */
  lastSeenAt?: number;
}

// ── MATCH SETTINGS ────────────────────────────────────────────────────────
export type MatchVisibility = "public" | "friends" | "mixed" | "private";
export type MatchMode = "1v1" | "4p";

export interface MatchSettings {
  /** "1v1" (2 seats) or "4p" (4 seats). */
  mode: MatchMode;
  /** Who can see and join the room. */
  visibility: MatchVisibility;
  /** Per-turn seconds (default 60). */
  turnSeconds: number;
  /** Target score to win the series (e.g. 150 — 0 disables). */
  targetScore?: number;
  /** Game variant identifier. "classic" is the only one shipped today. */
  variant: "classic";
}

export function defaultMatchSettings(mode: MatchMode = "4p"): MatchSettings {
  return { mode, visibility: "private", turnSeconds: 60, targetScore: 0, variant: "classic" };
}

// ── MATCH ─────────────────────────────────────────────────────────────
export type MatchPhase =
  | "lobby"           // gathering players
  | "countdown"        // 3-2-1 before first move
  | "playing"          // active match
  | "paused"           // somebody is reconnecting
  | "ended";           // match concluded

export interface Match {
  /** Stable match/room id. */
  id: string;
  /** Match settings applied to this room. */
  settings: MatchSettings;
  /** All 2 or 4 seats. `null` means the seat is currently empty. */
  seats: (Player | null)[];
  /** Engine player slot that has the turn ("player1".. "player4") or null in lobby. */
  currentTurn: PlayerId | null;
  /** Current high-level lifecycle phase. */
  phase: MatchPhase;
  /** Host user id (creator of the room). */
  hostId: string;
  /** Created at (epoch ms). */
  createdAt: number;
  /** Optional invitation code that friends can use to join. */
  inviteCode?: string;
}

// ── LOBBY ──────────────────────────────────────────────────────────────
export type SlotKind = "host" | "friend" | "bot" | "public" | "empty";

export interface MatchLobbySlot {
  /** Which type of participant occupies this seat. */
  kind: SlotKind;
  /** Player metadata when occupied (else null). */
  player: Player | null;
  /** Did the player tap Ready? */
  ready: boolean;
  /** If kind==="public", whether the host has opened this seat to matchmaking. */
  openToPublic?: boolean;
}

export interface MatchLobby {
  /** Reference to the match this lobby belongs to (matches Match.id). */
  matchId: string;
  /** Match settings the host configured. */
  settings: MatchSettings;
  /** Exactly 2 (1v1) or 4 (4p) slots — always in seat order. */
  slots: MatchLobbySlot[];
  /** Host user id. */
  hostId: string;
  /** Are all slots filled and every player ready? */
  allReady: boolean;
}

// ── GAME STATE (transport-friendly snapshot) ────────────────────────────────
// We mirror the engine's `DammaState` shape but make it serialisable and add a
// monotonically-increasing `version` for optimistic-concurrency / replay logic.
export interface GameState {
  matchId: string;
  /** Strictly increasing — server bumps it on every authoritative update. */
  version: number;
  /** Whose turn is it? */
  turn: PlayerId;
  /** Tiles laid on the board (left → right). */
  board: PlacedDominoTile[];
  /** Current ends used to decide playability. */
  leftEnd: number | null;
  rightEnd: number | null;
  /** Counts of remaining tiles per player (hands are private except yours). */
  handCounts: Record<PlayerId, number>;
  /** YOUR private hand only — server should NEVER send other players' hands. */
  myHand: DominoTile[];
  /** Remaining tiles in the boneyard (count only — never the actual pieces). */
  boneyardCount: number;
  /** Cumulative scores. */
  scores: Record<PlayerId, number>;
  /** Match phase. */
  phase: MatchPhase;
  /** Engine "options" (mustDraw / mustPass / playable tile ids for ME). */
  myOptions: {
    mustDraw: boolean;
    mustPass: boolean;
    playableTileIds: string[];
  };
}

// ── MOVE ───────────────────────────────────────────────────────────────
export type MoveKind = "play" | "draw" | "pass";

export interface PlayerMove {
  /** "play" — lay a tile / "draw" — take from boneyard / "pass" — skip turn. */
  kind: MoveKind;
  /** For "play" — the tile id being placed. */
  tileId?: string;
  /** For "play" — which side of the chain ("left" | "right"). */
  side?: "left" | "right";
  /** Optional client-side timestamp (epoch ms) for latency analysis. */
  clientTs?: number;
}

// ── CONNECTION STATUS ───────────────────────────────────────────────────
export type OnlineConnectionStatus =
  | "idle"          // not connected, no attempt in flight
  | "connecting"    // initial handshake
  | "connected"     // ready to send/receive
  | "reconnecting"  // transient drop, attempting recovery
  | "disconnected"  // gave up after retries
  | "error";        // hard failure (auth, server gone, etc.)

// ── SERVER EVENTS ───────────────────────────────────────────────────────────
export type ServerEvent =
  | { type: "lobby_update";   lobby: MatchLobby }
  | { type: "match_started";  match: Match;  state: GameState }
  | { type: "state_update";   state: GameState }
  | { type: "player_moved";   playerId: string; move: PlayerMove; state: GameState }
  | { type: "player_left";    playerId: string; matchId: string }
  | { type: "player_joined";  player: Player; matchId: string }
  | { type: "match_ended";    matchId: string; winnerId: string | null;
                              finalScores: Record<PlayerId, number> }
  | { type: "error";          code: string; message: string };
