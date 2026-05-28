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
// COLORS — DYNAMIC theme proxy (Phase 9 — Global theme system).
//
// Historically this was a hardcoded neon-green palette. It is now a
// getter-based facade over the live `FUTURISTIC` tokens, so every screen
// that uses `COLORS.brand`, `COLORS.bg`, etc. follows the active theme
// instantly when `applyTheme()` mutates FUTURISTIC. All ~241 existing
// `COLORS.*` references in the app automatically become theme-reactive
// without touching their styles.
// =====================================================================
import { FUTURISTIC } from "@/src/theme/futuristic";

export const COLORS = {
  // Backgrounds
  get bg() { return FUTURISTIC.bg; },
  get bgSoft() { return FUTURISTIC.bgSoft; },
  get surface() { return FUTURISTIC.surface1; },
  get surfaceElevated() { return FUTURISTIC.surface2; },
  // Borders
  get border() { return FUTURISTIC.border; },
  get borderAccent() { return FUTURISTIC.borderStrong; },
  // Brand
  get brand() { return FUTURISTIC.brand; },
  get brandDim() { return FUTURISTIC.brandSoft; },
  get brandGlow() { return FUTURISTIC.brandGlow; },
  // Accent
  get accent() { return FUTURISTIC.accent; },
  get accentDim() { return FUTURISTIC.accentSoft; },
  get accentGlow() { return FUTURISTIC.accentGlow; },
  // Text
  get textPrimary() { return FUTURISTIC.textPrimary; },
  get textSecondary() { return FUTURISTIC.textSecondary; },
  get textMuted() { return FUTURISTIC.textMuted; },
  get textDisabled() { return FUTURISTIC.textDisabled; },
  // Semantic
  get error() { return FUTURISTIC.error; },
  get success() { return FUTURISTIC.success; },
  get warning() { return FUTURISTIC.warning; },
  get info() { return FUTURISTIC.info; },
  // Effect helpers
  get glow() { return FUTURISTIC.brand; },
  // Bottom nav tint (semi-transparent over blur) — stays neutral dark
  navBg: "rgba(10, 10, 16, 0.85)",
};

export const getAvatarUrl = (id: string): string => {
  return AVATARS.find((a) => a.id === id)?.url || AVATARS[0].url;
};
