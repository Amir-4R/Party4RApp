// =============================================================================
// src/games/carrom/engine.ts — Party4R Carrom Engine (TOURNAMENT-GRADE)
// =============================================================================
// محرّك كيرم احترافي يطابق المواصفات الفنية لطاولة كيرم رياضية:
//   - أبعاد دقيقة 740 × 740 وحدة
//   - فيزياء واقعية مع static & dynamic friction
//   - خطوط رمي مقيّدة للقطّاعة
//   - نظام نقاط رسمي (أبيض 20، أسود 10، ملكة 50)
//   - مؤقت دور 60 ثانية
//   - نظام أخطاء (Fouls)
//   - "تغطية" الملكة بقطعة لاحقة
// =============================================================================

export type CoinColor = "white" | "black" | "queen";
export type Player = "player1" | "player2";

export interface Vec2 { x: number; y: number; }

export interface Coin {
  id: string;
  pos: Vec2;
  vel: Vec2;
  color: CoinColor;
  radius: number;
  pocketed: boolean;
  active: boolean;
  /** Player who pocketed this coin (set on pocket event) */
  pocketedBy?: Player;
}

export interface CarromState {
  coins: Coin[];
  striker: Coin;
  turn: Player;
  scores: { player1: number; player2: number };
  /** Queen has been pocketed but not yet covered */
  queenPocketed: boolean;
  /** Player who pocketed the queen and must cover it next */
  queenCoveredBy: Player | null;
  /** True if the queen has been successfully covered (50 pts awarded) */
  queenAwarded: boolean;
  phase: "aiming" | "simulating" | "turn_end" | "game_over";
  winner: Player | "draw" | null;
  /** Foul committed in the last completed turn */
  foul: boolean;
  /** Human-readable reason for the foul (for HUD display) */
  foulReason: string | null;
  /** Seconds remaining for the current turn (60s countdown). */
  turnSecondsLeft: number;
  /** Coin IDs pocketed during the CURRENT shot (resets each turn). */
  lastShotPockets: string[];
}

// ─── DIMENSIONS (per tournament-grade carrom spec) ───────────────────────────
// Logical units = physical 740 × 740 units. UI scales this with a single multiplier.
export const BOARD_SIZE = 740;                  // ✦ outer playable area
export const FRAME_INSET = 30;                  // edge thickness (visual only)

export const COIN_RADIUS = 15.9;                // ✦ matches center-circle radius
export const STRIKER_RADIUS = 19;
export const POCKET_RADIUS = 22.5 / 2;          // ✦ pocket hitbox radius = 11.25
const POCKET_OFFSET = 25;                       // ✦ pocket center distance from edge

export const CENTER_CIRCLE_RADIUS = 31.8 / 2;   // ✦ central decoration radius
export const DECOR_RING_RADIUS = 31.8;          // ✦ distance of 6 decor circles from center

export const THROW_LINE_LENGTH = 470;           // ✦ horizontal throw line length
export const THROW_LINE_OFFSET = 100;           // ✦ distance from frame edge
export const THROW_END_CIRCLE_RADIUS = 31.8 / 2;

// ─── PHYSICS CONSTANTS ───────────────────────────────────────────────────────
export const STATIC_FRICTION = 0.05;            // applied when slow
export const DYNAMIC_FRICTION = 0.03;           // applied when in motion
export const LINEAR_DRAG = 0.2;                 // global drag factor (per second)
export const MIN_VELOCITY = 0.5;                // ✦ stop threshold
export const WALL_RESTITUTION = 0.85;           // ✦ bounce off walls
export const COIN_RESTITUTION = 0.60;           // ✦ bounce between pieces
export const STRIKER_MAX_POWER = 38;            // tuned for 740-unit board

const CENTER = BOARD_SIZE / 2;
const DT = 1 / 60;                              // fixed simulation timestep

// ─── SCORING (per spec) ──────────────────────────────────────────────────────
export const POINTS_WHITE = 20;
export const POINTS_BLACK = 10;
export const POINTS_QUEEN = 50;
export const FOUL_PENALTY = 10;                 // ✦ -10 pts per foul

