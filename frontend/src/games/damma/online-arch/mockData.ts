// =============================================================================
// damma/online-arch/mockData.ts — sample fixtures for UI development
// =============================================================================
// These objects let lobby/screens/components be exercised in Storybook-style
// without a running backend. Production code MUST NEVER import these directly
// (the mock service does the importing). Replace freely once a real backend
// exists — ALL UI prop shapes will keep working.
// =============================================================================
import type {
  GameState, Match, MatchLobby, MatchLobbySlot, MatchSettings, Player,
} from "./types";

export const MOCK_PLAYERS: Player[] = [
  { id: "u_host",  name: "You",        avatar: "avatar_ninja",  ready: true },
  { id: "u_omar",  name: "Omar",       avatar: "avatar_lion",   ready: true },
  { id: "u_sara",  name: "Sara",       avatar: "avatar_fox",    ready: false },
  { id: "u_ahmed", name: "Ahmed",      avatar: "avatar_tiger",  ready: false },
  { id: "bot_med", name: "Bot Medium", avatar: "avatar_robot",  ready: true, isBot: true, botDifficulty: "medium" },
];

export const MOCK_SETTINGS_4P: MatchSettings = {
  mode: "4p", visibility: "mixed", turnSeconds: 60, targetScore: 150, variant: "classic",
};

export function makeMockLobby(): MatchLobby {
  const slots: MatchLobbySlot[] = [
    { kind: "host",   player: MOCK_PLAYERS[0], ready: true  },
    { kind: "friend", player: MOCK_PLAYERS[1], ready: true  },
    { kind: "bot",    player: MOCK_PLAYERS[4], ready: true  },
    { kind: "public", player: null,            ready: false, openToPublic: true },
  ];
  return {
    matchId: "mock_match_0001",
    settings: MOCK_SETTINGS_4P,
    slots,
    hostId: "u_host",
    allReady: false,
  };
}

export function makeMockMatch(): Match {
  const lobby = makeMockLobby();
  return {
    id: lobby.matchId,
    settings: lobby.settings,
    seats: lobby.slots.map((s) => s.player),
    currentTurn: null,
    phase: "lobby",
    hostId: lobby.hostId,
    createdAt: Date.now(),
    inviteCode: "AB12-CD34",
  };
}

export function makeMockGameState(matchId = "mock_match_0001"): GameState {
  return {
    matchId,
    version: 1,
    turn: "player1",
    board: [],
    leftEnd: null,
    rightEnd: null,
    handCounts: { player1: 7, player2: 7, player3: 7, player4: 7 },
    myHand: [
      // Seven random domino faces; ids are deterministic so React keys stay stable.
      { id: "d_0_0", left: 0, right: 0 },
      { id: "d_1_3", left: 1, right: 3 },
      { id: "d_2_5", left: 2, right: 5 },
      { id: "d_3_4", left: 3, right: 4 },
      { id: "d_4_4", left: 4, right: 4 },
      { id: "d_5_6", left: 5, right: 6 },
      { id: "d_6_6", left: 6, right: 6 },
    ],
    boneyardCount: 14,
    scores: { player1: 0, player2: 0, player3: 0, player4: 0 },
    phase: "playing",
    myOptions: { mustDraw: false, mustPass: false, playableTileIds: [] },
  };
}
