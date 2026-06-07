// =============================================================================
// src/games/damma/engine.ts — Party4R Damma (Dominoes) Engine
// =============================================================================
// محرّك ضمنة (دومينو) كامل:
//   - توزيع القطع (28 قطعة، 0-0 إلى 6-6)
//   - الأدوار بين اللاعبين
//   - القوانين: المطابقة على الأطراف
//   - السحب من البنك (boneyard)
//   - كشف الفوز والمسدود (blocked)
//   - حساب النقاط
// =============================================================================

export interface Domino {
  id: string;
  left: number;   // 0-6
  right: number;  // 0-6
}

export interface PlacedDomino extends Domino {
  // orientation on the board after placement
  flipped: boolean; // if true, right is the "outer" end
}

export type PlayerId = "player1" | "player2" | "player3" | "player4";

export interface DammaState {
  players: PlayerId[];
  hands: Record<PlayerId, Domino[]>;
  board: PlacedDomino[];       // the played chain (left → right)
  leftEnd: number | null;       // open value at left end
  rightEnd: number | null;      // open value at right end
  boneyard: Domino[];           // remaining draw pile
  turn: PlayerId;
  scores: Record<PlayerId, number>;
  phase: "playing" | "blocked" | "game_over";
  winner: PlayerId | null;
  passCount: number;            // consecutive passes (blocked detection)
}

// ── Build the full set of 28 dominoes ────────────────────────────────────────

