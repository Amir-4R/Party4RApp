// /app/frontend/src/context/ThemeContext.tsx
// =============================================================================
// Party4R — Runtime theme context (Phase 8 — Global theme system)
// =============================================================================
// Manages the active themeId and applies it globally by mutating the shared
// FUTURISTIC / GRADIENTS / SHADOWS objects in /src/theme/futuristic.ts. The
// root layout listens to themeId changes and re-mounts the inner Stack so
// every screen picks up the new colors instantly.
//
// Persisted to SecureStore so theme survives app restarts.

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";
import { THEMES, ThemeId, DEFAULT_THEME_ID, ThemeTokens, THEME_LIST } from "@/src/theme/themes";
import { applyTheme, FUTURISTIC } from "@/src/theme/futuristic";

const STORAGE_KEY = "party_theme";

interface ThemeCtx {
  themeId: ThemeId;
  theme: ThemeTokens;
  setThemeId: (id: ThemeId) => Promise<void>;
  // For UI components that render lists of themes (Settings):
  list: ThemeTokens[];
}

const ThemeContext = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  // -- Load persisted choice on mount + apply it immediately. ----------------
  useEffect(() => {
    (async () => {
      const saved = (await storage.getItem(STORAGE_KEY, "")) as string;
      if (saved && (THEMES as any)[saved]) {
        applyTheme(saved as ThemeId);
        setThemeIdState(saved as ThemeId);
      } else {
        applyTheme(DEFAULT_THEME_ID);
      }
    })();
  }, []);

  const setThemeId = async (id: ThemeId) => {
    if (!THEMES[id]) return;
    // 1. Mutate the global FUTURISTIC tokens. Components that read them
    //    statically (most of the app) will pick up the new values when their
    //    parent tree re-mounts (step 3).
    applyTheme(id);
    // 2. Persist to SecureStore so it survives restarts.
    await storage.setItem(STORAGE_KEY, id);
    // 3. Bump the React state, which:
    //    - notifies useTheme() subscribers (they re-render),
    //    - triggers the key={themeId} remount of the Stack in app/_layout.tsx,
    //      so even screens that don't subscribe to context re-render with new
    //      FUTURISTIC values.
    setThemeIdState(id);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        theme: THEMES[themeId] || THEMES[DEFAULT_THEME_ID],
        setThemeId,
        list: THEME_LIST,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

// Re-export FUTURISTIC for backwards-compatible imports from older screens.
// New code should prefer `useTheme().theme` for reactivity, but FUTURISTIC
// still works because it gets mutated by applyTheme().
export { FUTURISTIC as COLORS };
