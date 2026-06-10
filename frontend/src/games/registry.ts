// =============================================================================
// src/games/registry.ts — Party4R Unified Game Registry
// =============================================================================
// مصدر واحد لتعريف كل الألعاب. بدل تكرار قوائم الألعاب في كل شاشة (play, lobby,
// matchmaking...) تُقرأ كلها من هنا. لإضافة لعبة جديدة مستقبلاً (XO, لودو, ...):
//   1) أضف صورة شعارها في assets/images/games/
//   2) أضف تعريفها في GAMES أدناه
//   3) أنشئ شاشتها على المسار المحدّد + محرّكها
// بدون لمس نظام الرتب أو النقاط أو الإحصائيات أو الدعوات.
// =============================================================================

import { Ionicons } from "@expo/vector-icons";
import { GameType } from "@/src/api/games";

export interface GameDefinition {
  id: GameType;
  /** i18n key for the display name (see LanguageContext). */
  nameKey: string;
  /** Ionicons glyph for compact UI. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Accent color used on cards/badges. */
  color: string;
  /** Logo image (require handle). */
  logo: any;
  /** Route to the playable screen. */
  route: string;
  /** Player count range. */
  minPlayers: number;
  maxPlayers: number;
  /** Whether the game is enabled in the hub. */
  available: boolean;
  /** Whether a single-player (vs bot) practice mode exists. */
  hasBot: boolean;
}

export const GAMES: Record<GameType, GameDefinition> = {
  chess: {
    id: "chess",
    nameKey: "play_chess",
    icon: "grid-outline",
    color: "#E8C97A",
    logo: require("@/assets/images/games/chess_logo.jpg"),
    route: "/game/chess",
    minPlayers: 2, maxPlayers: 2,
    available: true, hasBot: true,
  },
  carrom: {
    id: "carrom",
    nameKey: "play_carrom",
    icon: "ellipse-outline",
    color: "#7AE8C9",
    logo: require("@/assets/images/games/carrom_logo.jpg"),
    route: "/game/carrom",
    minPlayers: 2, maxPlayers: 2,
    available: true, hasBot: true,
  },
  damma: {
    id: "damma",
    nameKey: "play_damma",
    icon: "disc-outline",
    color: "#C97AE8",
    logo: require("@/assets/images/games/damma_logo.jpg"),
    route: "/game/damma",
    minPlayers: 2, maxPlayers: 2,
    available: true, hasBot: true,
  },
};

export const GAME_LIST: GameDefinition[] = Object.values(GAMES);

export function getGame(id?: string | null): GameDefinition | null {
  if (!id) return null;
  return (GAMES as Record<string, GameDefinition>)[id] || null;
}