// ─── POCKETS (four corners, 25 units from edges) ─────────────────────────────
export const POCKETS: Vec2[] = [
  { x: POCKET_OFFSET,                y: POCKET_OFFSET },
  { x: BOARD_SIZE - POCKET_OFFSET,   y: POCKET_OFFSET },
  { x: POCKET_OFFSET,                y: BOARD_SIZE - POCKET_OFFSET },
  { x: BOARD_SIZE - POCKET_OFFSET,   y: BOARD_SIZE - POCKET_OFFSET },
];

// ─── THROW LINES (four lines, one per player side) ───────────────────────────
// Each line runs horizontally across the board THROW_LINE_OFFSET units from its
// edge, with length THROW_LINE_LENGTH centred along the board. End circles are
// the small decorative dots at each line's two ends.
export interface ThrowLine {
  side: "bottom" | "top" | "left" | "right";
  /** Start and end points in board units */
  start: Vec2;
  end: Vec2;
  /** True if line is horizontal (vs vertical) */
  horizontal: boolean;
}

export const THROW_LINES: ThrowLine[] = [
  {
    side: "bottom",
    start: { x: (BOARD_SIZE - THROW_LINE_LENGTH) / 2, y: BOARD_SIZE - THROW_LINE_OFFSET },
    end:   { x: (BOARD_SIZE + THROW_LINE_LENGTH) / 2, y: BOARD_SIZE - THROW_LINE_OFFSET },
    horizontal: true,
  },
  {
    side: "top",
    start: { x: (BOARD_SIZE - THROW_LINE_LENGTH) / 2, y: THROW_LINE_OFFSET },
    end:   { x: (BOARD_SIZE + THROW_LINE_LENGTH) / 2, y: THROW_LINE_OFFSET },
    horizontal: true,
  },
  {
    side: "left",
    start: { x: THROW_LINE_OFFSET, y: (BOARD_SIZE - THROW_LINE_LENGTH) / 2 },
    end:   { x: THROW_LINE_OFFSET, y: (BOARD_SIZE + THROW_LINE_LENGTH) / 2 },
    horizontal: false,
  },
  {
    side: "right",
    start: { x: BOARD_SIZE - THROW_LINE_OFFSET, y: (BOARD_SIZE - THROW_LINE_LENGTH) / 2 },
    end:   { x: BOARD_SIZE - THROW_LINE_OFFSET, y: (BOARD_SIZE + THROW_LINE_LENGTH) / 2 },
    horizontal: false,
  },
];

/** Six decorative circles around the central circle */
export const DECOR_CIRCLES: Vec2[] = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 6;
  return {
    x: CENTER + Math.cos(a) * DECOR_RING_RADIUS,
    y: CENTER + Math.sin(a) * DECOR_RING_RADIUS,
  };
});

// ─── INITIAL STATE ───────────────────────────────────────────────────────────

/**
 * Standard opening layout: queen at centre, surrounded by 6 inner coins and 12
 * outer coins forming the classic carrom rosette.
 */
export function createInitialState(): CarromState {
  const coins: Coin[] = [];

  // Queen at centre
  coins.push({
    id: "queen",
    pos: { x: CENTER, y: CENTER },
    vel: { x: 0, y: 0 },
    color: "queen",
    radius: COIN_RADIUS,
    pocketed: false,
    active: true,
  });

  // Inner ring: 6 coins touching the queen, alternating colors
  const innerR = COIN_RADIUS * 2;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
    coins.push({
      id: `inner_${i}`,
      pos: { x: CENTER + Math.cos(a) * innerR, y: CENTER + Math.sin(a) * innerR },
      vel: { x: 0, y: 0 },
      color: i % 2 === 0 ? "white" : "black",
      radius: COIN_RADIUS,
      pocketed: false,
      active: true,
    });
  }

  // Outer ring: 12 coins, alternating colors
  const outerR = COIN_RADIUS * 4;
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    coins.push({
      id: `outer_${i}`,
      pos: { x: CENTER + Math.cos(a) * outerR, y: CENTER + Math.sin(a) * outerR },
      vel: { x: 0, y: 0 },
      color: i % 2 === 0 ? "white" : "black",
      radius: COIN_RADIUS,
      pocketed: false,
      active: true,
    });
  }

  return {
    coins,
    striker: makeStriker("player1"),
    turn: "player1",
    scores: { player1: 0, player2: 0 },
    queenPocketed: false,
    queenCoveredBy: null,
    queenAwarded: false,
    phase: "aiming",
    winner: null,
    foul: false,
    foulReason: null,
    turnSecondsLeft: 60,
    lastShotPockets: [],
  };
}

