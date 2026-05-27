// /app/frontend/src/theme/futuristic.ts
// Party4R — Futuristic cyber-metallic design tokens.
// Layered depth, metallic gradients, neon accents.
// Keep this file as the single source of truth for colors / shadows /
// gradients across the redesigned UI.

export const FUTURISTIC = {
  // ----------------------- Backgrounds -----------------------------
  // True AMOLED black for the bottom layer.
  bg: "#000000",
  bgSoft: "#06070D",
  // Surface layers (rise as elevation increases).
  surface0: "#0A0B14",        // base panels
  surface1: "#101220",        // raised cards
  surface2: "#171a2c",        // floating sheets, modals
  surface3: "#1F2238",        // top elevation (active states)
  // Sheet behind blurred glass (transparent, sits on the gradient).
  glassFill: "rgba(20, 22, 38, 0.55)",
  glassTint: "rgba(10, 12, 22, 0.65)",

  // ----------------------- Borders ---------------------------------
  border: "#1F2238",
  borderSoft: "rgba(255,255,255,0.06)",
  borderStrong: "#2A2E48",
  // Iridescent metallic edge (used by MetallicCard top + bottom).
  metalEdgeTop: "rgba(255, 255, 255, 0.18)",
  metalEdgeBottom: "rgba(34, 255, 136, 0.20)",

  // ----------------------- Brand / Accents -------------------------
  brand: "#22FF88",            // neon green primary
  brandSoft: "rgba(34, 255, 136, 0.16)",
  brandGlow: "rgba(34, 255, 136, 0.45)",
  brandEdge: "rgba(34, 255, 136, 0.65)",
  accent: "#A855F7",           // neon purple secondary
  accentSoft: "rgba(168, 85, 247, 0.18)",
  accentGlow: "rgba(168, 85, 247, 0.42)",
  accentEdge: "rgba(168, 85, 247, 0.62)",
  // Tertiary cyber-blue used very sparingly (info, secondary actions).
  cyber: "#33E6FF",
  cyberSoft: "rgba(51, 230, 255, 0.16)",
  cyberGlow: "rgba(51, 230, 255, 0.40)",

  // ----------------------- Text ------------------------------------
  textPrimary: "#FFFFFF",
  textSecondary: "#B7BACD",
  textMuted: "#6C7090",
  textDisabled: "#3F435A",

  // ----------------------- Semantic --------------------------------
  error: "#FF3D71",
  errorSoft: "rgba(255, 61, 113, 0.16)",
  success: "#22FF88",
  warning: "#FFB347",
  info: "#33E6FF",

  // ----------------------- Spacing & radius ------------------------
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 },
} as const;

// Reusable gradient sets (use with expo-linear-gradient).
export const GRADIENTS = {
  // Top-to-bottom subtle metallic surface for cards.
  metalCard: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0.0)"],
  // The futuristic accent border (chrome -> green -> purple -> chrome).
  metalEdge: [
    "rgba(255,255,255,0.30)",
    "rgba(34,255,136,0.35)",
    "rgba(168,85,247,0.35)",
    "rgba(255,255,255,0.30)",
  ],
  // Brand glow used behind buttons.
  brandGlow: ["rgba(34,255,136,0.0)", "rgba(34,255,136,0.55)", "rgba(34,255,136,0.0)"],
  // Accent glow.
  accentGlow: ["rgba(168,85,247,0.0)", "rgba(168,85,247,0.55)", "rgba(168,85,247,0.0)"],
  // App background — radial-like deep space.
  appBg: ["#000000", "#04060E", "#0A0B14"],
  // Hero banner gradient (green->purple).
  hero: ["rgba(34,255,136,0.18)", "rgba(168,85,247,0.20)"],
} as const;

// Curved soft-shadow tokens (Android needs elevation, iOS uses shadow*).
export const SHADOWS = {
  // Subtle floating card.
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  // Stronger floating sheet (modals / bottom sheets).
  sheet: {
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  // Neon glow effect.
  glowBrand: {
    shadowColor: "#22FF88",
    shadowOpacity: 0.50,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  glowAccent: {
    shadowColor: "#A855F7",
    shadowOpacity: 0.50,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
} as const;

// Typography scale — UPPERCASE + letter-spacing for cinematic headers.
export const TYPO = {
  display: { fontSize: 32, fontWeight: "900" as const, letterSpacing: 1.2 },
  h1: { fontSize: 24, fontWeight: "900" as const, letterSpacing: 0.8 },
  h2: { fontSize: 18, fontWeight: "800" as const, letterSpacing: 0.5 },
  body: { fontSize: 14, fontWeight: "500" as const, letterSpacing: 0.1 },
  caption: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.8 },
  micro: { fontSize: 9, fontWeight: "800" as const, letterSpacing: 2.4 },
} as const;

export type FuturisticTheme = typeof FUTURISTIC;
