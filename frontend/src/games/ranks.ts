// =============================================================================
// src/games/ranks.ts — Party4R Unified Rank System
// =============================================================================
// نظام رتب موحّد لكل ألعاب Party4R. كل القيم قابلة للتعديل بسهولة من مكان واحد
// (RANKS) بدون لمس بقية النظام — تستطيع تغيير النقاط المطلوبة لكل رتبة أو
// مقدار الربح/الخسارة لاحقاً دون أي تعديل في الألعاب أو المتجر أو الواجهات.
//
// الرتب: برونزي → فضي → ذهبي → بلاتيني → ماستر → أسطوري.
// =============================================================================

export type RankTierId =
  | "bronze" | "silver" | "gold" | "platinum" | "master" | "legend";

export interface RankTier {
  id: RankTierId;
  /** Localized names (used by the UI; fallback to `name`). */
  name: string;       // English
  nameAr: string;     // Arabic
  /** Minimum cumulative rank-points required to reach this tier. */
  minPoints: number;
  /** Theme-agnostic accent color for the badge. */
  color: string;
  /** Ionicons glyph name for the badge. */
  icon: string;
}

// ── Editable tier table — change thresholds/colors here only. ────────────────
export const RANKS: RankTier[] = [
  { id: "bronze",   name: "Bronze",   nameAr: "برونزي",  minPoints: 0,    color: "#CD7F32", icon: "shield-outline" },
  { id: "silver",   name: "Silver",   nameAr: "فضي",     minPoints: 300,  color: "#C0C7D0", icon: "shield-half-outline" },
  { id: "gold",     name: "Gold",     nameAr: "ذهبي",    minPoints: 700,  color: "#FFCB45", icon: "shield" },
  { id: "platinum", name: "Platinum", nameAr: "بلاتيني", minPoints: 1200, color: "#3FE0D0", icon: "ribbon-outline" },
  { id: "master",   name: "Master",   nameAr: "ماستر",   minPoints: 1900, color: "#A06BFF", icon: "ribbon" },
  { id: "legend",   name: "Legend",   nameAr: "أسطوري",  minPoints: 2800, color: "#FF5C8A", icon: "flame" },
];

// ── Points awarded per outcome (editable). ───────────────────────────────────
export const RANK_POINTS = {
  win: 25,
  loss: -12,   // gentle loss
  draw: 5,
  /** Bonus per win in a streak (capped). */
  streakBonusPerWin: 3,
  streakBonusCap: 15,
  /** Floor — rank points never go below this. */
  floor: 0,
};

/** Resolve the tier for a given cumulative points value. */
export function rankForPoints(points: number): RankTier {
  let tier = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.minPoints) tier = r;
    else break;
  }
  return tier;
}

/** Index of a tier in the ladder (0-based). */
export function rankIndex(id: RankTierId): number {
  return RANKS.findIndex((r) => r.id === id);
}

/** Higher of two tiers (for "peak rank"). */
export function higherRank(a: RankTierId, b: RankTierId): RankTierId {
  return rankIndex(a) >= rankIndex(b) ? a : b;
}

export interface RankProgress {
  tier: RankTier;
  nextTier: RankTier | null;
  /** Points into the current tier. */
  pointsIntoTier: number;
  /** Points needed to span the current tier (current→next). */
  tierSpan: number;
  /** 0..1 progress toward next tier (1 if at max tier). */
  progress: number;
}

/** Full progress breakdown used by result/profile screens. */
export function rankProgress(points: number): RankProgress {
  const tier = rankForPoints(points);
  const idx = rankIndex(tier.id);
  const nextTier = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  const pointsIntoTier = Math.max(0, points - tier.minPoints);
  const tierSpan = nextTier ? nextTier.minPoints - tier.minPoints : 0;
  const progress = nextTier ? Math.min(1, pointsIntoTier / tierSpan) : 1;
  return { tier, nextTier, pointsIntoTier, tierSpan, progress };
}

/**
 * Compute the rank-point delta for an outcome (before clamping to floor).
 * `currentStreak` is the player's win streak BEFORE this game.
 */
export function pointsDelta(
  outcome: "win" | "loss" | "draw",
  currentStreak = 0,
): number {
  if (outcome === "loss") return RANK_POINTS.loss;
  if (outcome === "draw") return RANK_POINTS.draw;
  const bonus = Math.min(RANK_POINTS.streakBonusCap, currentStreak * RANK_POINTS.streakBonusPerWin);
  return RANK_POINTS.win + bonus;
}
