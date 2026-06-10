// =============================================================================
// src/games/shared/gameTheme.ts — Party4R Game Theming Bridge
// =============================================================================
// يربط الألعاب (الكيرم، الضمنة، وأي لعبة لوحية مستقبلية) بنظام السمات في
// Party4R. بدلاً من ألوان ثابتة داخل كل لعبة، نشتق لوحة ألوان متناسقة من
// السمة النشطة (FUTURISTIC) بحيث:
//   • تتغير ألوان الإطار والخطوط والتوهج والخلفية تلقائياً مع كل سمة.
//   • يبقى سطح اللعب قابلاً للقراءة (تباين ثابت للقطع) عبر كل السمات.
//   • تُضاف خلفيات/سمات جديدة بسهولة عبر سجل GAME_BG_OVERRIDES بدون لمس الألعاب.
//   • لا توجد أي تكلفة أداء إضافية: مجرد حسابات ألوان رخيصة + تدرّج واحد.
//
// تُقرأ FUTURISTIC لحظة العرض، والشاشات تُعاد تهيئتها عند تبديل السمة
// (key={themeId} في app/_layout.tsx)، لذا تنتشر الألوان فوراً.
// =============================================================================

import { FUTURISTIC } from "@/src/theme/futuristic";

// ── Color utilities (hex-safe; fall back gracefully on non-hex inputs) ───────
function clamp(n: number, lo = 0, hi = 255) { return Math.max(lo, Math.min(hi, n)); }

function toRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string") return null;
  let m = hex.trim().replace("#", "");
  if (m.length === 3) m = m.split("").map((c) => c + c).join("");
  if (m.length !== 6 || /[^0-9a-fA-F]/.test(m)) return null;
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    clamp(Math.round(r)).toString(16).padStart(2, "0") +
    clamp(Math.round(g)).toString(16).padStart(2, "0") +
    clamp(Math.round(b)).toString(16).padStart(2, "0")
  );
}

/** Move a color toward white. amount 0..1. */
export function lighten(hex: string, amount: number): string {
  const c = toRgb(hex);
  if (!c) return hex;
  return toHex(c.r + (255 - c.r) * amount, c.g + (255 - c.g) * amount, c.b + (255 - c.b) * amount);
}

/** Move a color toward black. amount 0..1. */
export function darken(hex: string, amount: number): string {
  const c = toRgb(hex);
  if (!c) return hex;
  return toHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount));
}

/** Linear blend a → b. t 0..1 (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const ca = toRgb(a), cb = toRgb(b);
  if (!ca || !cb) return a;
  return toHex(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t);
}

/** hex (or rgb) → rgba string with given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const c = toRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

// ── Background registry (extensible) ─────────────────────────────────────────
// To give a specific theme a bespoke game backdrop, add an entry here keyed by
// the theme id. Anything not listed gets a high-quality gradient derived from
// the theme automatically. (Returns 3 gradient stops.)
type BgStops = [string, string, string];
export const GAME_BG_OVERRIDES: Record<string, BgStops> = {
  // example (future): "royal": ["#0a0710", "#1a1024", "#241236"],
};

/**
 * Themed full-screen background gradient for any game screen.
 * Subtle, performant (single LinearGradient), and unique per theme.
 */
export function gameBackground(themeId?: string): BgStops {
  if (themeId && GAME_BG_OVERRIDES[themeId]) return GAME_BG_OVERRIDES[themeId];
  const F = FUTURISTIC;
  const base = F.bg || "#0A0A0F";
  return [
    base,
    mix(base, F.brand || base, 0.10),
    mix(base, F.accent || F.brand || base, 0.14),
  ];
}

// ── Carrom palette ───────────────────────────────────────────────────────────
// Canonical light play surface (so ivory + black coins always read) with a
// faint theme tint, while the FRAME, INLAYS, LINES, GLOW and STRIKER follow the
// active theme — removing all hard-coded chrome colors.
export interface CarromPalette {
  felt: string;          // playing surface center
  feltEdge: string;      // playing surface near frame (vignette)
  feltTint: string;      // faint brand tint overlay color
  frame: string;         // outer wooden rail
  frameLight: string;    // rail highlight (bevel top)
  frameDark: string;     // rail shadow (bevel bottom)
  line: string;          // inactive throw lines / decor
  lineActive: string;    // active player's throw line
  decor: string;         // center circle + rosette rings
  glow: string;          // accent glow color
  strikerHi: string;     // striker gradient top
  strikerMid: string;    // striker gradient mid
  strikerLo: string;     // striker gradient bottom
  strikerJewel: string;  // striker center jewel
}

export function carromPalette(): CarromPalette {
  const F = FUTURISTIC;
  const brand = F.brand || "#5BC0EB";
  const accent = F.accent || brand;
  // Warm neutral felt, lightly tinted by the theme brand.
  const feltBase = "#D9BD90";
  return {
    felt: mix(feltBase, brand, 0.10),
    feltEdge: darken(mix(feltBase, brand, 0.16), 0.18),
    feltTint: withAlpha(brand, 0.06),
    frame: darken(brand, 0.62),
    frameLight: darken(brand, 0.42),
    frameDark: darken(brand, 0.78),
    line: withAlpha("#FFFFFF", 0.16),
    lineActive: brand,
    decor: withAlpha(darken(brand, 0.3), 0.5),
    glow: F.brandGlow || withAlpha(brand, 0.45),
    strikerHi: lighten(brand, 0.38),
    strikerMid: brand,
    strikerLo: darken(brand, 0.34),
    strikerJewel: darken(accent, 0.3),
  };
}

// ── Damma (Dominoes) palette ─────────────────────────────────────────────────
// Rich casino-felt table, themed from the active brand. Ivory tiles read well
// on the dark themed felt across every theme.
export interface DammaPalette {
  feltCenter: string;
  feltEdge: string;
  rail: string;
  railLight: string;
  railDark: string;
  line: string;
  glow: string;
  tileFace: string;      // domino body
  tileFaceEdge: string;  // domino body shade
  tileBorder: string;
  pip: string;           // pip dot color
  divider: string;       // center divider on a tile
}

export function dammaPalette(): DammaPalette {
  const F = FUTURISTIC;
  const brand = F.brand || "#2BD475";
  return {
    feltCenter: darken(mix(F.surface1 || "#15151c", brand, 0.28), 0.1),
    feltEdge: darken(mix(F.bg || "#0a0a0f", brand, 0.18), 0.05),
    rail: darken(brand, 0.55),
    railLight: darken(brand, 0.32),
    railDark: darken(brand, 0.72),
    line: withAlpha(brand, 0.35),
    glow: F.brandGlow || withAlpha(brand, 0.4),
    tileFace: "#F7F1E1",
    tileFaceEdge: "#E4D9BE",
    tileBorder: "#B7A687",
    pip: "#2A2A2E",
    divider: "#9A8B6E",
  };
}
