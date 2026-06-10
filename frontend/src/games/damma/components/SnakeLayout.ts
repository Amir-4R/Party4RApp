// =============================================================================
// damma/components/SnakeLayout.ts — STABLE serpentine layout
// =============================================================================
// Builds a deterministic chain layout where:
//
//   • Tiles use a SINGLE FIXED scale — no auto-shrink. So existing tiles
//     NEVER reposition when a new tile is appended.
//   • The first tile always lands at a constant (x, y) anchor regardless
//     of how many tiles are currently on the board.
//   • Each subsequent tile's position is purely a function of its CHAIN
//     INDEX, the play area dimensions, and the fixed scale — so position
//     [i] is identical across renders.
//   • The chain bends 90° via vertical "corner" tiles at row edges.
//   • Tiles are sized small enough that the full 28-tile DS6 deck fits
//     comfortably on a phone-sized board.
//
// Returned coordinates are CENTER (x, y); the caller positions the tile
// by its top-left at (x − w/2, y − h/2). Coordinates are PHYSICAL pixels
// — never logical-start / logical-end — so the layout is fully immune to
// RTL ("Arabic mode") flipping.
// =============================================================================

// Base tile dims at scale = 1.
export const TILE_W = 72;
export const TILE_H = 36;
export const TILE_GAP = 3;
export const ROW_GAP = 6;

// FIXED scale — every tile renders at exactly this size, on every board
// state. Picked so ~6 tiles fit per row on a 360-px-wide play area and the
// full 28-tile chain comfortably fits in 4-5 rows. Smaller = more room
// for long matches, larger = easier to read individual pips.
export const FIXED_TILE_SCALE = 0.62;

// How many rows of horizontal tiles we ASSUME the chain will eventually
// fill. Used only to pre-allocate the vertical centring offset so the
// chain visually starts in the middle of the table and grows downward
// WITHOUT shifting existing tiles upward as new rows appear.
const ASSUMED_TOTAL_ROWS = 4;

export interface SnakePos {
  /** Chain index (0 = leftmost in the engine board[] array). */
  idx: number;
  /** Absolute CENTER X inside the play area (physical px from left edge). */
  x: number;
  /** Absolute CENTER Y inside the play area. */
  y: number;
  /** Rotation in degrees. 0 / 90 / 180 / 270. */
  rotation: number;
  /** Vertical (corner) tile? */
  isVertical: boolean;
}

export interface SnakeLayoutResult {
  positions: SnakePos[];
  scale: number;
  /** True when the chain would not fit even at MIN scale. Caller may clip. */
  overflow: boolean;
}

/**
 * Compute (or recompute) positions for every tile in the chain.
 *
 * IMPORTANT: This function is PURE and DETERMINISTIC. Given the same
 * (N, playW, playH) inputs it always returns the same positions. Most
 * importantly, the position of board[i] is INDEPENDENT of the current
 * value of N — so adding a new tile NEVER shifts existing tiles.
 */
export function buildSnakeLayout(
  N: number, playW: number, playH: number,
): SnakeLayoutResult {
  if (N <= 0 || playW <= 0 || playH <= 0) {
    return { positions: [], scale: FIXED_TILE_SCALE, overflow: false };
  }
  return computeLayout(N, playW, playH, FIXED_TILE_SCALE);
}

function computeLayout(
  N: number, playW: number, playH: number, scale: number,
): SnakeLayoutResult {
  const tw = TILE_W * scale;
  const th = TILE_H * scale;
  const gap = Math.max(2, TILE_GAP * scale);
  const rowGap = Math.max(4, ROW_GAP * scale);

  // Reserve corner-bounding-box width on both sides of each row.
  const availW = Math.max(tw + gap, playW - 2 * (th + gap));
  const perRow = Math.max(1, Math.floor(availW / (tw + gap)));

  // Center-to-center distance between rows.
  const rowH = (tw + th) / 2 + rowGap;

  // VERTICAL CENTRING uses an ASSUMED total row count rather than the
  // actual segment count. This means the y of row 0 is a CONSTANT — it
  // never changes when the chain grows from 1 → 10 → 20 tiles. Existing
  // tiles stay put.
  const assumedTotalH = (ASSUMED_TOTAL_ROWS - 1) * rowH + th;
  const yOffset = Math.max(th / 2 + 8, (playH - assumedTotalH) / 2 + th / 2);

  // Horizontal anchors for the row (kept constant across rows so corners
  // line up across rows).
  const xLeft = (playW / 2) - ((perRow - 1) * (tw + gap)) / 2;
  const xRight = (playW / 2) + ((perRow - 1) * (tw + gap)) / 2;

  // Walk the chain segment-by-segment, computing positions for the FIRST
  // N tiles. We compute up to the actual N, but we DO NOT vary anything
  // based on N — positions[0..k] are always identical for any N ≥ k+1.
  const positions: SnakePos[] = [];
  let chainIdx = 0;
  let seg = 0;
  while (chainIdx < N) {
    const goingRight = seg % 2 === 0;
    const yRow = yOffset + seg * rowH;

    // How many tiles will live in THIS row? In FULL segments (≠ last) it's
    // exactly `perRow` horizontal tiles followed by 1 vertical corner. For
    // the FINAL segment we just take whatever's left.
    // We don't actually need to know "isLast" upfront — we just walk forward
    // and decide as we go.
    let placedInRow = 0;
    while (placedInRow < perRow && chainIdx < N) {
      // Place a horizontal tile.
      const rowSpan = (perRow - 1) * (tw + gap);
      const xStart = goingRight ? (playW / 2 - rowSpan / 2) : (playW / 2 + rowSpan / 2);
      const j = placedInRow;
      const x = goingRight ? (xStart + j * (tw + gap)) : (xStart - j * (tw + gap));
      // Tiles in LEFT-going rows are rendered rotated 180° so adjacent
      // values stay visually continuous (since their on-screen order is
      // reversed relative to the chain order).
      positions.push({
        idx: chainIdx,
        x, y: yRow,
        rotation: goingRight ? 0 : 180,
        isVertical: false,
      });
      chainIdx++;
      placedInRow++;
    }

    // After a full row of perRow tiles, place a corner ONLY if more tiles
    // remain in the chain. Otherwise the chain ends mid-row.
    if (chainIdx < N) {
      const yCorner = yRow + rowH / 2;
      const xCorner = goingRight
        ? xRight + (tw + th) / 2 + gap
        : xLeft - (tw + th) / 2 - gap;
      positions.push({
        idx: chainIdx,
        x: xCorner, y: yCorner,
        rotation: goingRight ? 90 : 270,
        isVertical: true,
      });
      chainIdx++;
    }

    seg++;
    // Safety: avoid an infinite loop if perRow somehow ends up at 0.
    if (seg > 200) break;
  }

  // Overflow detection — chain ran beyond the assumed row count.
  const overflow = seg > ASSUMED_TOTAL_ROWS;

  return { positions, scale, overflow };
}

// Re-exported for callers that need to size tile sprites.
export const MIN_SCALE = FIXED_TILE_SCALE;
export const MAX_SCALE = FIXED_TILE_SCALE;
