// =============================================================================
// damma/components/SnakeLayout.ts — STABLE serpentine layout w/ scale tiers
// =============================================================================
// Builds a deterministic chain layout. Caller picks the scale; the layout is
// purely a function of (N, playW, playH, scale). Within a single scale tier
// every tile keeps its (x, y) across re-renders. Zooming out happens in
// DISCRETE TIERS (managed by the parent component) so the visual size only
// changes a few times per match — and each transition is animated smoothly.
//
//   • Tiles use the SCALE supplied by the caller — no auto-shrink in here.
//   • The first tile lands at a constant anchor (y is computed assuming a
//     fixed pretend chain length so existing tiles never shift up/down).
//   • Each subsequent tile's position is a pure function of its chain index.
//   • The chain bends 90° via vertical "corner" tiles at row ends.
//
// Returned coordinates are CENTER (x, y); the caller renders by top-left at
// (x − w/2, y − h/2). Coordinates are PHYSICAL pixels — RTL has no effect.
// =============================================================================

// Base tile dims at scale = 1.
export const TILE_W = 72;
export const TILE_H = 36;
export const TILE_GAP = 3;
export const ROW_GAP = 6;

// ── Scale tiers — used by callers that want stepped zoom-out behaviour ──
// First tier is the LARGEST (most readable). The chain zooms out to a
// smaller tier ONLY when the current tier's layout would overflow. Each
// step is a big jump so the user experiences "a few clear zooms per match"
// rather than "tiny constant shrinks every turn".
export const SCALE_TIERS: readonly number[] = Object.freeze([0.95, 0.72, 0.55, 0.42, 0.32]);
export const DEFAULT_TIER_INDEX = 0;

// How many rows of horizontal tiles we ASSUME the chain will eventually
// fill at each tier. Used only to pre-allocate the vertical centring
// offset so the chain visually starts near the middle of the table and
// grows downward WITHOUT shifting existing tiles upward as new rows appear.
const ASSUMED_TOTAL_ROWS = 4;

export interface SnakePos {
  idx: number;
  x: number;
  y: number;
  rotation: number;
  isVertical: boolean;
}

export interface SnakeLayoutResult {
  positions: SnakePos[];
  scale: number;
  /** True when the chain at this scale would not fit comfortably in the
   * available area. Caller should bump to a smaller scale tier. */
  overflow: boolean;
}

/**
 * Compute positions for every tile in the chain at the given scale.
 *
 * Position of board[i] is a pure function of (i, playW, playH, scale) —
 * never depends on N. Adding tiles 1 → N+1 leaves positions[0..N-1] byte-
 * identical.
 */
export function buildSnakeLayout(
  N: number, playW: number, playH: number,
  scale: number = SCALE_TIERS[DEFAULT_TIER_INDEX],
): SnakeLayoutResult {
  if (N <= 0 || playW <= 0 || playH <= 0) {
    return { positions: [], scale, overflow: false };
  }
  return computeLayout(N, playW, playH, scale);
}

/**
 * Pick the LARGEST scale tier at which the chain fits the play area. Used
 * by the parent to decide when to step down to a smaller tier. Returns
 * the index into SCALE_TIERS (0 = largest).
 */
export function pickScaleTier(
  N: number, playW: number, playH: number, startTier = 0,
): number {
  for (let i = Math.max(0, startTier); i < SCALE_TIERS.length; i++) {
    const layout = computeLayout(N, playW, playH, SCALE_TIERS[i]);
    if (!layout.overflow) return i;
  }
  return SCALE_TIERS.length - 1;
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
  // actual segment count — so row 0's y is a CONSTANT regardless of N.
  const assumedTotalH = (ASSUMED_TOTAL_ROWS - 1) * rowH + th;
  const yOffset = Math.max(th / 2 + 8, (playH - assumedTotalH) / 2 + th / 2);

  // Horizontal anchors for each row, kept constant across rows so corners
  // line up vertically.
  const xLeft = (playW / 2) - ((perRow - 1) * (tw + gap)) / 2;
  const xRight = (playW / 2) + ((perRow - 1) * (tw + gap)) / 2;

  const positions: SnakePos[] = [];
  let chainIdx = 0;
  let seg = 0;
  let maxRowReached = 0;

  while (chainIdx < N) {
    const goingRight = seg % 2 === 0;
    const yRow = yOffset + seg * rowH;
    maxRowReached = seg;

    let placedInRow = 0;
    while (placedInRow < perRow && chainIdx < N) {
      const rowSpan = (perRow - 1) * (tw + gap);
      const xStart = goingRight ? (playW / 2 - rowSpan / 2) : (playW / 2 + rowSpan / 2);
      const j = placedInRow;
      const x = goingRight ? (xStart + j * (tw + gap)) : (xStart - j * (tw + gap));
      positions.push({
        idx: chainIdx,
        x, y: yRow,
        rotation: goingRight ? 0 : 180,
        isVertical: false,
      });
      chainIdx++;
      placedInRow++;
    }

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
    if (seg > 200) break;
  }

  // Overflow: the chain extended past the available play height with the
  // current scale. Parent should bump to the next tier.
  const usedH = yOffset + maxRowReached * rowH + th / 2;
  const overflow = usedH > playH - 4;  // 4 px safety margin

  return { positions, scale, overflow };
}

// Aliases — kept for backward compatibility with callers that imported the
// old names. New callers should use SCALE_TIERS / pickScaleTier directly.
export const MIN_SCALE = SCALE_TIERS[SCALE_TIERS.length - 1];
export const MAX_SCALE = SCALE_TIERS[0];
export const FIXED_TILE_SCALE = SCALE_TIERS[DEFAULT_TIER_INDEX];
