export interface Avatar {
  id: string;
  url: string;
}

export const AVATARS: Avatar[] = [
  { id: "avatar_ninja", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/9f445a6b5c2d87aaf1c4fb7765d4103acb39539b9c7b6504061dbf0f3f7ede48.png" },
  { id: "avatar_astronaut", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/2c9153d6859216661d262d8f1a5725d1eeda03987fe7a3893426139e2cd00563.png" },
  { id: "avatar_skull", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/f55dcb868c9bdeb03ce5912467520adf4b09fa4b2d71ba9a21e8cca3b664695b.png" },
  { id: "avatar_alien", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/eafe4503b44f3b955b91ebe64dd0176afe89e2a405acad0b4d82ade7bb5c8966.png" },
  { id: "avatar_robot", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/0b0ea51f9ba491da3116b8c31b2c1c18556ac4129b1d81aae3e37a21172434c1.png" },
  { id: "avatar_cat", url: "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/f5701e045a5d35f44a19e7cf722d824430077a3827a1a7790fb0ac6fa3c0f490.png" },
];

export const LOGIN_BG_URL = "https://static.prod-images.emergentagent.com/jobs/2fd3e3b1-9322-4961-9b6d-db40056f5996/images/fe23407107d8ec51147db0e7004d8aabe78a835b4418012a37abfaa918253fbb.png";

// =====================================================================
// COLORS — Cyber Neon palette (Phase 1 Mega Update)
// Neon green primary + neon purple accent on AMOLED-friendly dark.
// All screens import this as their default. ThemeContext can override
// at runtime; this object is the fallback / static reference.
// =====================================================================
export const COLORS = {
  // Backgrounds
  bg: "#070710",
  bgSoft: "#0C0C18",
  surface: "#14141F",
  surfaceElevated: "#1C1C2A",
  // Borders
  border: "#1F1F2D",
  borderAccent: "#2A2A3D",
  // Brand — neon green
  brand: "#22FF88",
  brandDim: "rgba(34, 255, 136, 0.16)",
  brandGlow: "rgba(34, 255, 136, 0.40)",
  // Accent — neon purple
  accent: "#A855F7",
  accentDim: "rgba(168, 85, 247, 0.18)",
  accentGlow: "rgba(168, 85, 247, 0.40)",
  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0C4",
  textMuted: "#7A7A92",
  textDisabled: "#48485A",
  // Semantic
  error: "#FF3D71",
  success: "#22FF88",
  warning: "#FFB800",
  info: "#33B5FF",
  // Glow effect color for neon outlines
  glow: "#22FF88",
  // Bottom nav tint (semi-transparent over blur)
  navBg: "rgba(10, 10, 16, 0.85)",
};

export const getAvatarUrl = (id: string): string => {
  return AVATARS.find((a) => a.id === id)?.url || AVATARS[0].url;
};
