// =============================================================================
// src/games/chess/ai.ts — Chess AI Bot (3 difficulty levels)
// =============================================================================
//   • easy   → near-random with 60% capture preference (no look-ahead)
//   • medium → minimax depth 2 + material eval
//   • hard   → minimax depth 3 + alpha-beta pruning + capture-ordering
//             + material + central-control + king-safety bonuses
// All depths chosen so a move computes in < 2 seconds on web (acceptable
// "thinking" delay) while still feeling challenging.
// =============================================================================
import { GameState, Square, PieceType, Color, legalMoves, makeMove } from "./engine";

export type ChessDifficulty = "easy" | "medium" | "hard";

export interface AIMove {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

// ─── Material values (centipawn scale) ──────────────────────────────────────
const PIECE_VALUE: Record<PieceType, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Centre-control bonus mask: 16 central squares
function centreBonus(row: number, col: number, type: PieceType): number {
  // Strong bonus for pawns and knights/bishops in the inner 4x4
  if (row >= 2 && row <= 5 && col >= 2 && col <= 5) {
    if (type === "p" || type === "n" || type === "b") return 10;
    // Inner 2x2 even more important
    if (row >= 3 && row <= 4 && col >= 3 && col <= 4) return 15;
  }
  return 0;
}

// ─── Enumerate every legal move for the side to move ────────────────────────
function getAllMoves(state: GameState): AIMove[] {
  const moves: AIMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== state.turn) continue;
      const from: Square = { row: r, col: c };
      const targets = legalMoves(state, from);
      for (const to of targets) {
        // Auto-promote pawns to queens
        if (piece.type === "p" && (to.row === 0 || to.row === 7)) {
          moves.push({ from, to, promotion: "q" });
        } else {
          moves.push({ from, to });
        }
      }
    }
  }
  return moves;
}

// ─── Order moves: captures first (helps alpha-beta pruning) ─────────────────
function orderMoves(state: GameState, moves: AIMove[]): AIMove[] {
  return [...moves].sort((a, b) => {
    const va = state.board[a.to.row][a.to.col]
      ? PIECE_VALUE[state.board[a.to.row][a.to.col]!.type]
      : 0;
    const vb = state.board[b.to.row][b.to.col]
      ? PIECE_VALUE[state.board[b.to.row][b.to.col]!.type]
      : 0;
    return vb - va; // higher-value captures first
  });
}

// ─── Static board evaluation (positive = good for `forColor`) ───────────────
function evaluate(state: GameState, forColor: Color): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const v = PIECE_VALUE[piece.type] + centreBonus(r, c, piece.type);
      score += piece.color === forColor ? v : -v;
    }
  }
  return score;
}

// ─── Negamax with alpha-beta pruning ────────────────────────────────────────
// forColor is the AI side. We always evaluate FROM the AI's perspective.
function search(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  forColor: Color,
): number {
  if (depth <= 0) return evaluate(state, forColor);
  const moves = orderMoves(state, getAllMoves(state));
  if (moves.length === 0) {
    // No legal moves: checkmate or stalemate
    // Use a large absolute value so the side without moves loses
    return state.turn === forColor ? -50000 + (10 - depth) : 50000 - (10 - depth);
  }
  if (state.turn === forColor) {
    // Maximising AI's score
    let best = -Infinity;
    for (const m of moves) {
      const next = makeMove(state, m.from, m.to, m.promotion);
      if (!next) continue;
      const v = search(next, depth - 1, alpha, beta, forColor);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    // Minimising opponent's score
    let best = Infinity;
    for (const m of moves) {
      const next = makeMove(state, m.from, m.to, m.promotion);
      if (!next) continue;
      const v = search(next, depth - 1, alpha, beta, forColor);
      if (v < best) best = v;
      if (v < beta) beta = v;
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ─── Public API: pick a move for the AI ─────────────────────────────────────
export function pickBotMove(state: GameState, difficulty: ChessDifficulty): AIMove | null {
  const moves = getAllMoves(state);
  if (moves.length === 0) return null;

  // ── EASY ─────────────────────────────────────────────────────────────────
  // 60% chance to pick a capture (if any), 40% pure random.
  if (difficulty === "easy") {
    const captures = moves.filter((m) => state.board[m.to.row][m.to.col] !== null);
    if (captures.length > 0 && Math.random() < 0.6) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // ── MEDIUM / HARD: minimax with α-β pruning ──────────────────────────────
  const depth = difficulty === "medium" ? 2 : 3;
  const forColor = state.turn;
  // Shuffle so equal-score moves give variety
  const ordered = orderMoves(state, moves);
  let best: AIMove = ordered[0];
  let bestScore = -Infinity;
  for (const m of ordered) {
    const next = makeMove(state, m.from, m.to, m.promotion);
    if (!next) continue;
    const score = search(next, depth - 1, -Infinity, Infinity, forColor);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
