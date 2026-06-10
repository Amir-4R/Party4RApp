// =============================================================================
// src/games/damma/online.ts — Damma online multiplayer client
// =============================================================================
// Thin wrapper around the backend's /api/damma REST + WebSocket protocol.
// Designed for use inside damma.tsx (or a dedicated damma-online.tsx screen)
// without changing the local single-player path.
//
// Usage:
//   const client = new DammaOnlineClient(backendUrl);
//   await client.createRoom({ host_id, host_name, host_avatar, num_players });
//   await client.connect(rid, user_id, {
//     onRoom: (room) => setRoom(room),
//     onState: (state, hand) => setGame(state, hand),
//     onMove: (move) => ...,
//     onChat: (m) => ...,
//     onEnd: (end) => showResult(end),
//     onError: (msg) => toast(msg),
//   });
//   client.play(tileId, "left");
//   client.draw();
//   client.pass();
// =============================================================================

export interface RoomSnapshot {
  rid: string;
  visibility: "public" | "private";
  num_players: number;
  host_id: string;
  slots: {
    pid: string; user_id: string | null; name: string;
    avatar: string; is_bot: boolean; ready: boolean; online: boolean;
  }[];
  phase: "lobby" | "playing" | "game_over";
  turn: string | null;
  scores: Record<string, number>;
  tile_counts: Record<string, number>;
  boneyard_count: number;
  turn_seconds_left: number;
}

export interface OnlineGameState {
  board: { id: string; left: number; right: number }[];
  left_end: number | null;
  right_end: number | null;
}

export interface OnlineHand {
  id: string; left: number; right: number;
}

export interface DammaOnlineHandlers {
  onRoom?:  (room: RoomSnapshot) => void;
  onState?: (state: OnlineGameState, hand: OnlineHand[], room: RoomSnapshot) => void;
  onChat?:  (msg: { from: string; text: string }) => void;
  onEnd?:   (end: { winner: string; scores: Record<string, number> }) => void;
  onError?: (msg: string) => void;
  onClose?: () => void;
}

