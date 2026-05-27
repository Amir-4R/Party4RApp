// Party4RApp — Cyber Neon palette + 4 preset themes
// ===================================================
// Phase 1: Visual identity for the Mega Update.
// Cyber Neon (default): neon green + neon purple on AMOLED black.
// Themes are exported so they can be swapped at runtime via ThemeContext.

export type ThemeId = "neon" | "midnight" | "amoled" | "cyber-purple";

export interface ThemePalette {
  id: ThemeId;
  name: string;
  // Backgrounds
  bg: string;            // top-level page background
  bgSoft: string;        // very subtle elevation (cards on bg)
  surface: string;       // cards / inputs / modal sheets
  surfaceElevated: string; // floating elements above cards
  // Borders & dividers
  border: string;
  borderAccent: string;
  // Brand
  brand: string;         // primary accent (neon green)
  brandDim: string;      // brand at low opacity (for badges, glows)
  accent: string;        // secondary accent (neon purple)
  accentDim: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;
  // Glow shadow color (for neon-outline effects)
  glow: string;
  // Bottom nav tint
  navBg: string;
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  // The default — green + purple, AMOLED-friendly
  neon: {
    id: "neon",
    name: "Neon Green",
    bg: "#070710",
    bgSoft: "#0C0C18",
    surface: "#14141F",
    surfaceElevated: "#1C1C2A",
    border: "#1F1F2D",
    borderAccent: "#2A2A3D",
    brand: "#22FF88",
    brandDim: "rgba(34,255,136,0.16)",
    accent: "#A855F7",
    accentDim: "rgba(168,85,247,0.18)",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0B0C4",
    textMuted: "#7A7A92",
    textDisabled: "#48485A",
    success: "#22FF88",
    warning: "#FFB800",
    error: "#FF3D71",
    info: "#33B5FF",
    glow: "#22FF88",
    navBg: "rgba(10,10,16,0.85)",
  },
  // Deep midnight blue — calmer, less neon
  midnight: {
    id: "midnight",
    name: "Midnight",
    bg: "#050714",
    bgSoft: "#0A0E1E",
    surface: "#10162A",
    surfaceElevated: "#161E36",
    border: "#1B2540",
    borderAccent: "#2A3654",
    brand: "#3B82F6",
    brandDim: "rgba(59,130,246,0.18)",
    accent: "#A855F7",
    accentDim: "rgba(168,85,247,0.18)",
    textPrimary: "#FFFFFF",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    textDisabled: "#475569",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
    glow: "#3B82F6",
    navBg: "rgba(8,12,28,0.85)",
  },
  // Pure AMOLED black — battery saver
  amoled: {
    id: "amoled",
    name: "AMOLED Black",
    bg: "#000000",
    bgSoft: "#070707",
    surface: "#0E0E0E",
    surfaceElevated: "#161616",
    border: "#1A1A1A",
    borderAccent: "#262626",
    brand: "#00FF88",
    brandDim: "rgba(0,255,136,0.18)",
    accent: "#9333EA",
    accentDim: "rgba(147,51,234,0.18)",
    textPrimary: "#FFFFFF",
    textSecondary: "#A0A0A0",
    textMuted: "#707070",
    textDisabled: "#404040",
    success: "#00FF88",
    warning: "#FFC107",
    error: "#FF1744",
    info: "#00B0FF",
    glow: "#00FF88",
    navBg: "rgba(0,0,0,0.9)",
  },
  // Cyber Purple — purple-dominant for contrast
  "cyber-purple": {
    id: "cyber-purple",
    name: "Cyber Purple",
    bg: "#0B0518",
    bgSoft: "#120A24",
    surface: "#1A0F34",
    surfaceElevated: "#231447",
    border: "#2B1A5A",
    borderAccent: "#3D267A",
    brand: "#C084FC",
    brandDim: "rgba(192,132,252,0.18)",
    accent: "#22FF88",
    accentDim: "rgba(34,255,136,0.18)",
    textPrimary: "#FFFFFF",
    textSecondary: "#C4B5FD",
    textMuted: "#8B7BC0",
    textDisabled: "#5B4F8A",
    success: "#22FF88",
    warning: "#FBBF24",
    error: "#FF3D71",
    info: "#60A5FA",
    glow: "#C084FC",
    navBg: "rgba(11,5,24,0.88)",
  },
};

export const DEFAULT_THEME_ID: ThemeId = "neon";
