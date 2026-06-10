// =============================================================================
// src/games/stats.ts — Party4R Unified Game Stats (local-first, sync-ready)
// =============================================================================
// إحصائيات موحّدة لكل لاعب ولكل لعبة، محفوظة محلياً (تعمل أوفلاين) وجاهزة
// للمزامنة مع السيرفر لاحقاً. لكل لعبة: عدد المباريات، الانتصارات، الهزائم،
// التعادلات، نسبة الفوز، السلسلة الحالية وأفضل سلسلة، نقاط الرتبة، الرتبة
// الحالية وأعلى رتبة، وتاريخ آخر مباراة.
//
// التخزين عبر storage الآمن (لا يرمي استثناءات). المفاتيح مخصّصة لكل مستخدم
// حتى لا تختلط بيانات حسابات مختلفة على نفس الجهاز.
// =============================================================================

import { storage } from "@/src/utils/storage";
import { GameType } from "@/src/api/games";
import {
  RankTierId, rankForPoints, higherRank, pointsDelta, RANK_POINTS,
} from "./ranks";

export type Outcome = "win" | "loss" | "draw";

export interface GameStats {
  game: GameType;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;   // consecutive wins (resets on non-win)
  bestStreak: number;
  rankPoints: number;      // cumulative rank points
  peakRankId: RankTierId;
  lastPlayed: number | null; // epoch ms
}

export interface RecordResult {
  stats: GameStats;
  delta: number;            // rank-points change this game
  rankedUp: boolean;
  prevRankId: RankTierId;
  newRankId: RankTierId;
}

const KEY = (userId: string, game: GameType) => `party_game_stats:${userId || "guest"}:${game}`;

export function emptyStats(game: GameType): GameStats {
  return {
    game,
    games: 0, wins: 0, losses: 0, draws: 0,
    currentStreak: 0, bestStreak: 0,
    rankPoints: 0, peakRankId: "bronze",
    lastPlayed: null,
  };
}

export function winRate(s: GameStats): number {
  return s.games > 0 ? s.wins / s.games : 0;
}

/** Load one game's stats for a user (never throws; returns defaults). */
export async function loadStats(userId: string, game: GameType): Promise<GameStats> {
  const raw = (await storage.getItem(KEY(userId, game), "")) as string;
  if (!raw) return emptyStats(game);
  try {
    const parsed = JSON.parse(raw) as Partial<GameStats>;
    return { ...emptyStats(game), ...parsed, game };
  } catch {
    return emptyStats(game);
  }
}

/** Load all games' stats for a user. */
export async function loadAllStats(userId: string, games: GameType[]): Promise<GameStats[]> {
  return Promise.all(games.map((g) => loadStats(userId, g)));
}

/**
 * Record a finished match and persist. Returns the new stats plus the
 * rank-point delta and whether the player ranked up (for the end screen).
 */
export async function recordResult(
  userId: string,
  game: GameType,
  outcome: Outcome,
): Promise<RecordResult> {
  const prev = await loadStats(userId, game);
  const prevRank = rankForPoints(prev.rankPoints);

  const delta = pointsDelta(outcome, prev.currentStreak);
  const rankPoints = Math.max(RANK_POINTS.floor, prev.rankPoints + delta);
  const newRank = rankForPoints(rankPoints);

  const currentStreak = outcome === "win" ? prev.currentStreak + 1 : 0;
  const next: GameStats = {
    game,
    games: prev.games + 1,
    wins: prev.wins + (outcome === "win" ? 1 : 0),
    losses: prev.losses + (outcome === "loss" ? 1 : 0),
    draws: prev.draws + (outcome === "draw" ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(prev.bestStreak, currentStreak),
    rankPoints,
    peakRankId: higherRank(prev.peakRankId, newRank.id),
    lastPlayed: Date.now(),
  };

  await storage.setItem(KEY(userId, game), JSON.stringify(next));

  return {
    stats: next,
    delta,
    rankedUp: newRank.id !== prevRank.id && rankPoints > prev.rankPoints,
    prevRankId: prevRank.id,
    newRankId: newRank.id,
  };
}

/** Reset a single game's stats (used by future settings / debug). */
export async function resetStats(userId: string, game: GameType): Promise<void> {
  await storage.setItem(KEY(userId, game), JSON.stringify(emptyStats(game)));
}
