// =============================================================================
// src/constants/ranks.ts — Party4R Ranking System  ★ COMPLETE ★
// =============================================================================
// Bronze:   9 levels  (0    –  899)   100 pts/level  ✅
// Silver:   6 levels  (900  – 1499)   100 pts/level  ✅
// Gold:     6 levels  (1500 – 2099)   100 pts/level  ✅
// Platinum: 6 levels  (2100 – 2699)   100 pts/level  ✅
// Master:   6 levels  (2700 – 3299)   100 pts/level  ✅
// Legend:   6 levels  (3300 – 3899)   100 pts/level  ✅
//
// Total: 39 ranks across 6 tiers
// =============================================================================

export type RankTier = "bronze" | "silver" | "gold" | "platinum" | "master" | "legend";

export interface Rank {
  id: string;
  name: string;
  nameAr: string;
  tier: RankTier;
  level: number;
  minRating: number;
  maxRating: number | null;
  badge: ReturnType<typeof require>;
  color: string;
  glowColor: string;
}

// ---------------------------------------------------------------------------
// Bronze — 9 levels (0–899)
// ---------------------------------------------------------------------------
export const BRONZE_RANKS: Rank[] = [
  { id:"bronze_1", name:"Bronze I",    nameAr:"برونز I",    tier:"bronze", level:1, minRating:0,   maxRating:100,
    badge:require("../../assets/images/ranks/bronze/bronze_1.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_2", name:"Bronze II",   nameAr:"برونز II",   tier:"bronze", level:2, minRating:100,  maxRating:200,
    badge:require("../../assets/images/ranks/bronze/bronze_2.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_3", name:"Bronze III",  nameAr:"برونز III",  tier:"bronze", level:3, minRating:200,  maxRating:300,
    badge:require("../../assets/images/ranks/bronze/bronze_3.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_4", name:"Bronze IV",   nameAr:"برونز IV",   tier:"bronze", level:4, minRating:300,  maxRating:400,
    badge:require("../../assets/images/ranks/bronze/bronze_4.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_5", name:"Bronze V",    nameAr:"برونز V",    tier:"bronze", level:5, minRating:400,  maxRating:500,
    badge:require("../../assets/images/ranks/bronze/bronze_5.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_6", name:"Bronze VI",   nameAr:"برونز VI",   tier:"bronze", level:6, minRating:500,  maxRating:600,
    badge:require("../../assets/images/ranks/bronze/bronze_6.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_7", name:"Bronze VII",  nameAr:"برونز VII",  tier:"bronze", level:7, minRating:600,  maxRating:700,
    badge:require("../../assets/images/ranks/bronze/bronze_7.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_8", name:"Bronze VIII", nameAr:"برونز VIII", tier:"bronze", level:8, minRating:700,  maxRating:800,
    badge:require("../../assets/images/ranks/bronze/bronze_8.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
  { id:"bronze_9", name:"Bronze IX",   nameAr:"برونز IX",   tier:"bronze", level:9, minRating:800,  maxRating:900,
    badge:require("../../assets/images/ranks/bronze/bronze_9.png"), color:"#CD7F32", glowColor:"rgba(205,127,50,0.35)" },
];

// ---------------------------------------------------------------------------
// Silver — 6 levels (900–1499)
// ---------------------------------------------------------------------------
export const SILVER_RANKS: Rank[] = [
  { id:"silver_1", name:"Silver I",   nameAr:"فضي I",   tier:"silver", level:1, minRating:900,  maxRating:1000,
    badge:require("../../assets/images/ranks/silver/silver_1.png"), color:"#C0C0C0", glowColor:"rgba(192,192,192,0.40)" },
  { id:"silver_2", name:"Silver II",  nameAr:"فضي II",  tier:"silver", level:2, minRating:1000, maxRating:1100,
    badge:require("../../assets/images/ranks/silver/silver_2.png"), color:"#C0C0C0", glowColor:"rgba(192,192,192,0.40)" },
  { id:"silver_3", name:"Silver III", nameAr:"فضي III", tier:"silver", level:3, minRating:1100, maxRating:1200,
    badge:require("../../assets/images/ranks/silver/silver_3.png"), color:"#C0C0C0", glowColor:"rgba(192,192,192,0.40)" },
  { id:"silver_4", name:"Silver IV",  nameAr:"فضي IV",  tier:"silver", level:4, minRating:1200, maxRating:1300,
    badge:require("../../assets/images/ranks/silver/silver_4.png"), color:"#C0C0C0", glowColor:"rgba(192,192,192,0.40)" },
  { id:"silver_5", name:"Silver V",   nameAr:"فضي V",   tier:"silver", level:5, minRating:1300, maxRating:1400,
    badge:require("../../assets/images/ranks/silver/silver_5.png"), color:"#C0C0C0", glowColor:"rgba(192,192,192,0.40)" },
  { id:"silver_6", name:"Silver VI",  nameAr:"فضي VI",  tier:"silver", level:6, minRating:1400, maxRating:1500,
    badge:require("../../assets/images/ranks/silver/silver_6.png"), color:"#C0C0C0", glowColor:"rgba(192,192,192,0.40)" },
];

// ---------------------------------------------------------------------------
// Gold — 6 levels (1500–2099)
// ---------------------------------------------------------------------------
export const GOLD_RANKS: Rank[] = [
  { id:"gold_1", name:"Gold I",   nameAr:"ذهبي I",   tier:"gold", level:1, minRating:1500, maxRating:1600,
    badge:require("../../assets/images/ranks/gold/gold_1.png"), color:"#FFD700", glowColor:"rgba(255,215,0,0.40)" },
  { id:"gold_2", name:"Gold II",  nameAr:"ذهبي II",  tier:"gold", level:2, minRating:1600, maxRating:1700,
    badge:require("../../assets/images/ranks/gold/gold_2.png"), color:"#FFD700", glowColor:"rgba(255,215,0,0.40)" },
  { id:"gold_3", name:"Gold III", nameAr:"ذهبي III", tier:"gold", level:3, minRating:1700, maxRating:1800,
    badge:require("../../assets/images/ranks/gold/gold_3.png"), color:"#FFD700", glowColor:"rgba(255,215,0,0.40)" },
  { id:"gold_4", name:"Gold IV",  nameAr:"ذهبي IV",  tier:"gold", level:4, minRating:1800, maxRating:1900,
    badge:require("../../assets/images/ranks/gold/gold_4.png"), color:"#FFD700", glowColor:"rgba(255,215,0,0.40)" },
  { id:"gold_5", name:"Gold V",   nameAr:"ذهبي V",   tier:"gold", level:5, minRating:1900, maxRating:2000,
    badge:require("../../assets/images/ranks/gold/gold_5.png"), color:"#FFD700", glowColor:"rgba(255,215,0,0.40)" },
  { id:"gold_6", name:"Gold VI",  nameAr:"ذهبي VI",  tier:"gold", level:6, minRating:2000, maxRating:2100,
    badge:require("../../assets/images/ranks/gold/gold_6.png"), color:"#FFD700", glowColor:"rgba(255,215,0,0.40)" },
];

// ---------------------------------------------------------------------------
// Platinum — 6 levels (2100–2699)
// ---------------------------------------------------------------------------
export const PLATINUM_RANKS: Rank[] = [
  { id:"platinum_1", name:"Platinum I",   nameAr:"بلاتيني I",   tier:"platinum", level:1, minRating:2100, maxRating:2200,
    badge:require("../../assets/images/ranks/platinum/platinum_1.png"), color:"#E8F0F5", glowColor:"rgba(180,200,220,0.45)" },
  { id:"platinum_2", name:"Platinum II",  nameAr:"بلاتيني II",  tier:"platinum", level:2, minRating:2200, maxRating:2300,
    badge:require("../../assets/images/ranks/platinum/platinum_2.png"), color:"#E8F0F5", glowColor:"rgba(180,200,220,0.45)" },
  { id:"platinum_3", name:"Platinum III", nameAr:"بلاتيني III", tier:"platinum", level:3, minRating:2300, maxRating:2400,
    badge:require("../../assets/images/ranks/platinum/platinum_3.png"), color:"#E8F0F5", glowColor:"rgba(180,200,220,0.45)" },
  { id:"platinum_4", name:"Platinum IV",  nameAr:"بلاتيني IV",  tier:"platinum", level:4, minRating:2400, maxRating:2500,
    badge:require("../../assets/images/ranks/platinum/platinum_4.png"), color:"#E8F0F5", glowColor:"rgba(180,200,220,0.45)" },
  { id:"platinum_5", name:"Platinum V",   nameAr:"بلاتيني V",   tier:"platinum", level:5, minRating:2500, maxRating:2600,
    badge:require("../../assets/images/ranks/platinum/platinum_5.png"), color:"#E8F0F5", glowColor:"rgba(180,200,220,0.45)" },
  { id:"platinum_6", name:"Platinum VI",  nameAr:"بلاتيني VI",  tier:"platinum", level:6, minRating:2600, maxRating:2700,
    badge:require("../../assets/images/ranks/platinum/platinum_6.png"), color:"#E8F0F5", glowColor:"rgba(180,200,220,0.45)" },
];

// ---------------------------------------------------------------------------
// Master — 6 levels (2700–3299)
// ---------------------------------------------------------------------------
export const MASTER_RANKS: Rank[] = [
  { id:"master_1", name:"Master I",   nameAr:"ماستر I",   tier:"master", level:1, minRating:2700, maxRating:2800,
    badge:require("../../assets/images/ranks/master/master_1.png"), color:"#C77DFF", glowColor:"rgba(199,125,255,0.45)" },
  { id:"master_2", name:"Master II",  nameAr:"ماستر II",  tier:"master", level:2, minRating:2800, maxRating:2900,
    badge:require("../../assets/images/ranks/master/master_2.png"), color:"#C77DFF", glowColor:"rgba(199,125,255,0.45)" },
  { id:"master_3", name:"Master III", nameAr:"ماستر III", tier:"master", level:3, minRating:2900, maxRating:3000,
    badge:require("../../assets/images/ranks/master/master_3.png"), color:"#C77DFF", glowColor:"rgba(199,125,255,0.45)" },
  { id:"master_4", name:"Master IV",  nameAr:"ماستر IV",  tier:"master", level:4, minRating:3000, maxRating:3100,
    badge:require("../../assets/images/ranks/master/master_4.png"), color:"#C77DFF", glowColor:"rgba(199,125,255,0.45)" },
  { id:"master_5", name:"Master V",   nameAr:"ماستر V",   tier:"master", level:5, minRating:3100, maxRating:3200,
    badge:require("../../assets/images/ranks/master/master_5.png"), color:"#C77DFF", glowColor:"rgba(199,125,255,0.45)" },
  { id:"master_6", name:"Master VI",  nameAr:"ماستر VI",  tier:"master", level:6, minRating:3200, maxRating:3300,
    badge:require("../../assets/images/ranks/master/master_6.png"), color:"#C77DFF", glowColor:"rgba(199,125,255,0.45)" },
];

// ---------------------------------------------------------------------------
// Legend — 6 levels (3300–3899)  ★ TOP TIER ★
// ---------------------------------------------------------------------------
export const LEGEND_RANKS: Rank[] = [
  { id:"legend_1", name:"Legend I",   nameAr:"أسطوري I",   tier:"legend", level:1, minRating:3300, maxRating:3400,
    badge:require("../../assets/images/ranks/legend/legend_1.png"), color:"#FF4500", glowColor:"rgba(255,69,0,0.50)" },
  { id:"legend_2", name:"Legend II",  nameAr:"أسطوري II",  tier:"legend", level:2, minRating:3400, maxRating:3500,
    badge:require("../../assets/images/ranks/legend/legend_2.png"), color:"#FF4500", glowColor:"rgba(255,69,0,0.50)" },
  { id:"legend_3", name:"Legend III", nameAr:"أسطوري III", tier:"legend", level:3, minRating:3500, maxRating:3600,
    badge:require("../../assets/images/ranks/legend/legend_3.png"), color:"#FF4500", glowColor:"rgba(255,69,0,0.50)" },
  { id:"legend_4", name:"Legend IV",  nameAr:"أسطوري IV",  tier:"legend", level:4, minRating:3600, maxRating:3700,
    badge:require("../../assets/images/ranks/legend/legend_4.png"), color:"#FF4500", glowColor:"rgba(255,69,0,0.50)" },
  { id:"legend_5", name:"Legend V",   nameAr:"أسطوري V",   tier:"legend", level:5, minRating:3700, maxRating:3800,
    badge:require("../../assets/images/ranks/legend/legend_5.png"), color:"#FF4500", glowColor:"rgba(255,69,0,0.50)" },
  { id:"legend_6", name:"Legend VI",  nameAr:"أسطوري VI",  tier:"legend", level:6, minRating:3800, maxRating:null,
    badge:require("../../assets/images/ranks/legend/legend_6.png"), color:"#FF4500", glowColor:"rgba(255,69,0,0.50)" },
];

// ---------------------------------------------------------------------------
// Full ordered list — 39 ranks total
// ---------------------------------------------------------------------------
export const ALL_RANKS: Rank[] = [
  ...BRONZE_RANKS,    //  9 ranks   (0  –  899)
  ...SILVER_RANKS,    //  6 ranks   (900 – 1499)
  ...GOLD_RANKS,      //  6 ranks   (1500 – 2099)
  ...PLATINUM_RANKS,  //  6 ranks   (2100 – 2699)
  ...MASTER_RANKS,    //  6 ranks   (2700 – 3299)
  ...LEGEND_RANKS,    //  6 ranks   (3300 – ∞)
];

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function getRankForRating(rating: number): Rank {
  for (let i = ALL_RANKS.length - 1; i >= 0; i--) {
    if (rating >= ALL_RANKS[i].minRating) return ALL_RANKS[i];
  }
  return BRONZE_RANKS[0];
}

export function getRankProgress(rating: number): number {
  const rank = getRankForRating(rating);
  if (rank.maxRating === null) return 100; // Legend VI = max
  const range = rank.maxRating - rank.minRating;
  if (range <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((rating - rank.minRating) / range) * 100)));
}

export function getNextRank(rating: number): Rank | null {
  const cur = getRankForRating(rating);
  const idx = ALL_RANKS.findIndex(r => r.id === cur.id);
  return (idx >= 0 && idx < ALL_RANKS.length - 1) ? ALL_RANKS[idx + 1] : null;
}

export function pointsToNextRank(rating: number): number | null {
  const next = getNextRank(rating);
  return next ? Math.max(0, next.minRating - rating) : null;
}

export function getRanksByTier(tier: RankTier): Rank[] {
  return ALL_RANKS.filter(r => r.tier === tier);
}

export function isMaxRank(rating: number): boolean {
  return getNextRank(rating) === null;
}

// ---------------------------------------------------------------------------
// Tier display metadata
// ---------------------------------------------------------------------------
export const TIER_INFO: Record<RankTier, { label: string; labelAr: string; color: string }> = {
  bronze:   { label:"Bronze",   labelAr:"برونز",   color:"#CD7F32" },
  silver:   { label:"Silver",   labelAr:"فضي",     color:"#C0C0C0" },
  gold:     { label:"Gold",     labelAr:"ذهبي",    color:"#FFD700" },
  platinum: { label:"Platinum", labelAr:"بلاتيني", color:"#E8F0F5" },
  master:   { label:"Master",   labelAr:"ماستر",   color:"#C77DFF" },
  legend:   { label:"Legend",   labelAr:"أسطوري",  color:"#FF4500" },
};
