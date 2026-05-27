// /app/frontend/src/theme/futuristic.ts
// =============================================================================
// Party4R — Futuristic design tokens (now LIVE / mutable)
// =============================================================================
//
// IMPORTANT: This file used to export frozen `as const` objects. Phase 8 makes
// `FUTURISTIC`, `GRADIENTS`, and `SHADOWS` **mutable** so a single global theme
// switch via `applyTheme(themeId)` can update colors across the entire app at
// once. Combined with a re-mount of the Stack via `key={themeId}` in
// `app/_layout.tsx`, theme changes propagate to every component instantly
// regardless of whether they consume them via context or static import.
//
// To use:
//   import { FUTURISTIC, GRADIENTS, SHADOWS } from "@/src/theme/futuristic";
//   // styles use FUTURISTIC.brand, GRADIENTS.appBg, SHADOWS.glowBrand, etc.
//
// Switch theme at runtime:
//   import { applyTheme } from "@/src/theme/futuristic";
//   applyTheme("emerald");  // also call setThemeIdState in ThemeContext

import { THEMES, ThemeId, DEFAULT_THEME_ID, ThemeTokens } from "@/src/theme/themes";

// ---------------------------------------------------------------------------
// Live-mutable design tokens. Components import these and read .brand etc.
// They get re-assigned on theme change.
// ---------------------------------------------------------------------------
const DEFAULT = THEMES[DEFAULT_THEME_ID];

export const FUTURISTIC = {
  // ----------------------- Backgrounds -----------------------------
  bg: DEFAULT.bg,
  bgSoft: DEFAULT.bgSoft,
  surface0: DEFAULT.surface0,
  surface1: DEFAULT.surface1,
  surface2: DEFAULT.surface2,
  surface3: DEFAULT.surface3,
  glassFill: DEFAULT.glassFill,
  glassTint: DEFAULT.glassTint,

  // ----------------------- Borders ---------------------------------
  border: DEFAULT.border,
  borderSoft: DEFAULT.borderSoft,
  borderStrong: DEFAULT.borderStrong,
  metalEdgeTop: DEFAULT.metalEdgeTop,
  metalEdgeBottom: DEFAULT.metalEdgeBottom,

  // ----------------------- Brand / Accents -------------------------
  brand: DEFAULT.brand,
  brandSoft: DEFAULT.brandSoft,
  brandGlow: DEFAULT.brandGlow,
  brandEdge: DEFAULT.brandEdge,
  accent: DEFAULT.accent,
  accentSoft: DEFAULT.accentSoft,
  accentGlow: DEFAULT.accentGlow,
  accentEdge: DEFAULT.accentEdge,
  cyber: DEFAULT.cyber,
  cyberSoft: DEFAULT.cyberSoft,
  cyberGlow: DEFAULT.cyberGlow,

  // ----------------------- Text ------------------------------------
  textPrimary: DEFAULT.textPrimary,
  textSecondary: DEFAULT.textSecondary,
  textMuted: DEFAULT.textMuted,
  textDisabled: DEFAULT.textDisabled,

  // ----------------------- Semantic --------------------------------
  error: DEFAULT.error,
  errorSoft: DEFAULT.errorSoft,
  success: DEFAULT.success,
  warning: DEFAULT.warning,
  info: DEFAULT.info,

  // ----------------------- Spacing & radius ------------------------
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 },
};

// Reusable gradient sets. Re-assigned on applyTheme().
export const GRADIENTS = {
  metalCard: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0.0)"],
  metalEdge: [
    "rgba(255,255,255,0.30)",
    DEFAULT.brandEdge,
    DEFAULT.accentEdge,
    "rgba(255,255,255,0.30)",
  ],
  brandGlow: ["rgba(0,0,0,0)", DEFAULT.brandGlow, "rgba(0,0,0,0)"],
  accentGlow: ["rgba(0,0,0,0)", DEFAULT.accentGlow, "rgba(0,0,0,0)"],
  appBg: [...DEFAULT.appBgStops],
  hero: [DEFAULT.brandSoft, DEFAULT.accentSoft],
};

