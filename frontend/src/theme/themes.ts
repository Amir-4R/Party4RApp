// /app/frontend/src/theme/themes.ts
// =============================================================================
// Party4R — Global Theme System (Phase 8)
// =============================================================================
// 10 visually-distinct themes. Each is a complete ThemeTokens object so it can
// be swapped at runtime by mutating the shared FUTURISTIC/GRADIENTS/SHADOWS
// objects in /app/frontend/src/theme/futuristic.ts. See applyTheme().
//
// Each theme defines a UNIQUE brand-color personality:
//   neon          → Neon Green     (default)
//   cyber-purple  → Cyber Purple
//   midnight      → Midnight Blue
//   amoled        → AMOLED Black   (minimalist white)
//   silver        → Metallic Silver
//   emerald       → Emerald Glass
//   crimson       → Crimson Neon
//   royal         → Royal Violet
//   arctic        → Arctic Ice
//   gold          → Gold Luxe

// ----- Helper: hex → rgba (with alpha 0..1) --------------------------------
function rgba(hex: string, a: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ----- Theme shape ---------------------------------------------------------
export interface ThemeTokens {
  // identity
  id: string;
  name: string;
  description: string;
  preview: { bg: string; brand: string; accent: string };

  // backgrounds & surfaces
  bg: string;
  bgSoft: string;
  surface0: string;
  surface1: string;
  surface2: string;
  surface3: string;
  glassFill: string;
  glassTint: string;

  // borders
  border: string;
  borderSoft: string;
  borderStrong: string;
  metalEdgeTop: string;
  metalEdgeBottom: string;

  // brand
  brand: string;
  brandSoft: string;
  brandGlow: string;
  brandEdge: string;
  brandDeep: string; // darker shade for gradients

  // accent (secondary)
  accent: string;
  accentSoft: string;
  accentGlow: string;
  accentEdge: string;
  accentDeep: string;

  // tertiary cyber
  cyber: string;
  cyberSoft: string;
  cyberGlow: string;

  // text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  // semantic
  error: string;
  errorSoft: string;
  success: string;
  warning: string;
  info: string;

  // gradient stops for the app background (3 hex stops)
  appBgStops: [string, string, string];
}

// ----- Factory to build a fully-tokenized theme from 3 anchor colors ------
function mk(opts: {
  id: string;
  name: string;
  description: string;
  bg: string;             // darkest layer
  brand: string;          // primary brand color (hex)
  accent: string;         // secondary brand color (hex)
  cyber?: string;         // optional tertiary (defaults to a cool blue)
  surfaceTint?: string;   // tint hue for surfaces (defaults to bg)
  brandDeep?: string;     // darker shade for gradients
  accentDeep?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
  textDisabled?: string;
}): ThemeTokens {
  const surfaceBase = opts.surfaceTint || opts.bg;
  const cyber = opts.cyber || "#33E6FF";
  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    preview: { bg: opts.bg, brand: opts.brand, accent: opts.accent },

    bg: opts.bg,
    bgSoft: shadeLayer(surfaceBase, 1),
    surface0: shadeLayer(surfaceBase, 2),
    surface1: shadeLayer(surfaceBase, 3),
    surface2: shadeLayer(surfaceBase, 4),
    surface3: shadeLayer(surfaceBase, 5),
    glassFill: rgba(shadeLayer(surfaceBase, 3), 0.55),
    glassTint: rgba(shadeLayer(surfaceBase, 2), 0.65),

    border: shadeLayer(surfaceBase, 4),
    borderSoft: "rgba(255,255,255,0.06)",
    borderStrong: shadeLayer(surfaceBase, 5),
    metalEdgeTop: "rgba(255,255,255,0.18)",
    metalEdgeBottom: rgba(opts.brand, 0.22),

    brand: opts.brand,
    brandSoft: rgba(opts.brand, 0.16),
    brandGlow: rgba(opts.brand, 0.45),
    brandEdge: rgba(opts.brand, 0.65),
    brandDeep: opts.brandDeep || darken(opts.brand, 0.35),

    accent: opts.accent,
    accentSoft: rgba(opts.accent, 0.18),
    accentGlow: rgba(opts.accent, 0.42),
    accentEdge: rgba(opts.accent, 0.62),
    accentDeep: opts.accentDeep || darken(opts.accent, 0.35),

    cyber,
    cyberSoft: rgba(cyber, 0.16),
    cyberGlow: rgba(cyber, 0.40),

    textPrimary: opts.textPrimary || "#FFFFFF",
    textSecondary: opts.textSecondary || "#B7BACD",
    textMuted: opts.textMuted || "#6C7090",
    textDisabled: opts.textDisabled || "#3F435A",

    error: "#FF3D71",
    errorSoft: "rgba(255, 61, 113, 0.16)",
    success: opts.brand,
    warning: "#FFB347",
    info: cyber,

    appBgStops: [opts.bg, shadeLayer(surfaceBase, 1), shadeLayer(surfaceBase, 2)],
  };
}

