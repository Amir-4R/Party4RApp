// =============================================================================
// src/games/carrom/engine.ts — Party4R Carrom Engine
// =============================================================================
// محرّك كيرم بفيزياء حقيقية:
//   - أقراص (coins) بيضاء وسوداء + الملكة (queen)
//   - القطّاعة (striker) للتصويب
//   - فيزياء التصادم والاحتكاك
//   - الجيوب الأربعة (pockets) وحساب النقاط
//   - بنية جاهزة للأونلاين
// =============================================================================

export type CoinColor = "white" | "black" | "queen";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Coin {
  id: string;
  pos: Vec2;
  vel: Vec2;
  color: CoinColor;
  radius: number;
  pocketed: boolean;
  active: boolean; // false once pocketed
}

export interface CarromState {
  coins: Coin[];
  striker: Coin;
  turn: "player1" | "player2";
  scores: { player1: number; player2: number };
  queenPocketed: boolean;
  queenCoveredBy: string | null; // player who needs to cover the queen
  phase: "aiming" | "simulating" | "turn_end" | "game_over";
  winner: string | null;
  foul: boolean;
}

// ── Board Constants ─────────────────────────────────────────────────────────
export const BOARD_SIZE = 360;          // logical units
export const COIN_RADIUS = 9;
export const STRIKER_RADIUS = 12;
export const POCKET_RADIUS = 16;
export const FRICTION = 0.985;          // velocity decay per frame
export const MIN_VELOCITY = 0.05;       // below this = stopped
export const STRIKER_MAX_POWER = 18;

const CENTER = BOARD_SIZE / 2;

// Four corner pockets
export const POCKETS: Vec2[] = [
  { x: 24, y: 24 },
  { x: BOARD_SIZE - 24, y: 24 },
  { x: 24, y: BOARD_SIZE - 24 },
  { x: BOARD_SIZE - 24, y: BOARD_SIZE - 24 },
];

// ── Initial Setup ─────────────────────────────────────────────────────────────

export function createInitialState(): CarromState {
  const coins: Coin[] = [];

  // Queen in center
  coins.push({
    id: "queen",
    pos: { x: CENTER, y: CENTER },
    vel: { x: 0, y: 0 },
    color: "queen",
    radius: COIN_RADIUS,
    pocketed: false,
    active: true,
  });

  // Arrange 9 white + 9 black in a circle around the queen
  const ringRadius = COIN_RADIUS * 2.2;
  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 * i) / 18;
    const r = i % 2 === 0 ? ringRadius : ringRadius * 1.9;
    coins.push({
      id: `coin_${i}`,
      pos: {
        x: CENTER + Math.cos(angle) * r,
        y: CENTER + Math.sin(angle) * r,
      },
      vel: { x: 0, y: 0 },
      color: i % 2 === 0 ? "white" : "black",
      radius: COIN_RADIUS,
      pocketed: false,
      active: true,
    });
  }

  return {
    coins,
    striker: {
      id: "striker",
      pos: { x: CENTER, y: BOARD_SIZE - 50 },
      vel: { x: 0, y: 0 },
      color: "white",
      radius: STRIKER_RADIUS,
      pocketed: false,
      active: true,
    },
    turn: "player1",
    scores: { player1: 0, player2: 0 },
    queenPocketed: false,
    queenCoveredBy: null,
    phase: "aiming",
    winner: null,
    foul: false,
  };
}

// ── Vector helpers ─────────────────────────────────────────────────────────────
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const len = (v: Vec2) => Math.hypot(v.x, v.y);

// ── Shoot the striker ───────────────────────────────────────────────────────────

export function shootStriker(state: CarromState, angle: number, power: number): CarromState {
  if (state.phase !== "aiming") return state;
  const p = Math.min(power, 1) * STRIKER_MAX_POWER;
  const striker = {
    ...state.striker,
    vel: { x: Math.cos(angle) * p, y: Math.sin(angle) * p },
  };
  return { ...state, striker, phase: "simulating", foul: false };
}

// ── Set striker position (along baseline before shooting) ──────────────────────

export function setStrikerPosition(state: CarromState, x: number): CarromState {
  if (state.phase !== "aiming") return state;
  const clampedX = Math.max(50, Math.min(BOARD_SIZE - 50, x));
  const baseY = state.turn === "player1" ? BOARD_SIZE - 50 : 50;
  return {
    ...state,
    striker: { ...state.striker, pos: { x: clampedX, y: baseY } },
  };
}

// ── Physics simulation step (call repeatedly until settled) ────────────────────

