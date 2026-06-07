// =============================================================================
// src/games/chess/engine.ts — Party4R Chess Engine
// =============================================================================
// محرّك شطرنج كامل بمنطق حقيقي:
//   - كل القطع وحركاتها القانونية
//   - الكش (check)، الكش مات (checkmate)، التعادل (stalemate)
//   - التبييت (castling)، الترقية (promotion)، الأخذ بالتجاوز (en passant)
//   - بنية جاهزة للأونلاين (serializable state)
// =============================================================================

export type Color = "white" | "black";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Square {
  row: number; // 0-7 (0 = rank 8, 7 = rank 1)
  col: number; // 0-7 (0 = file a)
}

export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  castle?: "king" | "queen";
  enPassant?: boolean;
}

export type Board = (Piece | null)[][];

export interface GameState {
  board: Board;
  turn: Color;
  moveHistory: Move[];
  castlingRights: {
    whiteKing: boolean;  whiteQueen: boolean;
    blackKing: boolean;  blackQueen: boolean;
  };
  enPassantTarget: Square | null;
  halfMoveClock: number;   // for 50-move rule
  fullMoveNumber: number;
}

export type GameResult =
  | { status: "playing" }
  | { status: "check"; color: Color }
  | { status: "checkmate"; winner: Color }
  | { status: "stalemate" }
  | { status: "draw"; reason: string };

// ── Initial Setup ─────────────────────────────────────────────────────────────

const BACK_RANK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

export function createInitialState(): GameState {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));

  // Black pieces (top, rows 0-1)
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: BACK_RANK[col], color: "black" };
    board[1][col] = { type: "p", color: "black" };
  }
  // White pieces (bottom, rows 6-7)
  for (let col = 0; col < 8; col++) {
    board[7][col] = { type: BACK_RANK[col], color: "white" };
    board[6][col] = { type: "p", color: "white" };
  }

  return {
    board,
    turn: "white",
    moveHistory: [],
    castlingRights: {
      whiteKing: true, whiteQueen: true,
      blackKing: true, blackQueen: true,
    },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const sameSquare = (a: Square, b: Square) => a.row === b.row && a.col === b.col;
const opposite = (c: Color): Color => (c === "white" ? "black" : "white");

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function findKing(board: Board, color: Color): Square | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) return { row: r, col: c };
    }
  return null;
}

// ── Pseudo-legal moves (ignoring check) ───────────────────────────────────────

function pseudoMoves(state: GameState, sq: Square): Square[] {
  const { board } = state;
  const piece = board[sq.row][sq.col];
  if (!piece) return [];

  const moves: Square[] = [];
  const { row, col } = sq;
  const color = piece.color;
  const dir = color === "white" ? -1 : 1; // white moves up (row decreases)

  const addSlide = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) moves.push({ row: r, col: c });
      else {
        if (target.color !== color) moves.push({ row: r, col: c });
        break;
      }
      r += dr; c += dc;
    }
  };

  switch (piece.type) {
    case "p": {
      // Forward one
      if (inBounds(row + dir, col) && !board[row + dir][col]) {
        moves.push({ row: row + dir, col });
        // Forward two from start
        const startRow = color === "white" ? 6 : 1;
        if (row === startRow && !board[row + 2 * dir][col]) {
          moves.push({ row: row + 2 * dir, col });
        }
      }
      // Captures (diagonal)
      for (const dc of [-1, 1]) {
        const r = row + dir, c = col + dc;
        if (!inBounds(r, c)) continue;
        const target = board[r][c];
        if (target && target.color !== color) moves.push({ row: r, col: c });
        // En passant
        if (state.enPassantTarget && state.enPassantTarget.row === r && state.enPassantTarget.col === c) {
          moves.push({ row: r, col: c });
        }
      }
      break;
    }
    case "n": {
      const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of deltas) {
        const r = row + dr, c = col + dc;
        if (inBounds(r, c) && (!board[r][c] || board[r][c]!.color !== color))
          moves.push({ row: r, col: c });
      }
      break;
    }
    case "b": [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => addSlide(dr,dc)); break;
    case "r": [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => addSlide(dr,dc)); break;
    case "q": [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => addSlide(dr,dc)); break;
    case "k": {
      const deltas = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      for (const [dr, dc] of deltas) {
        const r = row + dr, c = col + dc;
        if (inBounds(r, c) && (!board[r][c] || board[r][c]!.color !== color))
          moves.push({ row: r, col: c });
      }
      // Castling
      const rights = state.castlingRights;
      const homeRow = color === "white" ? 7 : 0;
      if (row === homeRow && col === 4 && !isSquareAttacked(board, { row: homeRow, col: 4 }, opposite(color))) {
        const kingSide  = color === "white" ? rights.whiteKing  : rights.blackKing;
        const queenSide = color === "white" ? rights.whiteQueen : rights.blackQueen;
        // King-side
        if (kingSide && !board[homeRow][5] && !board[homeRow][6] &&
            board[homeRow][7]?.type === "r" &&
            !isSquareAttacked(board, { row: homeRow, col: 5 }, opposite(color)) &&
            !isSquareAttacked(board, { row: homeRow, col: 6 }, opposite(color))) {
          moves.push({ row: homeRow, col: 6 });
        }
        // Queen-side
        if (queenSide && !board[homeRow][3] && !board[homeRow][2] && !board[homeRow][1] &&
            board[homeRow][0]?.type === "r" &&
            !isSquareAttacked(board, { row: homeRow, col: 3 }, opposite(color)) &&
            !isSquareAttacked(board, { row: homeRow, col: 2 }, opposite(color))) {
          moves.push({ row: homeRow, col: 2 });
        }
      }
      break;
    }
  }
  return moves;
}

