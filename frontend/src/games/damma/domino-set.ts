// =============================================================================
// damma/domino-set.ts — IMMUTABLE Double-Six domino set
// =============================================================================
// The official 28-tile Double-Six set. Built ONCE at module load and frozen
// so that no caller can ever add, remove, or mutate a tile. Every match
// shuffles a FRESH COPY of these references — never creates new tiles.
//
//   pairs: (0,0) (0,1) (0,2) (0,3) (0,4) (0,5) (0,6)
//          (1,1) (1,2) (1,3) (1,4) (1,5) (1,6)
//          (2,2) (2,3) (2,4) (2,5) (2,6)
//          (3,3) (3,4) (3,5) (3,6)
//          (4,4) (4,5) (4,6)
//          (5,5) (5,6)
//          (6,6)                                   total: 28
//
// Each tile has a STABLE id derived from its values (e.g. "0-0", "3-5") so
// two tiles can never share an id and ids never depend on runtime ordering.
// =============================================================================

export interface DominoTileRecord {
  /** Stable id derived from values, e.g. "3-5". */
  readonly id: string;
  /** Lower-or-equal pip value (always ≤ right). */
  readonly left: number;
  /** Higher-or-equal pip value. */
  readonly right: number;
}

function buildSet(): readonly DominoTileRecord[] {
  const set: DominoTileRecord[] = [];
  for (let l = 0; l <= 6; l++) {
    for (let r = l; r <= 6; r++) {
      set.push(Object.freeze({ id: `${l}-${r}`, left: l, right: r }));
    }
  }
  return Object.freeze(set);
}

/** The canonical 28-tile Double-Six set. Frozen at module load. */
export const DOMINO_SET_DS6: readonly DominoTileRecord[] = buildSet();

/** Sanity guard exported for tests. */
export const DOMINO_SET_DS6_COUNT = 28;

/**
 * Fisher-Yates shuffle. Returns a NEW array of references to tiles from the
 * canonical set — does NOT mutate the original set or any tile object.
 * Every match should call this exactly once at boot.
 */
export function shuffleDS6(rng: () => number = Math.random): DominoTileRecord[] {
  const copy = DOMINO_SET_DS6.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
