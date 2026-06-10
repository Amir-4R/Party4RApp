// =============================================================================
// damma/components/SnakeLayout.ts — true zigzag layout for the domino chain
// =============================================================================
// Pure layout algorithm. Given a chain length and the playable area, returns
// a per-tile absolute position + rotation that produces a serpentine path:
//
//   row 0 going RIGHT:   [==][==][==][==][==][==]
//                                                [c]   ← corner (vertical)
//   row 1 going LEFT:    [==][==][==][==][==][==]
//                       [c]                            ← corner
//   row 2 going RIGHT:   [==][==][==] …
//
// The corner is a tile drawn vertically (rotation = 90°) sitting at the end
// of the row. Its top half visually aligns with the row above, its bottom
// half with the row below — creating the natural "L-turn" of a real domino
// table where the chain wraps without escaping the board.
//
// Key invariants:
//   • Every tile (horizontal + corner) is positioned by its CENTER (x, y).
//   • No tile's bounding box ever crosses the play area's edges.
//   • Larger chains automatically downscale until they fit.
// =============================================================================

// Base tile dims (when scale === 1). Horizontal orientation:
//   width = TILE_W   |   height = TILE_H
// Vertical (corner) orientation flips them.
export const TILE_W = 72;
export const TILE_H = 36;
export const TILE_GAP = 3;
export const ROW_GAP = 6;
export const MIN_SCALE = 0.32;
export const MAX_SCALE = 1.0;
const SCALE_STEPS = 16;

export interface SnakePos {
  /** Index of this tile inside the board[] chain (0 = leftmost in chain order). */
  idx: number;
  /** Absolute CENTER X coordinate inside the playable area. */
  x: number;
  /** Absolute CENTER Y coordinate. */
  y: number;
  /** Rotation in degrees. 0 = horizontal, 90 = vertical (corner). */
  rotation: number;
  /** Whether this tile is rendered vertically (i.e. it's a "corner"). */
  isVertical: boolean;
}

export interface SnakeLayoutResult {
  positions: SnakePos[];
  scale: number;
  /** True when even at MIN_SCALE the chain doesn't fit cleanly — caller may
   * choose to clip or scroll. */
  overflow: boolean;
}

/** Build a serpentine layout for `N` tiles inside a play area of (W, H). */
export function buildSnakeLayout(N: number, playW: number, playH: number): SnakeLayoutResult {
  if (N <= 0 || playW <= 0 || playH <= 0) {
    return { positions: [], scale: 1, overflow: false };
  }

  for (let step = 0; step < SCALE_STEPS; step++) {
    const scale = MAX_SCALE - (step * (MAX_SCALE - MIN_SCALE)) / (SCALE_STEPS - 1);
    const result = tryFit(N, playW, playH, scale);
    if (result) return result;
  }

  // Fallback at MIN_SCALE — still return SOMETHING so the screen doesn't
  // break. The caller may detect `overflow` and clip / scroll.
  const fallback = tryFit(N, playW, playH, MIN_SCALE, true);
  return fallback ?? { positions: [], scale: MIN_SCALE, overflow: true };
}

function tryFit(
  N: number, playW: number, playH: number, scale: number, force = false,
): SnakeLayoutResult | null {
  const tw = TILE_W * scale;
  const th = TILE_H * scale;
  const gap = Math.max(2, TILE_GAP * scale);
  const rowGap = Math.max(4, ROW_GAP * scale);

  // "perRow" = max number of horizontal tiles per row. We must reserve
  // enough room on BOTH sides of the centered row for a vertical corner
  // tile (one corner per row, but rows alternate which side they're on so
  // we reserve symmetrically to keep the layout neat across rows).
  // A corner has bounding box (th wide × tw tall). Need (th + gap) of
  // clearance on each side of the centered horizontal run.
  const availW = playW - 2 * (th + gap);
  const perRow = Math.max(1, Math.floor(availW / (tw + gap)));

  // Each full "segment" = perRow horizontal tiles + 1 corner (vertical).
  // The LAST segment may have fewer tiles and no trailing corner.
  // Compute how many segments we need.
  let segments = 0;
  let consumed = 0;
  while (consumed < N) {
    const remaining = N - consumed;
    if (remaining <= perRow) { segments++; consumed = N; break; }
    consumed += perRow + 1; // perRow horiz + 1 corner
    segments++;
  }

  // Each row center is rowH apart. The vertical "corner" spans roughly
  // (tw - th) more than the horizontal row, so rowH ≈ (tw + th)/2 + rowGap.
  const rowH = (tw + th) / 2 + rowGap;
  const totalH = (segments - 1) * rowH + th;

  if (!force && totalH > playH) return null;

  // Centering offset (vertical): place the SNAKE vertically centered.
  const yOffset = (playH - totalH) / 2 + th / 2; // y of row 0 center

  // Horizontal anchors: the row's leftmost & rightmost CENTER x.
  const xLeft = (playW / 2) - ((perRow - 1) * (tw + gap)) / 2;
  const xRight = (playW / 2) + ((perRow - 1) * (tw + gap)) / 2;

  const positions: SnakePos[] = [];
  let chainIdx = 0;

  for (let seg = 0; seg < segments; seg++) {
    const goingRight = seg % 2 === 0;
    const yRow = yOffset + seg * rowH;

    const isLast = (seg === segments - 1);
    const horizInRow = isLast ? (N - chainIdx) : perRow;

    // For the LAST partial segment, centre the actual tile run horizontally
    // so that short chains visually start in the middle of the board. For
    // full intermediate segments we keep the row anchored to the grid so
    // corners line up across rows.
    const rowSpan = (horizInRow - 1) * (tw + gap);
    const xStart = isLast
      ? (goingRight ? (playW / 2 - rowSpan / 2) : (playW / 2 + rowSpan / 2))
      : (goingRight ? xLeft : xRight);

    // Place horizontal tiles
    for (let j = 0; j < horizInRow; j++) {
      const x = goingRight ? (xStart + j * (tw + gap)) : (xStart - j * (tw + gap));
      positions.push({
        idx: chainIdx,
        x, y: yRow,
        rotation: 0,
        isVertical: false,
      });
      chainIdx++;
    }

    // Add corner (vertical) tile at the END of the row, unless this is
    // the final segment.
    if (!isLast && chainIdx < N) {
      const yCorner = yRow + rowH / 2;
      const xCorner = goingRight
        ? xRight + (tw + th) / 2 + gap        // right side of row going RIGHT
        : xLeft - (tw + th) / 2 - gap;        // left side of row going LEFT
      positions.push({
        idx: chainIdx,
        x: xCorner, y: yCorner,
        rotation: 90,
        isVertical: true,
      });
      chainIdx++;
    }
  }

  return { positions, scale, overflow: force };
}