export const SHADOWS = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sheet: {
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  glowBrand: {
    shadowColor: DEFAULT.brand,
    shadowOpacity: 0.50,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  glowAccent: {
    shadowColor: DEFAULT.accent,
    shadowOpacity: 0.50,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
};

// Typography is theme-independent (stable across themes).
export const TYPO = {
  display: { fontSize: 32, fontWeight: "900" as const, letterSpacing: 1.2 },
  h1: { fontSize: 24, fontWeight: "900" as const, letterSpacing: 0.8 },
  h2: { fontSize: 18, fontWeight: "800" as const, letterSpacing: 0.5 },
  body: { fontSize: 14, fontWeight: "500" as const, letterSpacing: 0.1 },
  caption: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.8 },
  micro: { fontSize: 9, fontWeight: "800" as const, letterSpacing: 2.4 },
};

// ---------------------------------------------------------------------------
// applyTheme(id) — mutate FUTURISTIC / GRADIENTS / SHADOWS in place.
// Combined with the key={themeId} remount of the inner Stack in _layout.tsx,
// this propagates the new colors to every screen instantly.
// ---------------------------------------------------------------------------
export function applyTheme(id: ThemeId): void {
  const t: ThemeTokens = THEMES[id] || THEMES[DEFAULT_THEME_ID];
  // Backgrounds
  FUTURISTIC.bg = t.bg;
  FUTURISTIC.bgSoft = t.bgSoft;
  FUTURISTIC.surface0 = t.surface0;
  FUTURISTIC.surface1 = t.surface1;
  FUTURISTIC.surface2 = t.surface2;
  FUTURISTIC.surface3 = t.surface3;
  FUTURISTIC.glassFill = t.glassFill;
  FUTURISTIC.glassTint = t.glassTint;
  // Borders
  FUTURISTIC.border = t.border;
  FUTURISTIC.borderSoft = t.borderSoft;
  FUTURISTIC.borderStrong = t.borderStrong;
  FUTURISTIC.metalEdgeTop = t.metalEdgeTop;
  FUTURISTIC.metalEdgeBottom = t.metalEdgeBottom;
  // Brand
  FUTURISTIC.brand = t.brand;
  FUTURISTIC.brandSoft = t.brandSoft;
  FUTURISTIC.brandGlow = t.brandGlow;
  FUTURISTIC.brandEdge = t.brandEdge;
  FUTURISTIC.accent = t.accent;
  FUTURISTIC.accentSoft = t.accentSoft;
  FUTURISTIC.accentGlow = t.accentGlow;
  FUTURISTIC.accentEdge = t.accentEdge;
  FUTURISTIC.cyber = t.cyber;
  FUTURISTIC.cyberSoft = t.cyberSoft;
  FUTURISTIC.cyberGlow = t.cyberGlow;
  // Text
  FUTURISTIC.textPrimary = t.textPrimary;
  FUTURISTIC.textSecondary = t.textSecondary;
  FUTURISTIC.textMuted = t.textMuted;
  FUTURISTIC.textDisabled = t.textDisabled;
  // Semantic
  FUTURISTIC.error = t.error;
  FUTURISTIC.errorSoft = t.errorSoft;
  FUTURISTIC.success = t.success;
  FUTURISTIC.warning = t.warning;
  FUTURISTIC.info = t.info;

  // Gradients (rebuild arrays in place; do NOT replace the array reference
  // because some consumers may keep a stale ref).
  GRADIENTS.metalEdge.splice(
    0,
    GRADIENTS.metalEdge.length,
    "rgba(255,255,255,0.30)",
    t.brandEdge,
    t.accentEdge,
    "rgba(255,255,255,0.30)"
  );
  GRADIENTS.brandGlow.splice(0, GRADIENTS.brandGlow.length, "rgba(0,0,0,0)", t.brandGlow, "rgba(0,0,0,0)");
  GRADIENTS.accentGlow.splice(0, GRADIENTS.accentGlow.length, "rgba(0,0,0,0)", t.accentGlow, "rgba(0,0,0,0)");
  GRADIENTS.appBg.splice(0, GRADIENTS.appBg.length, ...t.appBgStops);
  GRADIENTS.hero.splice(0, GRADIENTS.hero.length, t.brandSoft, t.accentSoft);

  // Shadows
  SHADOWS.glowBrand.shadowColor = t.brand;
  SHADOWS.glowAccent.shadowColor = t.accent;
}

// Default-export type for components that want the shape.
export type FuturisticTheme = typeof FUTURISTIC;