// ----- helpers: blend bg upwards into successive elevation layers ----------
function shadeLayer(bg: string, step: number): string {
  // Lighten the bg slightly per layer. Step is 1..5. Approximate by mixing
  // toward gray.
  const m = bg.replace("#", "");
  if (m.length !== 6) return bg;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const t = step * 6; // each step adds ~6/255 brightness
  const nr = Math.min(255, r + t);
  const ng = Math.min(255, g + t);
  const nb = Math.min(255, b + t);
  return (
    "#" +
    nr.toString(16).padStart(2, "0") +
    ng.toString(16).padStart(2, "0") +
    nb.toString(16).padStart(2, "0")
  );
}

function darken(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = Math.max(0, Math.floor(parseInt(m.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(m.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(m.slice(4, 6), 16) * (1 - amount)));
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

// =============================================================================
// THE 10 THEMES
// =============================================================================
export const THEMES: Record<string, ThemeTokens> = {
  // 1. Neon Green — default, AMOLED-friendly cyber green
  neon: mk({
    id: "neon",
    name: "Neon Green",
    description: "Cyber green · AMOLED dark · Default",
    bg: "#000000",
    surfaceTint: "#0A0B14",
    brand: "#22FF88",
    accent: "#A855F7",
  }),

  // 2. Cyber Purple — purple-dominant
  "cyber-purple": mk({
    id: "cyber-purple",
    name: "Cyber Purple",
    description: "Royal violet · Green accent · Premium",
    bg: "#0B0518",
    surfaceTint: "#180D34",
    brand: "#C084FC",
    accent: "#22FF88",
  }),

  // 3. Midnight Blue — deep blue/cyan
  midnight: mk({
    id: "midnight",
    name: "Midnight Blue",
    description: "Deep blue · Cyan accent · Calm dark",
    bg: "#050714",
    surfaceTint: "#0A1024",
    brand: "#3B82F6",
    accent: "#22D3EE",
  }),

  // 4. AMOLED Black — minimalist pure black + chrome white
  amoled: mk({
    id: "amoled",
    name: "AMOLED Black",
    description: "Pure black · Chrome white · Battery saver",
    bg: "#000000",
    surfaceTint: "#070707",
    brand: "#FFFFFF",
    accent: "#9CA3AF",
    textSecondary: "#A0A0A0",
    textMuted: "#707070",
  }),

  // 5. Metallic Silver — chrome silver brand
  silver: mk({
    id: "silver",
    name: "Metallic Silver",
    description: "Chrome silver · Cyan accent · Industrial",
    bg: "#0A0E12",
    surfaceTint: "#141A22",
    brand: "#D4DBE5",
    accent: "#7DD3FC",
    brandDeep: "#8B92A0",
  }),

  // 6. Emerald Glass — deep green
  emerald: mk({
    id: "emerald",
    name: "Emerald Glass",
    description: "Forest emerald · Mint accent · Lush",
    bg: "#031410",
    surfaceTint: "#072820",
    brand: "#10B981",
    accent: "#6EE7B7",
  }),

  // 7. Crimson Neon — red/orange
  crimson: mk({
    id: "crimson",
    name: "Crimson Neon",
    description: "Hot crimson · Amber accent · Bold",
    bg: "#140404",
    surfaceTint: "#240A0A",
    brand: "#FF3D5C",
    accent: "#FFB347",
  }),

  // 8. Royal Violet — premium purple+gold
  royal: mk({
    id: "royal",
    name: "Royal Violet",
    description: "Imperial violet · Gold accent · Luxurious",
    bg: "#0C0518",
    surfaceTint: "#1A0D2C",
    brand: "#8B5CF6",
    accent: "#FBBF24",
  }),

  // 9. Arctic Ice — icy cyan + white
  arctic: mk({
    id: "arctic",
    name: "Arctic Ice",
    description: "Glacial cyan · Sky white · Cool",
    bg: "#060B14",
    surfaceTint: "#0E1626",
    brand: "#22D3EE",
    accent: "#E0F2FE",
  }),

  // 10. Gold Luxe — premium gold luxury
  gold: mk({
    id: "gold",
    name: "Gold Luxe",
    description: "Champagne gold · Bronze accent · Premium",
    bg: "#0F0B05",
    surfaceTint: "#1C1408",
    brand: "#FBBF24",
    accent: "#FB923C",
  }),
};

export type ThemeId = keyof typeof THEMES;
export const DEFAULT_THEME_ID: ThemeId = "neon";
export const THEME_LIST: ThemeTokens[] = Object.values(THEMES);