// ── Attack detection ──────────────────────────────────────────────────────────

function isSquareAttacked(board: Board, sq: Square, byColor: Color): boolean {
  // Pawns
  const pawnDir = byColor === "white" ? 1 : -1; // attacker pawn direction toward sq
  for (const dc of [-1, 1]) {
    const r = sq.row + pawnDir, c = sq.col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === byColor && p.type === "p") return true;
    }
  }
  // Knights
  const knightDeltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of knightDeltas) {
    const r = sq.row + dr, c = sq.col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === byColor && p.type === "n") return true;
    }
  }
  // Sliding: bishop/queen (diagonals), rook/queen (straights)
  const diag = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const straight = [[-1,0],[1,0],[0,-1],[0,1]];
  const checkSlide = (deltas: number[][], types: PieceType[]) => {
    for (const [dr, dc] of deltas) {
      let r = sq.row + dr, c = sq.col + dc;
      while (inBounds(r, c)) {
        const p = board[r][c];
        if (p) {
          if (p.color === byColor && types.includes(p.type)) return true;
          break;
        }
        r += dr; c += dc;
      }
    }
    return false;
  };
  if (checkSlide(diag, ["b", "q"])) return true;
  if (checkSlide(straight, ["r", "q"])) return true;
  // King
  const kingDeltas = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (const [dr, dc] of kingDeltas) {
    const r = sq.row + dr, c = sq.col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === byColor && p.type === "k") return true;
    }
  }
  return false;
}

export function isInCheck(state: GameState, color: Color): boolean {
  const king = findKing(state.board, color);
  if (!king) return false;
  return isSquareAttacked(state.board, king, opposite(color));
}

// ── Legal moves (filter out moves that leave king in check) ────────────────────

export function legalMoves(state: GameState, sq: Square): Square[] {
  const piece = state.board[sq.row][sq.col];
  if (!piece || piece.color !== state.turn) return [];

  return pseudoMoves(state, sq).filter((to) => {
    const test = applyMoveRaw(state, sq, to);
    return !isInCheck(test, piece.color);
  });
}

// ── Apply move (raw — no validation, used internally) ──────────────────────────

