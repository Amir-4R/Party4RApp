// =============================================================================
// damma/online-arch/mockService.ts — in-memory stand-in for the real WS service
// =============================================================================
// Implements the SAME interface the real WebSocket transport will expose, but
// stores every match in process memory and uses setTimeout to fake async
// latency. The UI cannot tell the difference, which means we can develop and
// E2E-test every screen offline before the server is wired up.
//
// ⚖️  ALL FUNCTIONS in this file should remain side-effect-free of the rest of
// the codebase — they only touch their own internal `state` object. Replace
// this file with `realService.ts` later and the public API will keep working.
// =============================================================================
import type {
  GameState, Match, MatchLobby, MatchSettings, Player, PlayerMove,
  ServerEvent, SlotKind,
} from "./types";
import { defaultMatchSettings } from "./types";
import { makeMockGameState } from "./mockData";

// ── Helpers ──────────────────────────────────────────────────────────────────
function randomId(prefix = "m"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyLobby(match: Match, openSlots: SlotKind[]): MatchLobby {
  return {
    matchId: match.id,
    settings: match.settings,
    hostId: match.hostId,
    slots: openSlots.map((kind, i) => ({
      kind,
      player: i === 0 ? match.seats[0] : null,
      ready: i === 0 ? (match.seats[0]?.ready ?? false) : false,
      openToPublic: kind === "public",
    })),
    allReady: false,
  };
}

// ── In-memory store ─────────────────────────────────────────────────────────────
interface MockStore {
  matches: Record<string, Match>;
  lobbies: Record<string, MatchLobby>;
  gameStates: Record<string, GameState>;
  publicQueue: { player: Player; mode: "1v1" | "4p"; joinedAt: number }[];
  // Event subscribers keyed by matchId so we only fan-out where relevant.
  subscribers: Record<string, Set<(e: ServerEvent) => void>>;
}

const store: MockStore = {
  matches: {},
  lobbies: {},
  gameStates: {},
  publicQueue: [],
  subscribers: {},
};

function emit(matchId: string, ev: ServerEvent) {
  store.subscribers[matchId]?.forEach((cb) => {
    // Simulate ~50 ms network latency to be realistic.
    setTimeout(() => cb(ev), 50);
  });
}

// ── Mock API surface (mirrors real backend contract) ─────────────────────────────
export const mockService = {
  // ── lifecycle ──────────────────────────────────────────────────────────────
  async createMatch(host: Player, settings?: Partial<MatchSettings>): Promise<Match> {
    const merged = { ...defaultMatchSettings("4p"), ...(settings ?? {}) };
    const id = randomId("match");
    const seats: (Player | null)[] = merged.mode === "1v1"
      ? [host, null]
      : [host, null, null, null];
    const match: Match = {
      id,
      settings: merged,
      seats,
      currentTurn: null,
      phase: "lobby",
      hostId: host.id,
      createdAt: Date.now(),
      inviteCode: randomId("inv").toUpperCase().slice(0, 8),
    };
    store.matches[id] = match;

    // Default slot layout: host + (mode-1) empty seats.
    const slotKinds: SlotKind[] = merged.mode === "1v1"
      ? ["host", "public"]
      : ["host", "public", "public", "public"];
    store.lobbies[id] = emptyLobby(match, slotKinds);

    // 📡 BACKEND HOOK: When wiring the real server, send POST /api/damma/rooms here
    // and replace the in-memory store with whatever the server returns.
    return match;
  },

  async joinMatch(matchId: string, player: Player): Promise<Match | null> {
    const match = store.matches[matchId];
    if (!match) return null;
    const lobby = store.lobbies[matchId];

    // Find the first empty/public slot.
    const idx = lobby.slots.findIndex((s) => !s.player && (s.kind === "public" || s.kind === "friend" || s.kind === "empty"));
    if (idx === -1) return match; // room is full
    lobby.slots[idx] = { ...lobby.slots[idx], player, ready: !!player.ready, kind: "friend" };
    match.seats[idx] = player;

    emit(matchId, { type: "player_joined", player, matchId });
    emit(matchId, { type: "lobby_update",  lobby });
    // 📡 BACKEND HOOK: replace with WS "join" message.
    return match;
  },

  async leaveMatch(matchId: string, playerId: string): Promise<void> {
    const match = store.matches[matchId];
    const lobby = store.lobbies[matchId];
    if (!match || !lobby) return;
    const idx = match.seats.findIndex((p) => p?.id === playerId);
    if (idx !== -1) {
      match.seats[idx] = null;
      lobby.slots[idx] = { kind: "empty", player: null, ready: false };
    }
    emit(matchId, { type: "player_left", playerId, matchId });
    emit(matchId, { type: "lobby_update", lobby });
    // 📡 BACKEND HOOK: send "leave" + cleanup subscription.
  },

  async inviteFriends(matchId: string, friendIds: string[]): Promise<void> {
    // No-op in mock. Real server would dispatch push notifications / DMs.
    // 📡 BACKEND HOOK: POST /api/damma/rooms/{matchId}/invite { friend_ids }.
    void matchId; void friendIds;
  },

  async publicMatchmaking(player: Player, mode: "1v1" | "4p"): Promise<Match> {
    // Drop the player into the public queue and "match" once it reaches N.
    const required = mode === "1v1" ? 2 : 4;
    store.publicQueue.push({ player, mode, joinedAt: Date.now() });

    const queueOfMode = store.publicQueue.filter((q) => q.mode === mode);
    if (queueOfMode.length >= required) {
      const drained = queueOfMode.splice(0, required);
      store.publicQueue = store.publicQueue.filter((q) => !drained.includes(q));
      const host = drained[0].player;
      const match = await mockService.createMatch(host, { mode, visibility: "public" });
      drained.slice(1).forEach((q) => mockService.joinMatch(match.id, q.player));
      return match;
    }
    // Not yet matched — return a placeholder phase="lobby" match with the
    // player still queued. Real server would keep polling/eventing.
    return await mockService.createMatch(player, { mode, visibility: "public" });
    // 📡 BACKEND HOOK: POST /api/damma/queue/join + waitForMatch().
  },

  async reconnectToMatch(matchId: string, playerId: string): Promise<{ match: Match; state: GameState } | null> {
    const match = store.matches[matchId];
    if (!match) return null;
    const player = match.seats.find((p) => p?.id === playerId);
    if (player) player.disconnected = false;
    let state = store.gameStates[matchId];
    if (!state) state = makeMockGameState(matchId);
    // 📡 BACKEND HOOK: send "reconnect" → receive { match, state }.
    return { match, state };
  },

  // ── moves & state ──────────────────────────────────────────────────────────
  async sendMove(matchId: string, playerId: string, move: PlayerMove): Promise<void> {
    const state = store.gameStates[matchId];
    if (!state) return;
    // The mock service does NOT validate the move against the engine — the
    // real server (or a shared engine on the client) will. We simply bump the
    // version and broadcast a fake state_update so subscribers can render.
    state.version += 1;
    emit(matchId, { type: "player_moved", playerId, move, state });
    // 📡 BACKEND HOOK: WS send { type: "move", … } — server validates & re-broadcasts.
  },

  async syncGameState(matchId: string): Promise<GameState | null> {
    return store.gameStates[matchId] ?? null;
    // 📡 BACKEND HOOK: GET /api/damma/rooms/{matchId}/state
  },

  // ── event stream ────────────────────────────────────────────────────────────
  /** Subscribe to events on a particular match. Returns an unsubscribe fn. */
  subscribe(matchId: string, listener: (ev: ServerEvent) => void): () => void {
    if (!store.subscribers[matchId]) store.subscribers[matchId] = new Set();
    store.subscribers[matchId].add(listener);
    return () => store.subscribers[matchId]?.delete(listener);
    // 📡 BACKEND HOOK: replace with WebSocket "message" listener.
  },

  // ── introspection ────────────────────────────────────────────────────────────
  _peekMatch(matchId: string): Match | undefined { return store.matches[matchId]; },
  _peekLobby(matchId: string): MatchLobby | undefined { return store.lobbies[matchId]; },
  _peekState(matchId: string): GameState | undefined { return store.gameStates[matchId]; },
  /** Reset everything — useful for tests/Storybook. */
  _reset(): void {
    store.matches = {};
    store.lobbies = {};
    store.gameStates = {};
    store.publicQueue = [];
    store.subscribers = {};
  },
};