function buildFullSet(): Domino[] {
  const set: Domino[] = [];
  for (let l = 0; l <= 6; l++)
    for (let r = l; r <= 6; r++)
      set.push({ id: `${l}-${r}`, left: l, right: r });
  return set;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Initial Setup ─────────────────────────────────────────────────────────────

export function createInitialState(playerCount: 2 | 3 | 4 = 2): DammaState {
  const allPlayers: PlayerId[] = ["player1", "player2", "player3", "player4"];
  const players = allPlayers.slice(0, playerCount);

  const deck = shuffle(buildFullSet());
  const handSize = playerCount === 2 ? 7 : playerCount === 3 ? 6 : 5;

  const hands: Record<PlayerId, Domino[]> = {} as any;
  const scores: Record<PlayerId, number> = {} as any;

  let idx = 0;
  for (const p of players) {
    hands[p] = deck.slice(idx, idx + handSize);
    scores[p] = 0;
    idx += handSize;
  }

  const boneyard = deck.slice(idx);

  // Player with highest double starts (or highest tile)
  let starter = players[0];
  let bestDouble = -1;
  for (const p of players) {
    for (const d of hands[p]) {
      if (d.left === d.right && d.left > bestDouble) {
        bestDouble = d.left;
        starter = p;
      }
    }
  }

  return {
    players,
    hands,
    board: [],
    leftEnd: null,
    rightEnd: null,
    boneyard,
    turn: starter,
    scores,
    phase: "playing",
    winner: null,
    passCount: 0,
  };
}

// ── Check if a domino can be played ────────────────────────────────────────────

export function canPlay(state: DammaState, domino: Domino): boolean {
  if (state.board.length === 0) return true; // first move — anything goes
  const { leftEnd, rightEnd } = state;
  return (
    domino.left === leftEnd || domino.right === leftEnd ||
    domino.left === rightEnd || domino.right === rightEnd
  );
}

export function getPlayableSides(state: DammaState, domino: Domino): ("left" | "right")[] {
  if (state.board.length === 0) return ["left"]; // first placement
  const sides: ("left" | "right")[] = [];
  if (domino.left === state.leftEnd || domino.right === state.leftEnd) sides.push("left");
  if (domino.left === state.rightEnd || domino.right === state.rightEnd) sides.push("right");
  return sides;
}

// ── Play a domino ────────────────────────────────────────────────────────────

export function playDomino(
  state: DammaState,
  player: PlayerId,
  dominoId: string,
  side: "left" | "right"
): DammaState | null {
  if (state.turn !== player || state.phase !== "playing") return null;

  const hand = state.hands[player];
  const domino = hand.find((d) => d.id === dominoId);
  if (!domino) return null;
  if (!canPlay(state, domino)) return null;

  const newState: DammaState = {
    ...state,
    hands: { ...state.hands, [player]: hand.filter((d) => d.id !== dominoId) },
    board: [...state.board],
    scores: { ...state.scores },
  };

  // First move
  if (state.board.length === 0) {
    newState.board = [{ ...domino, flipped: false }];
    newState.leftEnd = domino.left;
    newState.rightEnd = domino.right;
  } else if (side === "left") {
    const end = state.leftEnd!;
    // Orient so the matching value connects
    const flipped = domino.right === end;
    const newEnd = flipped ? domino.left : domino.right;
    newState.board = [{ ...domino, flipped }, ...state.board];
    newState.leftEnd = newEnd;
  } else {
    const end = state.rightEnd!;
    const flipped = domino.left === end;
    const newEnd = flipped ? domino.right : domino.left;
    newState.board = [...state.board, { ...domino, flipped }];
    newState.rightEnd = newEnd;
  }

  newState.passCount = 0;

  // Win check — empty hand
  if (newState.hands[player].length === 0) {
    newState.phase = "game_over";
    newState.winner = player;
    newState.scores[player] += computeRoundScore(newState, player);
    return newState;
  }

  // Advance turn
  newState.turn = nextPlayer(newState, player);
  return newState;
}

// ── Draw from boneyard ──────────────────────────────────────────────────────────

export function drawFromBoneyard(state: DammaState, player: PlayerId): DammaState | null {
  if (state.turn !== player || state.phase !== "playing") return null;
  if (state.boneyard.length === 0) return null;

  const boneyard = [...state.boneyard];
  const drawn = boneyard.shift()!;
  return {
    ...state,
    boneyard,
    hands: { ...state.hands, [player]: [...state.hands[player], drawn] },
  };
}

// ── Pass turn (when no playable tile and boneyard empty) ──────────────────────

export function passTurn(state: DammaState, player: PlayerId): DammaState {
  if (state.turn !== player) return state;

  // Can the player actually play? If yes, passing is illegal — ignore
  const canPlayAny = state.hands[player].some((d) => canPlay(state, d));
  if (canPlayAny || state.boneyard.length > 0) return state;

  const newState = { ...state, passCount: state.passCount + 1 };

  // All players passed consecutively = blocked game
  if (newState.passCount >= state.players.length) {
    return resolveBlockedGame(newState);
  }

  newState.turn = nextPlayer(newState, player);
  return newState;
}

// ── Blocked game resolution ────────────────────────────────────────────────────

function resolveBlockedGame(state: DammaState): DammaState {
  // Winner = player with lowest pip count in hand
  let winner: PlayerId = state.players[0];
  let lowestPips = Infinity;

  for (const p of state.players) {
    const pips = state.hands[p].reduce((sum, d) => sum + d.left + d.right, 0);
    if (pips < lowestPips) {
      lowestPips = pips;
      winner = p;
    }
  }

  const newScores = { ...state.scores };
  newScores[winner] += computeRoundScore(state, winner);

  return {
    ...state,
    phase: "game_over",
    winner,
    scores: newScores,
  };
}

// ── Scoring: winner gets sum of opponents' remaining pips ───────────────────────

function computeRoundScore(state: DammaState, winner: PlayerId): number {
  let total = 0;
  for (const p of state.players) {
    if (p === winner) continue;
    total += state.hands[p].reduce((sum, d) => sum + d.left + d.right, 0);
  }
  return total;
}

// ── Turn helpers ────────────────────────────────────────────────────────────────

function nextPlayer(state: DammaState, current: PlayerId): PlayerId {
  const idx = state.players.indexOf(current);
  return state.players[(idx + 1) % state.players.length];
}

// ── Check if current player must draw or pass ─────────────────────────────────

export function getPlayerOptions(state: DammaState, player: PlayerId): {
  playableTiles: Domino[];
  mustDraw: boolean;
  mustPass: boolean;
} {
  const playableTiles = state.hands[player].filter((d) => canPlay(state, d));
  return {
    playableTiles,
    mustDraw: playableTiles.length === 0 && state.boneyard.length > 0,
    mustPass: playableTiles.length === 0 && state.boneyard.length === 0,
  };
}

// ── Serialization ──────────────────────────────────────────────────────────────
export function serializeState(state: DammaState): string { return JSON.stringify(state); }
export function deserializeState(data: string): DammaState { return JSON.parse(data); }