function applyMoveRaw(state: GameState, from: Square, to: Square, promotion?: PieceType): GameState {
  const board = cloneBoard(state.board);
  const piece = board[from.row][from.col]!;
  const captured = board[to.row][to.col];

  // En passant capture
  let enPassantCapture = false;
  if (piece.type === "p" && state.enPassantTarget &&
      sameSquare(to, state.enPassantTarget) && !captured) {
    board[from.row][to.col] = null; // remove the passed pawn
    enPassantCapture = true;
  }

  // Move piece
  board[to.row][to.col] = piece;
  board[from.row][from.col] = null;

  // Promotion
  if (piece.type === "p" && (to.row === 0 || to.row === 7)) {
    board[to.row][to.col] = { type: promotion || "q", color: piece.color };
  }

  // Castling — move the rook
  if (piece.type === "k" && Math.abs(to.col - from.col) === 2) {
    const homeRow = from.row;
    if (to.col === 6) { // king-side
      board[homeRow][5] = board[homeRow][7];
      board[homeRow][7] = null;
    } else if (to.col === 2) { // queen-side
      board[homeRow][3] = board[homeRow][0];
      board[homeRow][0] = null;
    }
  }

  // Update castling rights
  const rights = { ...state.castlingRights };
  if (piece.type === "k") {
    if (piece.color === "white") { rights.whiteKing = false; rights.whiteQueen = false; }
    else { rights.blackKing = false; rights.blackQueen = false; }
  }
  if (piece.type === "r") {
    if (from.row === 7 && from.col === 0) rights.whiteQueen = false;
    if (from.row === 7 && from.col === 7) rights.whiteKing = false;
    if (from.row === 0 && from.col === 0) rights.blackQueen = false;
    if (from.row === 0 && from.col === 7) rights.blackKing = false;
  }

  // En passant target for next move
  let enPassantTarget: Square | null = null;
  if (piece.type === "p" && Math.abs(to.row - from.row) === 2) {
    enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
  }

  return {
    ...state,
    board,
    enPassantTarget,
    castlingRights: rights,
  };
}

// ── Public: make a validated move ──────────────────────────────────────────────

export function makeMove(state: GameState, from: Square, to: Square, promotion?: PieceType): GameState | null {
  const piece = state.board[from.row][from.col];
  if (!piece || piece.color !== state.turn) return null;

  const legal = legalMoves(state, from);
  if (!legal.some((m) => sameSquare(m, to))) return null;

  const captured = state.board[to.row][to.col];
  const next = applyMoveRaw(state, from, to, promotion);

  // Build move record
  const move: Move = {
    from, to, piece: piece.type,
    captured: captured?.type,
    promotion: piece.type === "p" && (to.row === 0 || to.row === 7) ? (promotion || "q") : undefined,
    castle: piece.type === "k" && Math.abs(to.col - from.col) === 2
      ? (to.col === 6 ? "king" : "queen") : undefined,
  };

  return {
    ...next,
    turn: opposite(state.turn),
    moveHistory: [...state.moveHistory, move],
    halfMoveClock: (piece.type === "p" || captured) ? 0 : state.halfMoveClock + 1,
    fullMoveNumber: state.turn === "black" ? state.fullMoveNumber + 1 : state.fullMoveNumber,
  };
}

// ── Game result detection ──────────────────────────────────────────────────────

export function getGameResult(state: GameState): GameResult {
  const color = state.turn;
  const inCheck = isInCheck(state, color);

  // Any legal moves available?
  let hasLegalMove = false;
  for (let r = 0; r < 8 && !hasLegalMove; r++)
    for (let c = 0; c < 8 && !hasLegalMove; c++) {
      const p = state.board[r][c];
      if (p && p.color === color) {
        if (legalMoves(state, { row: r, col: c }).length > 0) hasLegalMove = true;
      }
    }

  if (!hasLegalMove) {
    if (inCheck) return { status: "checkmate", winner: opposite(color) };
    return { status: "stalemate" };
  }

  // 50-move rule
  if (state.halfMoveClock >= 100) return { status: "draw", reason: "50-move rule" };

  if (inCheck) return { status: "check", color };
  return { status: "playing" };
}

// ── Serialization (for online sync) ────────────────────────────────────────────

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(data: string): GameState {
  return JSON.parse(data) as GameState;
}

// FEN-like notation for compact transfer (optional)
export function toFEN(state: GameState): string {
  const pieceChar = (p: Piece) => {
    const c = p.type;
    return p.color === "white" ? c.toUpperCase() : c;
  };
  const rows = state.board.map((row) => {
    let fen = "", empty = 0;
    for (const cell of row) {
      if (!cell) empty++;
      else { if (empty) { fen += empty; empty = 0; } fen += pieceChar(cell); }
    }
    if (empty) fen += empty;
    return fen;
  });
  return `${rows.join("/")} ${state.turn === "white" ? "w" : "b"}`;
}
