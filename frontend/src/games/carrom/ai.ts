// =============================================================================
// src/games/carrom/ai.ts — Party4R Carrom AI (Beginner level)
// =============================================================================
// Simple, readable AI that:
//   1. Finds the nearest active coin to any pocket (preferring coins matching
//      its "side" / colour — defaults to neutral for now).
//   2. Positions the striker along its throw line at the X (or Y) closest to
//      that coin.
//   3. Aims directly at the coin from the striker.
//   4. Adds a small random angle jitter and random power so the bot doesn't
//      play perfectly every time (beginner skill).
//
// Returns a `BotPlan` that the caller can apply by calling
// `setStrikerPosition()` followed by `shootStriker()`.
// =============================================================================
import {
  CarromState, Coin, POCKETS, throwLineForPlayer, STRIKER_RADIUS,
  THROW_LINE_LENGTH,
} from "./engine";

export interface BotPlan {
  /** Where to put the striker, in board coords (already on the throw line). */
  strikerX: number;
  strikerY: number;
  /** Angle (radians) the striker should be shot in. */
  angle: number;
  /** Normalized power 0..1. */
  power: number;
  /** Debug description of the chosen target. */
  reason: string;
}

const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

/** Returns the active coin nearest to any pocket (best opportunity). */
function pickBestTarget(state: CarromState): Coin | null {
  const candidates = state.coins.filter((c) => c.active);
  if (candidates.length === 0) return null;

  let best: { coin: Coin; score: number } | null = null;
  for (const coin of candidates) {
    // Distance to nearest pocket
    let minPocketDist = Infinity;
    for (const p of POCKETS) {
      const d = dist(coin.pos.x, coin.pos.y, p.x, p.y);
      if (d < minPocketDist) minPocketDist = d;
    }
    // Lower distance to pocket = better target. Queen gets a slight bonus
    // when there's a coin to cover it with later.
    let score = -minPocketDist;
    if (coin.color === "queen" && !state.queenAwarded) {
      score += 30; // small queen incentive
    }
    if (!best || score > best.score) {
      best = { coin, score };
    }
  }
  return best?.coin || null;
}

/**
 * Produce a beginner-level shot plan for the current player.
 *
 * @param state    the current game state (must be aiming)
 * @param skill    0 = perfectly accurate, 1 = wildly inaccurate (default 0.35
 *                 → beginner)
 */
export function planBotShot(state: CarromState, skill: number = 0.35): BotPlan {
  const line = throwLineForPlayer(state.turn);
  const target = pickBestTarget(state);

  // Default: shoot straight ahead at low power if no target
  if (!target) {
    const cx = (line.start.x + line.end.x) / 2;
    const cy = (line.start.y + line.end.y) / 2;
    return {
      strikerX: cx,
      strikerY: cy,
      angle: line.horizontal
        ? (line.side === "bottom" ? -Math.PI / 2 : Math.PI / 2)
        : (line.side === "left" ? 0 : Math.PI),
      power: 0.4,
      reason: "no-target",
    };
  }

  // 1) Find striker position on the throw line that minimises distance to
  //    the target. For horizontal lines, that means matching X; for vertical,
  //    matching Y.
  let strikerX: number, strikerY: number;
  if (line.horizontal) {
    const minX = line.start.x + STRIKER_RADIUS;
    const maxX = line.end.x - STRIKER_RADIUS;
    strikerX = Math.max(minX, Math.min(maxX, target.pos.x));
    strikerY = line.start.y;
  } else {
    const minY = line.start.y + STRIKER_RADIUS;
    const maxY = line.end.y - STRIKER_RADIUS;
    strikerY = Math.max(minY, Math.min(maxY, target.pos.y));
    strikerX = line.start.x;
  }

  // 2) Aim straight at the target.
  const angleToTarget = Math.atan2(target.pos.y - strikerY, target.pos.x - strikerX);

  // 3) Add jitter (skill-controlled) so the bot misses sometimes.
  //    Beginner: up to ±10° error and randomized power.
  const angleJitter = (Math.random() - 0.5) * skill * (Math.PI / 9); // ±10°
  const angle = angleToTarget + angleJitter;

  // 4) Power: based on distance — far targets need more power.
  const targetDistance = dist(strikerX, strikerY, target.pos.x, target.pos.y);
  // THROW_LINE_LENGTH ≈ 470. Use it as a yardstick.
  const basePower = 0.4 + Math.min(0.4, targetDistance / (THROW_LINE_LENGTH * 1.5));
  // Beginner also randomises power
  const powerJitter = (Math.random() - 0.5) * skill * 0.25;
  const power = Math.max(0.3, Math.min(0.95, basePower + powerJitter));

  return {
    strikerX,
    strikerY,
    angle,
    power,
    reason: `target=${target.id} (${target.color})`,
  };
}
