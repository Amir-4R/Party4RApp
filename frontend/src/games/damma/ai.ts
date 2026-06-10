// =============================================================================
// src/games/damma/ai.ts — Dominoes Bot (3 difficulty levels)
// =============================================================================
//   • easy   → picks a random playable tile (with random side).
//   • medium → keeps small-pip tiles for endgame; plays the highest-pip tile
//              first; prefers playing doubles early.
//   • hard   → simulates one ply ahead:
//                · scores each candidate move with: pip-cost reduction
//                  + opponent-block likelihood (rare numbers at the ends)
//                  + double preservation when board is wide open.
//              Returns the highest-scoring legal move.
// All decisions use the existing engine helpers — no engine changes.
// =============================================================================
import {
  DammaState, Domino, PlayerId,
  getPlayerOptions, getPlayableSides, playDomino,
} from "./engine";

export type DammaDifficulty = "easy" | "medium" | "hard";

export interface DammaPlan {
  kind: "play" | "draw" | "pass";
  tileId?: string;
  side?: "left" | "right";
}

const pipsOf = (d: Domino) => d.left + d.right;

// Frequency of each pip value currently CLOSED in the chain (i.e. counted as
// "burned" — not available for matching at the open ends). Higher count = a
// rarer match for the opponent. Used by the hard bot to estimate blocking.
function endValueRarity(state: DammaState, value: number): number {
  let count = 0;
  for (const d of state.board) {
    if (d.left === value) count++;
    if (d.right === value) count++;
  }
  // doubles burn faster, weigh slightly more
  return count;
}

// Estimate how many tiles in the OPPONENT'S possible pool (unseen pool =
// boneyard ∪ opponents' hands) could match the given end-value. We can only
// see the board + own hand, so we count by elimination on the full 28-set.
function unseenMatches(state: DammaState, me: PlayerId, value: number): number {
  // All 28 tiles minus those we KNOW (own hand + board)
  const seen = new Set<string>();
  for (const d of state.hands[me]) seen.add(d.id);
  for (const d of state.board) seen.add(d.id);
  let matches = 0;
  for (let l = 0; l <= 6; l++) {
    for (let r = l; r <= 6; r++) {
      const id = `${l}-${r}`;
      if (seen.has(id)) continue;
      if (l === value || r === value) matches++;
    }
  }
  return matches;
}

// Score a single candidate move (for medium / hard).  Higher = better.
function scoreMove(
  state: DammaState,
  me: PlayerId,
  tile: Domino,
  side: "left" | "right",
  difficulty: "medium" | "hard",
): number {
  // 1) Get rid of high-pip tiles first → strong baseline for both medium & hard
  let score = pipsOf(tile) * 2;

  // 2) Doubles: keep early, dump late
  const isDouble = tile.left === tile.right;
  if (isDouble) {
    const handFull = state.hands[me].length;
    // Early game (≥5 tiles in hand) → -8 pen for playing it
    // Late game (≤3 tiles)         → +6 bonus
    score += handFull >= 5 ? -8 : handFull <= 3 ? 6 : -2;
  }

  if (difficulty === "hard") {
    // Simulate the move to read the resulting open ends.
    const after = playDomino(state, me, tile.id, side);
    if (after) {
      const newLeft = after.leftEnd;
      const newRight = after.rightEnd;
      // 3) Opponent-block heuristic: pick a side whose new open value has
      //    FEW remaining matches in the unseen pool. We penalise easy ends.
      const lm = newLeft  != null ? unseenMatches(after, me, newLeft)  : 0;
      const rm = newRight != null ? unseenMatches(after, me, newRight) : 0;
      // total matches at the two open ends (lower = harder for opponent)
      score += (24 - (lm + rm)) * 0.8;

      // 4) Self-mobility: prefer ends that we ourselves can still match next
      //    turn so we don't paint ourselves into a corner.
      const myCounts = state.hands[me].reduce<Record<number, number>>(
        (acc, d) => { acc[d.left] = (acc[d.left] || 0) + 1; acc[d.right] = (acc[d.right] || 0) + 1; return acc; },
        {} as Record<number, number>,
      );
      // Subtract the tile being played from those counts so the eval reflects
      // OUR remaining hand after the move.
      myCounts[tile.left]  = (myCounts[tile.left]  || 0) - 1;
      myCounts[tile.right] = (myCounts[tile.right] || 0) - 1;
      const lmine = newLeft  != null ? (myCounts[newLeft]  || 0) : 0;
      const rmine = newRight != null ? (myCounts[newRight] || 0) : 0;
      score += (lmine + rmine) * 1.5;

      // 5) Rarity of the burnt value on the chain — pushing rare values
      //    further into the chain makes future matches harder for opponents.
      const burnt = side === "left" ? state.leftEnd : state.rightEnd;
      if (burnt != null) score += endValueRarity(state, burnt) * 0.6;
    }
  }

  return score;
}

// Public API.
export function pickDammaMove(
  state: DammaState,
  me: PlayerId,
  difficulty: DammaDifficulty,
): DammaPlan {
  const opts = getPlayerOptions(state, me);

  // No playable tiles
  if (opts.playableTiles.length === 0) {
    if (opts.mustDraw) return { kind: "draw" };
    return { kind: "pass" };
  }

  // ── EASY ─────────────────────────────────────────────────────────────────
  if (difficulty === "easy") {
    const tile = opts.playableTiles[Math.floor(Math.random() * opts.playableTiles.length)];
    const sides = getPlayableSides(state, tile);
    const side = sides[Math.floor(Math.random() * sides.length)];
    return { kind: "play", tileId: tile.id, side };
  }

  // ── MEDIUM / HARD ────────────────────────────────────────────────────────
  let best: { tileId: string; side: "left" | "right"; score: number } | null = null;
  for (const tile of opts.playableTiles) {
    const sides = getPlayableSides(state, tile);
    for (const s of sides) {
      const sc = scoreMove(state, me, tile, s, difficulty);
      if (!best || sc > best.score) best = { tileId: tile.id, side: s, score: sc };
    }
  }
  if (!best) {
    // Fallback (shouldn't happen — we already checked playableTiles)
    const tile = opts.playableTiles[0];
    const side = getPlayableSides(state, tile)[0];
    return { kind: "play", tileId: tile.id, side };
  }
  return { kind: "play", tileId: best.tileId, side: best.side };
}