function makeStriker(turn: Player): Coin {
  const line = throwLineForPlayer(turn);
  // Initial position: centre of throw line
  const centre: Vec2 = line.horizontal
    ? { x: (line.start.x + line.end.x) / 2, y: line.start.y }
    : { x: line.start.x, y: (line.start.y + line.end.y) / 2 };
  return {
    id: "striker",
    pos: centre,
    vel: { x: 0, y: 0 },
    color: "white",
    radius: STRIKER_RADIUS,
    pocketed: false,
    active: true,
  };
}

/** Returns the throw line a given player must shoot from. */
export function throwLineForPlayer(p: Player): ThrowLine {
  // 1v1 default: player1=bottom, player2=top. Easy to extend to 4-player.
  return p === "player1" ? THROW_LINES[0] : THROW_LINES[1];
}

// ─── STRIKER POSITIONING (constrained to throw line) ─────────────────────────

/**
 * Move the striker along its throw line.  `t` is a parameter ∈ [0, 1] mapping
 * to start..end of the line. Values outside [0, 1] are clamped.
 */
export function setStrikerOnLine(state: CarromState, t: number): CarromState {
  if (state.phase !== "aiming") return state;
  const line = throwLineForPlayer(state.turn);
  const clamped = Math.max(0, Math.min(1, t));
  const margin = STRIKER_RADIUS / THROW_LINE_LENGTH; // keep striker on the line
  const tt = Math.max(margin, Math.min(1 - margin, clamped));
  const pos: Vec2 = line.horizontal
    ? { x: line.start.x + (line.end.x - line.start.x) * tt, y: line.start.y }
    : { x: line.start.x, y: line.start.y + (line.end.y - line.start.y) * tt };
  return { ...state, striker: { ...state.striker, pos } };
}

/**
 * Set the striker's screen-space X (or Y for vertical lines) coordinate.
 * Clamps the position to keep the striker fully on its throw line.
 */
export function setStrikerPosition(state: CarromState, x: number, y?: number): CarromState {
  if (state.phase !== "aiming") return state;
  const line = throwLineForPlayer(state.turn);
  if (line.horizontal) {
    const minX = line.start.x + STRIKER_RADIUS;
    const maxX = line.end.x - STRIKER_RADIUS;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    return { ...state, striker: { ...state.striker, pos: { x: clampedX, y: line.start.y } } };
  } else {
    const useY = y ?? x;
    const minY = line.start.y + STRIKER_RADIUS;
    const maxY = line.end.y - STRIKER_RADIUS;
    const clampedY = Math.max(minY, Math.min(maxY, useY));
    return { ...state, striker: { ...state.striker, pos: { x: line.start.x, y: clampedY } } };
  }
}

// ─── SHOOTING ────────────────────────────────────────────────────────────────

/**
 * Apply a velocity to the striker derived from a drag vector.
 *
 * @param state    current game state (must be in "aiming")
 * @param angle    radians, 0 = +X. Use atan2(targetY-strikerY, targetX-strikerX)
 * @param power    0..1 normalized power (drag distance / maxDrag)
 */
export function shootStriker(state: CarromState, angle: number, power: number): CarromState {
  if (state.phase !== "aiming") return state;
  const p = Math.max(0, Math.min(1, power)) * STRIKER_MAX_POWER;
  // Carrom: striker is shot AWAY from the player (toward the centre).
  // The caller is expected to provide an angle already pointing forward.
  const vel: Vec2 = { x: Math.cos(angle) * p, y: Math.sin(angle) * p };
  return {
    ...state,
    striker: { ...state.striker, vel },
    phase: "simulating",
    foul: false,
    foulReason: null,
    lastShotPockets: [],
  };
}

// ─── PHYSICS HELPERS ─────────────────────────────────────────────────────────
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const len = (v: Vec2) => Math.hypot(v.x, v.y);

/**
 * Apply friction to a velocity vector.  Combines:
 *   • dynamic friction (always, while moving)
 *   • static friction kick-in below a low-velocity threshold (snap to stop)
 *   • linear drag (proportional)
 */