export class DammaOnlineClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private handlers: DammaOnlineHandlers = {};
  private rid: string | null = null;
  private userId: string | null = null;

  constructor(baseUrl: string) {
    // Normalise: strip trailing slash, accept https://… or http://…
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  // ── REST ─────────────────────────────────────────────────────────────────
  async createRoom(body: {
    host_id: string; host_name: string; host_avatar?: string;
    visibility?: "public" | "private"; num_players?: 2 | 4;
  }): Promise<{ rid: string; room: RoomSnapshot }> {
    const res = await fetch(`${this.baseUrl}/api/damma/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host_id: body.host_id,
        host_name: body.host_name,
        host_avatar: body.host_avatar ?? "avatar_ninja",
        visibility: body.visibility ?? "public",
        num_players: body.num_players ?? 4,
      }),
    });
    if (!res.ok) throw new Error(`createRoom failed (${res.status})`);
    return await res.json();
  }

  async joinRoom(rid: string, user_id: string, name: string, avatar = "avatar_ninja"): Promise<RoomSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/damma/rooms/${rid}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, name, avatar }),
    });
    if (!res.ok) throw new Error(`joinRoom failed (${res.status})`);
    const j = await res.json();
    return j.room;
  }

  async listPublicRooms(): Promise<RoomSnapshot[]> {
    const res = await fetch(`${this.baseUrl}/api/damma/rooms`);
    if (!res.ok) return [];
    return (await res.json()).rooms;
  }

  // ── Matchmaking queue ────────────────────────────────────────────────────
  // Use these to "Find any match" without manually picking a room.
  async queueJoin(body: {
    user_id: string; name: string; avatar?: string; num_players?: 2 | 4;
  }): Promise<{ position: number; queue_size: number; num_players: number }> {
    const res = await fetch(`${this.baseUrl}/api/damma/queue/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: body.user_id,
        name: body.name,
        avatar: body.avatar ?? "avatar_ninja",
        num_players: body.num_players ?? 4,
      }),
    });
    if (!res.ok) throw new Error("queueJoin failed");
    return await res.json();
  }

  async queueStatus(user_id: string): Promise<
    | { matched: true; rid: string }
    | { matched: false; position: number; queue_size: number; num_players: number; wait_seconds?: number }
  > {
    const res = await fetch(`${this.baseUrl}/api/damma/queue/status?user_id=${encodeURIComponent(user_id)}`);
    if (!res.ok) throw new Error("queueStatus failed");
    return await res.json();
  }

  async queueLeave(user_id: string, name = ""): Promise<void> {
    await fetch(`${this.baseUrl}/api/damma/queue/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, name }),
    });
  }

  /**
   * Convenience: keep polling the queue every `intervalMs` (default 2 s)
   * until a match is found OR `onProgress` returns false.
   *  Resolves with the matched `rid`.
   */
  async waitForMatch(
    user_id: string,
    onProgress?: (status: { position: number; queue_size: number; wait_seconds?: number }) => boolean | void,
    intervalMs = 2000,
  ): Promise<string> {
    while (true) {
      const s = await this.queueStatus(user_id);
      if (s.matched) return s.rid;
      const keep = onProgress?.({ position: s.position, queue_size: s.queue_size, wait_seconds: s.wait_seconds });
      if (keep === false) throw new Error("cancelled");
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async setReady(rid: string, user_id: string, name: string, ready = true): Promise<RoomSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/damma/rooms/${rid}/ready?ready=${ready}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, name }),
    });
    if (!res.ok) throw new Error("setReady failed");
    return (await res.json()).room;
  }

  async startMatch(rid: string, user_id: string, name: string): Promise<RoomSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/damma/rooms/${rid}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `startMatch failed (${res.status})`);
    }
    return (await res.json()).room;
  }

  async leaveRoom(rid: string, user_id: string, name: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/damma/rooms/${rid}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, name }),
    });
  }

  // ── WebSocket ────────────────────────────────────────────────────────────
  connect(rid: string, user_id: string, handlers: DammaOnlineHandlers): Promise<void> {
    this.rid = rid;
    this.userId = user_id;
    this.handlers = handlers;
    // Build WS URL from baseUrl (http→ws, https→wss).
    const wsBase = this.baseUrl.replace(/^http/, "ws");
    const url = `${wsBase}/api/damma/ws/${rid}?user_id=${encodeURIComponent(user_id)}`;
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.onopen = () => {
          // Heartbeat every 25 s to keep the connection alive across proxies.
          this.heartbeatId = setInterval(() => {
            try { ws.send(JSON.stringify({ type: "heartbeat" })); } catch {}
          }, 25000);
          resolve();
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(String(e.data));
            this._dispatch(msg);
          } catch {}
        };
        ws.onerror = (e) => {
          this.handlers.onError?.("WebSocket error");
          reject(e);
        };
        ws.onclose = () => {
          if (this.heartbeatId) { clearInterval(this.heartbeatId); this.heartbeatId = null; }
          this.handlers.onClose?.();
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect(): void {
    try { this.ws?.close(); } catch {}
    this.ws = null;
    if (this.heartbeatId) { clearInterval(this.heartbeatId); this.heartbeatId = null; }
  }

  // ── Outgoing actions ─────────────────────────────────────────────────────
  play(tile_id: string, side: "left" | "right"): void {
    this._send({ type: "play", tile_id, side });
  }
  draw(): void { this._send({ type: "draw" }); }
  pass(): void { this._send({ type: "pass" }); }
  chat(text: string): void { this._send({ type: "chat", text }); }

  private _send(msg: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try { this.ws.send(JSON.stringify(msg)); } catch {}
  }

  private _dispatch(msg: any): void {
    switch (msg.type) {
      case "room":
        this.handlers.onRoom?.(msg.room);
        break;
      case "state":
        this.handlers.onState?.(
          { board: msg.board, left_end: msg.left_end, right_end: msg.right_end },
          msg.hand || [],
          msg.room,
        );
        break;
      case "chat":
        this.handlers.onChat?.({ from: msg.from, text: msg.text });
        break;
      case "end":
        this.handlers.onEnd?.({ winner: msg.winner, scores: msg.scores });
        break;
      case "error":
        this.handlers.onError?.(msg.message || "Unknown error");
        break;
    }
  }
}

// Convenience singleton — call `getDammaClient()` from anywhere. Uses the
// EXPO_PUBLIC_BACKEND_URL env. Falls back to relative path on web preview.
let _client: DammaOnlineClient | null = null;
export function getDammaClient(): DammaOnlineClient {
  if (_client) return _client;
  const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim();
  _client = new DammaOnlineClient(base || "");
  return _client;
}
