// =============================================================================
// src/games/shared/GameController.ts — Unified Multiplayer Architecture
// =============================================================================
// طبقة موحّدة تربط محركات الألعاب الثلاثة بالأونلاين.
// تعمل محلياً (vs AI/practice) أو أونلاين (vs player) بنفس الواجهة.
// =============================================================================

import { GameType } from "../../api/games";

export type GameMode = "local" | "online" | "practice";
export type PlayerSide = "host" | "guest" | "spectator";

// ── Generic move envelope sent over WebSocket ─────────────────────────────────
export interface GameMoveEnvelope {
  type: "move";
  game: GameType;
  move: unknown;           // game-specific move payload
  move_number: number;
  state_hash?: string;     // anti-cheat: client state hash
  timestamp: number;
}

// ── Game adapter interface — every engine implements this ──────────────────────
export interface GameAdapter<State, Move> {
  createInitial(): State;
  applyMove(state: State, move: Move, player: PlayerSide): State | null;
  isGameOver(state: State): boolean;
  getWinner(state: State): string | null;
  serialize(state: State): string;
  deserialize(data: string): State;
  // Validate a move came from the right player at the right time
  validateTurn(state: State, player: PlayerSide): boolean;
}

// ── Online sync controller ─────────────────────────────────────────────────────
export class OnlineGameController<State, Move> {
  private state: State;
  private moveNumber = 0;
  private adapter: GameAdapter<State, Move>;
  private ws: WebSocket | null = null;
  private side: PlayerSide;
  private listeners: Array<(state: State) => void> = [];
  private gameOverListeners: Array<(winner: string | null) => void> = [];

  constructor(adapter: GameAdapter<State, Move>, side: PlayerSide) {
    this.adapter = adapter;
    this.side = side;
    this.state = adapter.createInitial();
  }

  // Connect to game WebSocket
  attachSocket(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (e: any) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "game_move") this.handleRemoteMove(msg);
        else if (msg.type === "game_state") this.handleStateSync(msg);
        else if (msg.type === "game_over") this.handleGameOver(msg);
      } catch {}
    });
  }

  // Local player makes a move
  makeMove(move: Move): boolean {
    if (!this.adapter.validateTurn(this.state, this.side)) return false;

    const next = this.adapter.applyMove(this.state, move, this.side);
    if (!next) return false;

    this.state = next;
    this.moveNumber++;
    this.notifyState();

    // Send to opponent
    if (this.ws?.readyState === WebSocket.OPEN) {
      const envelope: GameMoveEnvelope = {
        type: "move",
        game: "chess" as GameType, // set by subclass
        move,
        move_number: this.moveNumber,
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(envelope));
    }

    this.checkGameOver();
    return true;
  }

  private handleRemoteMove(msg: any) {
    const move = msg.move as Move;
    const next = this.adapter.applyMove(this.state, move, this.side === "host" ? "guest" : "host");
    if (next) {
      this.state = next;
      this.moveNumber = msg.move_number ?? this.moveNumber + 1;
      this.notifyState();
      this.checkGameOver();
    }
  }

  private handleStateSync(msg: any) {
    // Authoritative state from server (e.g. after reconnect)
    if (msg.state) {
      this.state = this.adapter.deserialize(JSON.stringify(msg.state));
      this.notifyState();
    }
  }

  private handleGameOver(msg: any) {
    this.gameOverListeners.forEach((l) => l(msg.winner_id ?? null));
  }

  private checkGameOver() {
    if (this.adapter.isGameOver(this.state)) {
      const winner = this.adapter.getWinner(this.state);
      this.gameOverListeners.forEach((l) => l(winner));
    }
  }

  getState(): State { return this.state; }
  getMoveNumber(): number { return this.moveNumber; }

  onStateChange(cb: (state: State) => void) { this.listeners.push(cb); }
  onGameOver(cb: (winner: string | null) => void) { this.gameOverListeners.push(cb); }

  private notifyState() { this.listeners.forEach((l) => l(this.state)); }

  // For reconnect: request full state from server
  requestStateSync() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "state_request" }));
    }
  }
}

// ── Match structure (used by matchmaking + tournaments) ────────────────────────
export interface Match {
  session_id: string;
  game_type: GameType;
  mode: GameMode;
  host_id: string;
  guest_id: string | null;
  spectators: string[];
  status: "waiting" | "active" | "finished";
  created_at: string;
}