function applyFriction(vel: Vec2): Vec2 {
  const speed = len(vel);
  if (speed === 0) return vel;
  // Convert per-second constants to per-frame (DT = 1/60)
  const dragFactor = 1 - LINEAR_DRAG * DT;
  let nx = vel.x * dragFactor;
  let ny = vel.y * dragFactor;

  // Dynamic friction always subtracts a small amount along motion direction.
  const dyn = DYNAMIC_FRICTION;
  const dirX = vel.x / speed;
  const dirY = vel.y / speed;
  nx -= dirX * dyn;
  ny -= dirY * dyn;

  // Static friction snaps very slow pieces to rest.
  if (Math.hypot(nx, ny) < STATIC_FRICTION + MIN_VELOCITY) {
    return { x: 0, y: 0 };
  }
  return { x: nx, y: ny };
}

// ─── SIMULATION STEP (fixed timestep) ────────────────────────────────────────

/**
 * One physics tick.  Call until `settled === true`, then call resolveTurn().
 */
export function simulateStep(state: CarromState): { state: CarromState; settled: boolean } {
  if (state.phase !== "simulating") return { state, settled: true };

  // Work on shallow copies so React state changes propagate
  const striker: Coin = { ...state.striker, pos: { ...state.striker.pos }, vel: { ...state.striker.vel } };
  const coins: Coin[] = state.coins.map((c) => ({
    ...c, pos: { ...c.pos }, vel: { ...c.vel },
  }));
  const newShotPockets: string[] = [...state.lastShotPockets];

  const allPieces: Coin[] = [striker, ...coins].filter((c) => c.active);

  // ── CONTINUOUS COLLISION DETECTION (sub-stepping) ─────────────────────────
  // Split fast-moving pieces into N sub-steps so they can never pass through
  // walls/coins between frames at high velocity.
  let maxSpeed = 0;
  for (const p of allPieces) {
    const sp = Math.hypot(p.vel.x, p.vel.y);
    if (sp > maxSpeed) maxSpeed = sp;
  }
  // Each sub-step must move the fastest piece at most half its radius.
  const safeStep = STRIKER_RADIUS * 0.5;
  const substeps = Math.max(1, Math.min(8, Math.ceil(maxSpeed / safeStep)));
  const dtSub = 1 / substeps;

  for (let sub = 0; sub < substeps; sub++) {
    // 1. Integrate position (fraction of full step)
    for (const p of allPieces) {
      p.pos.x += p.vel.x * dtSub;
      p.pos.y += p.vel.y * dtSub;
    }
    // 2. HARD WALL collisions (impenetrable barriers around the inner frame)
    const wallMin = FRAME_INSET;
    const wallMax = BOARD_SIZE - FRAME_INSET;
    for (const p of allPieces) {
      if (p.pos.x - p.radius < wallMin) {
        p.pos.x = wallMin + p.radius;
        if (p.vel.x < 0) p.vel.x *= -WALL_RESTITUTION;
      }
      if (p.pos.x + p.radius > wallMax) {
        p.pos.x = wallMax - p.radius;
        if (p.vel.x > 0) p.vel.x *= -WALL_RESTITUTION;
      }
      if (p.pos.y - p.radius < wallMin) {
        p.pos.y = wallMin + p.radius;
        if (p.vel.y < 0) p.vel.y *= -WALL_RESTITUTION;
      }
      if (p.pos.y + p.radius > wallMax) {
        p.pos.y = wallMax - p.radius;
        if (p.vel.y > 0) p.vel.y *= -WALL_RESTITUTION;
      }
    }
    // 3. Piece-piece collisions
    for (let i = 0; i < allPieces.length; i++) {
      for (let j = i + 1; j < allPieces.length; j++) {
        const a = allPieces[i], b = allPieces[j];
        if (!a.active || !b.active) continue;
        const d = dist(a.pos, b.pos);
        const minDist = a.radius + b.radius;
        if (d < minDist && d > 0.0001) {
          const overlap = (minDist - d) / 2;
          const nx = (b.pos.x - a.pos.x) / d;
          const ny = (b.pos.y - a.pos.y) / d;
          a.pos.x -= nx * overlap; a.pos.y -= ny * overlap;
          b.pos.x += nx * overlap; b.pos.y += ny * overlap;
          const dvx = b.vel.x - a.vel.x;
          const dvy = b.vel.y - a.vel.y;
          const impact = dvx * nx + dvy * ny;
          if (impact < 0) {
            const k = (1 + COIN_RESTITUTION) * impact / 2;
            a.vel.x += k * nx; a.vel.y += k * ny;
            b.vel.x -= k * nx; b.vel.y -= k * ny;
          }
        }
      }
    }
    // 4. Pocket detection (per sub-step so fast pieces still get pocketed)
    // Use 1.6x visual radius for hitbox match with rendered pocket
    const POCKET_HITBOX = POCKET_RADIUS * 1.6;
    for (const p of allPieces) {
      if (!p.active) continue;
      for (const pocket of POCKETS) {
        if (dist(p.pos, pocket) < POCKET_HITBOX) {
          p.active = false;
          p.pocketed = true;
          p.vel = { x: 0, y: 0 };
          p.pocketedBy = state.turn;
          newShotPockets.push(p.id);
          break;
        }
      }
    }
  }

  // 5. Apply friction (once per full frame, not per substep)
  for (const p of allPieces) {
    p.vel = applyFriction(p.vel);
  }

  // 6. All settled?
  const settled = allPieces.every((p) => !p.active || len(p.vel) < MIN_VELOCITY);
  if (settled) {
    for (const p of allPieces) p.vel = { x: 0, y: 0 };
  }

  return {
    state: { ...state, striker, coins, lastShotPockets: newShotPockets },
    settled,
  };
}

