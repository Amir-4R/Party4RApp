// /app/frontend/src/utils/useMutedWords.ts
// =============================================================================
// Party4R — Muted words hook
// =============================================================================
// Tiny hook that fetches the user's personal muted-words list once and exposes
// a `shouldMute(text)` helper so any screen can filter chat messages, DMs,
// comments etc. without duplicating logic.

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

interface UseMutedWordsResult {
  words: string[];
  /** True if `text` contains any muted word (case-insensitive substring). */
  shouldMute: (text: string | null | undefined) => boolean;
  reload: () => Promise<void>;
}

export function useMutedWords(): UseMutedWordsResult {
  const { token, user } = useAuth();
  const [words, setWords] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!token || !user) return;
    try {
      const r = await apiGet<{ items: string[] }>("/users/muted_words");
      setWords(r.items || []);
    } catch {
      // Silent fail — feature degrades gracefully (no filtering).
    }
  }, [token, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const shouldMute = useCallback(
    (text: string | null | undefined): boolean => {
      if (!text || words.length === 0) return false;
      const lower = text.toLowerCase();
      return words.some((w) => w && lower.includes(w));
    },
    [words],
  );

  return { words, shouldMute, reload };
}
