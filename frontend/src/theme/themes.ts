// /app/frontend/src/theme/themes.ts
// =============================================================================
// Party4R — Global Theme System (Phase 8.5: Expanded library)
// =============================================================================
// 25 visually-distinct themes. The first FOUR are the "featured" premium
// defaults exposed at the top of Settings:
//
//   neon          → Neon Green     (default)
//   midnight      → Midnight Blue
//   amoled        → AMOLED Black
//   cyber-purple  → Cyber Purple
//
// All others live inside the collapsible "More Themes" library. Each theme
// targets ONE dominant brand color — accents are deliberately kept close to
// the brand hue (or a neutral) to preserve a pure, futuristic look.
//
// To add a new theme:
//   1. Append a `mk({...})` entry below.
//   2. Add its id to either FEATURED_IDS or EXTRA_IDS for grouping.
//   3. (Optional) Add a `family` tag for future search/filter.

// ---------------------------------------------------------------------------
// Helpers — color utilities
// ---------------------------------------------------------------------------
function rgba(hex: string, a: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function shadeLayer(bg: string, step: number, mode: "dark" | "light" = "dark"): string {
  // Lighten/darken bg slightly per layer (step 1..5). For dark themes layers
  // go brighter; for light themes layers go darker.
  const m = bg.replace("#", "");
  if (m.length !== 6) return bg;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const delta = step * (mode === "light" ? -5 : 6);
  const nr = Math.max(0, Math.min(255, r + delta));
  const ng = Math.max(0, Math.min(255, g + delta));
  const nb = Math.max(0, Math.min(255, b + delta));
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

// ---------------------------------------------------------------------------
// Theme shape
// ---------------------------------------------------------------------------
export interface ThemeTokens {
  // identity
  id: string;
  name: string;
  description: string;
  family?: string;       // "green" | "blue" | "red" | "purple" | "gold" | "white" | ...
  mode?: "dark" | "light";
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
  brandDeep: string;

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

  // gradient stops for the app background
  appBgStops: [string, string, string];
}

// ---------------------------------------------------------------------------
// Factory — build a full theme from anchor colors
// ---------------------------------------------------------------------------
function mk(opts: {
  id: string;
  name: string;
  description: string;
  family?: string;
  mode?: "dark" | "light";
  bg: string;
  brand: string;
  accent?: string;        // defaults to a lighter shade of brand → pure-color look
  cyber?: string;
  surfaceTint?: string;
  brandDeep?: string;
  accentDeep?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
  textDisabled?: string;
  metalEdgeTop?: string;
  borderSoft?: string;
}): ThemeTokens {
  const mode = opts.mode || "dark";
  const surfaceBase = opts.surfaceTint || opts.bg;
  const cyber = opts.cyber || "#33E6FF";
  // For pure-color themes the accent defaults to a soft brand-derived tint.
  const accent = opts.accent || lighten(opts.brand, 0.25);

  // Sensible text defaults per mode.
  const isLight = mode === "light";
  const defaults = isLight
    ? {
        textPrimary: "#0B0B12",
        textSecondary: "#3A3A4A",
        textMuted: "#7A7A8A",
        textDisabled: "#B5B5C5",
        borderSoft: "rgba(0,0,0,0.06)",
        metalEdgeTop: "rgba(0,0,0,0.10)",
      }
    : {
        textPrimary: "#FFFFFF",
        textSecondary: "#B7BACD",
        textMuted: "#6C7090",
        textDisabled: "#3F435A",
        borderSoft: "rgba(255,255,255,0.06)",
        metalEdgeTop: "rgba(255,255,255,0.18)",
      };

  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    family: opts.family,
    mode,
    preview: { bg: opts.bg, brand: opts.brand, accent },

    bg: opts.bg,
    bgSoft: shadeLayer(surfaceBase, 1, mode),
    surface0: shadeLayer(surfaceBase, 2, mode),
    surface1: shadeLayer(surfaceBase, 3, mode),
    surface2: shadeLayer(surfaceBase, 4, mode),
    surface3: shadeLayer(surfaceBase, 5, mode),
    glassFill: rgba(shadeLayer(surfaceBase, 3, mode), 0.55),
    glassTint: rgba(shadeLayer(surfaceBase, 2, mode), 0.65),

    border: shadeLayer(surfaceBase, 4, mode),
    borderSoft: opts.borderSoft || defaults.borderSoft,
    borderStrong: shadeLayer(surfaceBase, 5, mode),
    metalEdgeTop: opts.metalEdgeTop || defaults.metalEdgeTop,
    metalEdgeBottom: rgba(opts.brand, 0.22),

    brand: opts.brand,
    brandSoft: rgba(opts.brand, 0.16),
    brandGlow: rgba(opts.brand, 0.45),
    brandEdge: rgba(opts.brand, 0.65),
    brandDeep: opts.brandDeep || darken(opts.brand, 0.35),

    accent,
    accentSoft: rgba(accent, 0.18),
    accentGlow: rgba(accent, 0.42),
    accentEdge: rgba(accent, 0.62),
    accentDeep: opts.accentDeep || darken(accent, 0.35),

    cyber,
    cyberSoft: rgba(cyber, 0.16),
    cyberGlow: rgba(cyber, 0.40),

    textPrimary: opts.textPrimary || defaults.textPrimary,
    textSecondary: opts.textSecondary || defaults.textSecondary,
    textMuted: opts.textMuted || defaults.textMuted,
    textDisabled: opts.textDisabled || defaults.textDisabled,

    error: "#FF3D71",
    errorSoft: "rgba(255, 61, 113, 0.16)",
    success: opts.brand,
    warning: "#FFB347",
    info: cyber,

    appBgStops: [
      opts.bg,
      shadeLayer(surfaceBase, 1, mode),
      shadeLayer(surfaceBase, 2, mode),
    ],
  };
}

// Lighten helper — moves hex toward white by `amount` (0..1).
function lighten(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const nr = Math.min(255, Math.floor(r + (255 - r) * amount));
  const ng = Math.min(255, Math.floor(g + (255 - g) * amount));
  const nb = Math.min(255, Math.floor(b + (255 - b) * amount));
  return (
    "#" +
    nr.toString(16).padStart(2, "0") +
    ng.toString(16).padStart(2, "0") +
    nb.toString(16).padStart(2, "0")
  );
}

// =============================================================================
// THE THEMES — 25 total (4 featured + 21 extras)
// =============================================================================
export const THEMES: Record<string, ThemeTokens> = {
  // ---------------------------------------------------------------------------
  // FEATURED (4) — keep names + descriptions stable, these surface at the top
  // ---------------------------------------------------------------------------
  neon: mk({
    id: "neon",
    name: "Neon Green",
    description: "Cyber green · AMOLED dark · Default",
    family: "green",
    bg: "#000000",
    surfaceTint: "#0A0B14",
    brand: "#22FF88",
    accent: "#A855F7",
  }),

  midnight: mk({
    id: "midnight",
    name: "Midnight Blue",
    description: "Deep blue · Cyan accent · Calm dark",
    family: "blue",
    bg: "#050714",
    surfaceTint: "#0A1024",
    brand: "#3B82F6",
    accent: "#22D3EE",
  }),

  amoled: mk({
    id: "amoled",
    name: "AMOLED Black",
    description: "Pure black · Chrome white · Battery saver",
    family: "white",
    bg: "#000000",
    surfaceTint: "#070707",
    brand: "#FFFFFF",
    accent: "#9CA3AF",
    textSecondary: "#A0A0A0",
    textMuted: "#707070",
  }),

  "cyber-purple": mk({
    id: "cyber-purple",
    name: "Cyber Purple",
    description: "Royal violet · Green accent · Premium",
    family: "purple",
    bg: "#0B0518",
    surfaceTint: "#180D34",
    brand: "#C084FC",
    accent: "#22FF88",
  }),

  // ---------------------------------------------------------------------------
  // EXTRA THEMES — pure-color identities. Sorted roughly by color family
  // for the search/filter feature to look organized.
  // ---------------------------------------------------------------------------

  // ── Green family ─────────────────────────────────────────────────────────
  emerald: mk({
    id: "emerald",
    name: "Emerald",
    description: "Forest emerald · Lush green",
    family: "green",
    bg: "#031410",
    surfaceTint: "#072820",
    brand: "#10B981",
  }),
  "toxic-lime": mk({
    id: "toxic-lime",
    name: "Toxic Lime",
    description: "Radioactive lime · Hazard glow",
    family: "green",
    bg: "#0A1200",
    surfaceTint: "#141F00",
    brand: "#CCFF00",
  }),

  // ── Blue family ──────────────────────────────────────────────────────────
  "electric-blue": mk({
    id: "electric-blue",
    name: "Electric Blue",
    description: "High-voltage azure · Live wire",
    family: "blue",
    bg: "#020A18",
    surfaceTint: "#04162C",
    brand: "#0EA5E9",
  }),
  "deep-ocean": mk({
    id: "deep-ocean",
    name: "Deep Ocean",
    description: "Abyssal blue · Subsurface depth",
    family: "blue",
    bg: "#020512",
    surfaceTint: "#040B20",
    brand: "#1D4ED8",
  }),
  "royal-blue": mk({
    id: "royal-blue",
    name: "Royal Blue",
    description: "Regal blue · Imperial accent",
    family: "blue",
    bg: "#040820",
    surfaceTint: "#0A1235",
    brand: "#2563EB",
  }),
  sapphire: mk({
    id: "sapphire",
    name: "Sapphire",
    description: "Cut sapphire · Jeweled glow",
    family: "blue",
    bg: "#020A1A",
    surfaceTint: "#06122E",
    brand: "#0F52BA",
  }),

  // ── Cyan family ──────────────────────────────────────────────────────────
  "cyan-core": mk({
    id: "cyan-core",
    name: "Cyan Core",
    description: "Reactor cyan · Energy pulse",
    family: "cyan",
    bg: "#001012",
    surfaceTint: "#001E24",
    brand: "#00FFFF",
  }),
  arctic: mk({
    id: "arctic",
    name: "Arctic Ice",
    description: "Glacial cyan · Cold serene",
    family: "cyan",
    bg: "#060B14",
    surfaceTint: "#0E1626",
    brand: "#22D3EE",
  }),

  // ── Red family ───────────────────────────────────────────────────────────
  "neon-red": mk({
    id: "neon-red",
    name: "Neon Red",
    description: "Hot neon · Siren red",
    family: "red",
    bg: "#140202",
    surfaceTint: "#240505",
    brand: "#FF1744",
  }),
  crimson: mk({
    id: "crimson",
    name: "Crimson",
    description: "Hot crimson · Bold edge",
    family: "red",
    bg: "#140404",
    surfaceTint: "#240A0A",
    brand: "#FF3D5C",
  }),
  "ruby-red": mk({
    id: "ruby-red",
    name: "Ruby Red",
    description: "Deep ruby · Faceted glow",
    family: "red",
    bg: "#120203",
    surfaceTint: "#220308",
    brand: "#E11D48",
  }),

  // ── Orange family ────────────────────────────────────────────────────────
  "orange-pulse": mk({
    id: "orange-pulse",
    name: "Orange Pulse",
    description: "Solar orange · Pulse glow",
    family: "orange",
    bg: "#140700",
    surfaceTint: "#220D00",
    brand: "#FF6B00",
  }),
  "dark-bronze": mk({
    id: "dark-bronze",
    name: "Dark Bronze",
    description: "Antique bronze · Warm metal",
    family: "orange",
    bg: "#0F0905",
    surfaceTint: "#1C1308",
    brand: "#B8702F",
  }),

  // ── Pink / Rose family ───────────────────────────────────────────────────
  "pink-neon": mk({
    id: "pink-neon",
    name: "Pink Neon",
    description: "Electric pink · Hot magenta",
    family: "pink",
    bg: "#15030B",
    surfaceTint: "#240518",
    brand: "#FF1493",
  }),
  "rose-glow": mk({
    id: "rose-glow",
    name: "Rose Glow",
    description: "Soft rose · Warm romance",
    family: "pink",
    bg: "#180812",
    surfaceTint: "#270E1F",
    brand: "#F472B6",
  }),

  // ── Purple / Violet family ───────────────────────────────────────────────
  "plasma-violet": mk({
    id: "plasma-violet",
    name: "Plasma Violet",
    description: "Plasma arc · Charged violet",
    family: "purple",
    bg: "#0A001A",
    surfaceTint: "#15002E",
    brand: "#BF00FF",
  }),
  "ultra-violet": mk({
    id: "ultra-violet",
    name: "Ultra Violet",
    description: "Ultra UV · Pure spectrum",
    family: "purple",
    bg: "#06001A",
    surfaceTint: "#0C0033",
    brand: "#5F00FF",
  }),
  royal: mk({
    id: "royal",
    name: "Royal Violet",
    description: "Imperial violet · Premium feel",
    family: "purple",
    bg: "#0C0518",
    surfaceTint: "#1A0D2C",
    brand: "#8B5CF6",
  }),

  // ── Gold / Bronze family ─────────────────────────────────────────────────
  gold: mk({
    id: "gold",
    name: "Gold Luxe",
    description: "Champagne gold · Premium",
    family: "gold",
    bg: "#0F0B05",
    surfaceTint: "#1C1408",
    brand: "#FBBF24",
  }),

  // ── Silver / Titanium ────────────────────────────────────────────────────
  "titanium-silver": mk({
    id: "titanium-silver",
    name: "Titanium Silver",
    description: "Chrome titanium · Industrial",
    family: "silver",
    bg: "#0A0E12",
    surfaceTint: "#141A22",
    brand: "#D4DBE5",
  }),

  // ── Light / White (architectural note) ──────────────────────────────────
  // A true light-mode "Pure White" theme would need every screen's
  // StyleSheet to be reactive (text colors are currently captured at
  // module load). We instead ship "Frost White" — a chrome-white brand on
  // a near-black bg — which delivers the same "white" personality without
  // breaking contrast on dark-first screens.
  "frost-white": mk({
    id: "frost-white",
    name: "Frost White",
    description: "Chrome white · Subzero · Crisp",
    family: "white",
    bg: "#070708",
    surfaceTint: "#0D0D10",
    brand: "#F8FAFC",
    accent: "#CBD5E1",
    textSecondary: "#D1D5DB",
  }),

  // ── Mint / Aqua family ───────────────────────────────────────────────────
  "mint-aqua": mk({
    id: "mint-aqua",
    name: "Mint Aqua",
    description: "Mint aqua · Fresh cool",
    family: "green",
    bg: "#04130F",
    surfaceTint: "#08221C",
    brand: "#34D399",
  }),
};

// =============================================================================
// Grouping — used by Settings UI to split featured cards from the library
// =============================================================================
export const FEATURED_IDS = ["neon", "midnight", "amoled", "cyber-purple"] as const;

export const EXTRA_IDS = (Object.keys(THEMES) as string[]).filter(
  (id) => !FEATURED_IDS.includes(id as any)
);

export type ThemeId = keyof typeof THEMES;
export const DEFAULT_THEME_ID: ThemeId = "neon";
export const THEME_LIST: ThemeTokens[] = Object.values(THEMES);