// ─── TURN RESOLUTION ─────────────────────────────────────────────────────────

/**
 * Tallies score for the turn that just ended and prepares state for the next
 * shot. Implements the official scoring rules:
 *   • White = +20
 *   • Black = +10
 *   • Queen = +50  (only awarded after a "cover" coin is pocketed in
 *                   the same OR very next shot — until then it stays
 *                   suspended in queenPocketed)
 *   • Striker pocketed = foul, -10 pts and one already-pocketed coin
 *                       returns to centre (auto-handled).
 *   • Queen pocketed but not covered = queen returns to centre.
 */
export function resolveTurn(state: CarromState): CarromState {
  const next: CarromState = {
    ...state,
    coins: state.coins.map((c) => ({ ...c })),
    scores: { ...state.scores },
  };
  const current = state.turn;
  const opponent: Player = current === "player1" ? "player2" : "player1";

  const pocketsThisShot = state.lastShotPockets;
  const strikerFoul = state.striker.pocketed;

  let foulReason: string | null = null;
  let scoredThisTurn = 0;
  let pocketedRegularCoins = 0;

  // ── 1) Process pocketed coins in this shot ────────────────────────────────
  const justPocketed = next.coins.filter((c) => pocketsThisShot.includes(c.id));
  for (const coin of justPocketed) {
    if (coin.color === "queen" && !next.queenAwarded) {
      // Queen suspended until covered
      next.queenPocketed = true;
      next.queenCoveredBy = current;
    } else if (coin.color === "white") {
      pocketedRegularCoins += 1;
      scoredThisTurn += POINTS_WHITE;
    } else if (coin.color === "black") {
      pocketedRegularCoins += 1;
      scoredThisTurn += POINTS_BLACK;
    }
  }

  // ── 2) Queen cover check ──────────────────────────────────────────────────
  // If the queen was pocketed (this shot or a previous suspended one) AND a
  // regular coin was pocketed in this same shot by the same player, the queen
  // is awarded.
  if (
    next.queenPocketed &&
    !next.queenAwarded &&
    next.queenCoveredBy === current &&
    pocketedRegularCoins > 0
  ) {
    next.scores[current] += POINTS_QUEEN;
    next.queenAwarded = true;
  } else if (next.queenPocketed && !next.queenAwarded && pocketsThisShot.length > 0 && pocketedRegularCoins === 0) {
    // Queen was pocketed this shot but no cover → suspended (kept as is)
    // We do nothing — opponent can also cover it later.
  }

  // ── 3) Striker foul ───────────────────────────────────────────────────────
  if (strikerFoul) {
    foulReason = "striker_pocketed";
    next.scores[current] = Math.max(0, next.scores[current] - FOUL_PENALTY);
    // Return one of the offender's pocketed coins back to centre if any.
    const ownPocketed = next.coins.filter((c) => c.pocketed && c.color !== "queen" && c.pocketedBy === current);
    if (ownPocketed.length > 0) {
      const c = ownPocketed[ownPocketed.length - 1];
      returnCoinToCentre(next, c.id);
    }
    // If queen was just pocketed by same player and not covered, queen also returns.
    if (next.queenPocketed && !next.queenAwarded && pocketsThisShot.includes("queen")) {
      returnCoinToCentre(next, "queen");
      next.queenPocketed = false;
      next.queenCoveredBy = null;
    }
  }

  // ── 4) Queen pocketed but NOT covered this shot → return to centre ────────
  if (
    !strikerFoul &&
    next.queenPocketed &&
    !next.queenAwarded &&
    pocketsThisShot.includes("queen") &&
    pocketedRegularCoins === 0
  ) {
    returnCoinToCentre(next, "queen");
    next.queenPocketed = false;
    next.queenCoveredBy = null;
  }

  next.scores[current] += scoredThisTurn;
  next.foul = strikerFoul;
  next.foulReason = foulReason;

  // ── 5) Determine next turn ────────────────────────────────────────────────
  // Player gets another turn if they pocketed at least one coin (and no foul).
  const earnedExtraTurn = !strikerFoul && pocketedRegularCoins > 0;
  next.turn = earnedExtraTurn ? current : opponent;
  next.striker = makeStriker(next.turn);
  next.turnSecondsLeft = 60;
  next.lastShotPockets = [];

  // ── 6) Win condition ──────────────────────────────────────────────────────
  const whitesLeft = next.coins.filter((c) => c.color === "white" && !c.pocketed).length;
  const blacksLeft = next.coins.filter((c) => c.color === "black" && !c.pocketed).length;
  const queenLeft = next.coins.find((c) => c.color === "queen" && !c.pocketed);
  if (whitesLeft === 0 || blacksLeft === 0 || (queenLeft === undefined && next.queenAwarded)) {
    // Final scoring — all remaining pocketed coins already in scores.
    const s1 = next.scores.player1;
    const s2 = next.scores.player2;
    next.winner = s1 === s2 ? "draw" : s1 > s2 ? "player1" : "player2";
    next.phase = "game_over";
  } else {
    next.phase = "aiming";
  }

  return next;
}

