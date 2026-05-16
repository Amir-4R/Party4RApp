// Banners + Badges catalog. Pure config, no images required (rendered via gradients + icons).

import { COLORS } from "./avatars";

export interface Banner {
  id: string;
  name: string;
  colors: [string, string]; // gradient stops (rendered as two-tone overlay)
}

export const BANNERS: Banner[] = [
  { id: "neon_mint", name: "Neon Mint", colors: ["#00F2FE", "#0F3D44"] },
  { id: "violet_haze", name: "Violet Haze", colors: ["#8A2BE2", "#1B0832"] },
  { id: "sunset_glow", name: "Sunset Glow", colors: ["#FF6B6B", "#3A1F1F"] },
  { id: "midnight", name: "Midnight", colors: ["#23242A", "#0B0B0F"] },
];

export function getBanner(id?: string | null): Banner {
  return BANNERS.find((b) => b.id === id) || BANNERS[0];
}

export interface Badge {
  id: string;
  name: string;
  icon: string; // Ionicons name
  color: string;
}

export const BADGES: Badge[] = [
  { id: "founder", name: "Founder", icon: "rocket", color: "#00F2FE" },
  { id: "night_owl", name: "Night Owl", icon: "moon", color: "#8A2BE2" },
  { id: "host_x10", name: "Host x10", icon: "trophy", color: "#FFD700" },
  { id: "party_starter", name: "Party Starter", icon: "sparkles", color: "#FF6B6B" },
  { id: "music_lover", name: "Music Lover", icon: "musical-notes", color: "#34C759" },
  { id: "explorer", name: "Explorer", icon: "globe", color: "#5AC8FA" },
];

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

export const PROFILE_COLORS = COLORS;
