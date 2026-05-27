// Party4RApp — Runtime theme context
// ====================================
// Lets every screen consume the current theme via `useTheme()`.
// Persists choice to SecureStore so it survives app restarts.
// Phase 1 of the Mega Update.

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";
import { THEMES, ThemeId, ThemePalette, DEFAULT_THEME_ID } from "@/src/constants/themes";

const KEY = "party_theme";

interface ThemeCtx {
  theme: ThemePalette;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    (async () => {
      const saved = (await storage.getItem(KEY, "")) as string;
      if (saved && THEMES[saved as ThemeId]) {
        setThemeIdState(saved as ThemeId);
      }
    })();
  }, []);

  const setThemeId = async (id: ThemeId) => {
    await storage.setItem(KEY, id);
    setThemeIdState(id);
  };

  return (
    <ThemeContext.Provider
      value={{ theme: THEMES[themeId], themeId, setThemeId }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

// Backwards-compatible export so legacy imports of `COLORS` keep working.
// They get the CURRENT active theme at module load time, but to react to
// runtime changes screens should use `useTheme()` directly.
export const COLORS = THEMES[DEFAULT_THEME_ID];