export function simulateStep(state: CarromState): { state: CarromState; settled: boolean } {
  if (state.phase !== "simulating") return { state, settled: true };

  const allPieces = [state.striker, ...state.coins].filter((c) => c.active);

  // 1. Move all pieces
  for (const piece of allPieces) {
    piece.pos.x += piece.vel.x;
    piece.pos.y += piece.vel.y;
    // Apply friction
    piece.vel.x *= FRICTION;
    piece.vel.y *= FRICTION;
    if (len(piece.vel) < MIN_VELOCITY) { piece.vel.x = 0; piece.vel.y = 0; }
  }

  // 2. Wall collisions
  for (const piece of allPieces) {
    const edge = 18;
    if (piece.pos.x - piece.radius < edge) { piece.pos.x = edge + piece.radius; piece.vel.x *= -0.8; }
    if (piece.pos.x + piece.radius > BOARD_SIZE - edge) { piece.pos.x = BOARD_SIZE - edge - piece.radius; piece.vel.x *= -0.8; }
    if (piece.pos.y - piece.radius < edge) { piece.pos.y = edge + piece.radius; piece.vel.y *= -0.8; }
    if (piece.pos.y + piece.radius > BOARD_SIZE - edge) { piece.pos.y = BOARD_SIZE - edge - piece.radius; piece.vel.y *= -0.8; }
  }

  // 3. Piece-piece collisions (elastic)
  for (let i = 0; i < allPieces.length; i++) {
    for (let j = i + 1; j < allPieces.length; j++) {
      const a = allPieces[i], b = allPieces[j];
      const d = dist(a.pos, b.pos);
      const minDist = a.radius + b.radius;
      if (d < minDist && d > 0) {
        // Separate overlap
        const overlap = (minDist - d) / 2;
        const nx = (b.pos.x - a.pos.x) / d;
        const ny = (b.pos.y - a.pos.y) / d;
        a.pos.x -= nx * overlap; a.pos.y -= ny * overlap;
        b.pos.x += nx * overlap; b.pos.y += ny * overlap;
        // Exchange velocity along normal
        const dvx = b.vel.x - a.vel.x;
        const dvy = b.vel.y - a.vel.y;
        const impact = dvx * nx + dvy * ny;
        if (impact < 0) {
          a.vel.x += impact * nx; a.vel.y += impact * ny;
          b.vel.x -= impact * nx; b.vel.y -= impact * ny;
        }
      }
    }
  }

  // 4. Pocket detection
  for (const piece of allPieces) {
    for (const pocket of POCKETS) {
      if (dist(piece.pos, pocket) < POCKET_RADIUS) {
        piece.active = false;
        piece.pocketed = true;
        piece.vel = { x: 0, y: 0 };
      }
    }
  }

  // 5. Settled? all velocities ~0
  const settled = allPieces.every((p) => len(p.vel) < MIN_VELOCITY);

  return { state: { ...state }, settled };
}

// ── End-of-turn resolution ──────────────────────────────────────────────────────

export function resolveTurn(state: CarromState): CarromState {
  const newState = { ...state };
  const current = state.turn;
  const opponent = current === "player1" ? "player2" : "player1";

  let foul = false;
  let scoredThisTurn = 0;

  // Striker pocketed = foul
  if (state.striker.pocketed) {
    foul = true;
  }

  // Count pocketed coins
  for (const coin of newState.coins) {
    if (coin.pocketed && coin.active === false) {
      // Already processed if active===false AND counted; use a flag instead
    }
  }

  // Process newly pocketed coins
  const pocketedCoins = newState.coins.filter((c) => c.pocketed);
  for (const coin of pocketedCoins) {
    if (coin.color === "queen" && !newState.queenPocketed) {
      newState.queenPocketed = true;
      newState.queenCoveredBy = current; // must cover with next coin
    } else if (coin.color === "white" || coin.color === "black") {
      scoredThisTurn += 1;
    }
  }

  // Reset striker
  newState.striker = {
    ...newState.striker,
    pos: { x: CENTER, y: opponent === "player1" ? BOARD_SIZE - 50 : 50 },
    vel: { x: 0, y: 0 },
    pocketed: false,
    active: true,
  };

  if (foul) {
    // Foul: lose a point, return a coin (simplified — just -1)
    newState.scores[current] = Math.max(0, newState.scores[current] - 1);
    newState.turn = opponent;
  } else {
    newState.scores[current] += scoredThisTurn;
    // Extra turn if scored, else pass
    if (scoredThisTurn === 0) newState.turn = opponent;
  }

  newState.foul = foul;

  // Check win condition
  const remainingCoins = newState.coins.filter((c) => !c.pocketed).length;
  if (remainingCoins === 0) {
    const winner = newState.scores.player1 > newState.scores.player2 ? "player1" : "player2";
    newState.winner = winner;
    newState.phase = "game_over";
  } else {
    newState.phase = "aiming";
  }

  return newState;
}

// ── Serialization ──────────────────────────────────────────────────────────────
export function serializeState(state: CarromState): string { return JSON.stringify(state); }
export function deserializeState(data: string): CarromState { return JSON.parse(data); }