/** Return a previously pocketed coin to the centre (or as close as possible). */
function returnCoinToCentre(state: CarromState, coinId: string): void {
  const coin = state.coins.find((c) => c.id === coinId);
  if (!coin) return;
  coin.pocketed = false;
  coin.active = true;
  coin.pocketedBy = undefined;
  // Find a free spot near centre (small spiral search)
  let r = 0;
  let placed = false;
  for (let attempt = 0; attempt < 30 && !placed; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const candidate: Vec2 = {
      x: CENTER + Math.cos(a) * r,
      y: CENTER + Math.sin(a) * r,
    };
    const conflict = state.coins.some(
      (other) => other.id !== coinId && other.active && dist(other.pos, candidate) < other.radius + coin.radius + 1,
    );
    if (!conflict) {
      coin.pos = candidate;
      placed = true;
    } else {
      r += coin.radius * 0.6;
    }
  }
  if (!placed) {
    coin.pos = { x: CENTER, y: CENTER };
  }
  coin.vel = { x: 0, y: 0 };
}

// ─── TIMER ──────────────────────────────────────────────────────────────────

/**
 * Decrement the turn timer. When it reaches 0 during the AIMING phase, the
 * turn is auto-passed to the opponent (no foul, no score change).
 */
export function tickTurnTimer(state: CarromState, dtSeconds: number): CarromState {
  if (state.phase !== "aiming") return state;
  const remaining = Math.max(0, state.turnSecondsLeft - dtSeconds);
  if (remaining <= 0) {
    const opponent: Player = state.turn === "player1" ? "player2" : "player1";
    return {
      ...state,
      turn: opponent,
      striker: makeStriker(opponent),
      turnSecondsLeft: 60,
      foulReason: "turn_timeout",
    };
  }
  return { ...state, turnSecondsLeft: remaining };
}

// ─── SERIALIZATION ──────────────────────────────────────────────────────────
export function serializeState(state: CarromState): string { return JSON.stringify(state); }
export function deserializeState(data: string): CarromState { return JSON.parse(data); }
