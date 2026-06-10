// =============================================================================
// src/comms/useGamePersistence.ts — Resume a match after a temporary exit
// =============================================================================
// يحفظ حالة المباراة عند انتقال التطبيق للخلفية (Background/Inactive) ويستعيدها
// عند العودة أو عند إعادة فتح التطبيق (لو أنهى النظام التطبيق مؤقتاً). بهذا لا
// "تتسكر" اللعبة عند الخروج المؤقت.
//
//   • snapshot يُحفظ في AsyncStorage مباشرة (JSON واحد، بدون double-encode).
//   • on mount: لو وُجد snapshot حديث، يُستعاد عبر restore().
//   • clear(): يُستدعى عند الخروج الصريح أو انتهاء المباراة (لا استعادة بعدها).
//   • AppState: يُحفظ تلقائياً عند مغادرة المقدّمة.
//
// لمباريات الأونلاين مستقبلاً: نفس البنية تصلح لإعادة الاتصال (reconnect) —
// خزّن معرّف الجلسة في الحالة واستعد الاتصال عند العودة.
// =============================================================================
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "party_game_resume:";
// Snapshots older than this are ignored (stale match).
const MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6 hours

interface Snapshot<S> { savedAt: number; state: S; }

/**
 * Robust snapshot parser. Accepts both:
 *   • new single-encoded JSON  → `{"savedAt":...,"state":...}`
 *   • legacy double-encoded JSON written by an older version of this hook,
 *     i.e. `"\"{\\\"savedAt\\\":...}\""` (one extra string layer).
 * Returns the parsed Snapshot or `null` on corruption.
 */
function parseSnapshot<S>(raw: string): Snapshot<S> | null {
  try {
    let v: unknown = JSON.parse(raw);
    // If we still have a string after one parse, it was double-encoded by the
    // previous implementation — parse a second time.
    if (typeof v === "string") {
      v = JSON.parse(v);
    }
    if (v && typeof v === "object" && "savedAt" in v && "state" in v) {
      return v as Snapshot<S>;
    }
    return null;
  } catch {
    return null;
  }
}

export function useGamePersistence<S>(opts: {
  /** Stable key per game, e.g. "carrom" / "chess" / "damma". */
  key: string;
  /** User id (snapshots are per-user). */
  userId?: string;
  /** Returns the current serializable state to persist. */
  getState: () => S;
  /** Called once on mount if a valid snapshot exists. */
  restore: (state: S) => void;
  /** When true, persistence is paused (e.g. game already over). */
  paused?: boolean;
}) {
  const { key, userId, getState, restore, paused } = opts;
  const storageKey = `${PREFIX}${userId || "guest"}:${key}`;
  const getStateRef = useRef(getState);
  getStateRef.current = getState;
  const restoredRef = useRef(false);

  // Restore on mount (covers cold relaunch after the OS killed the app).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled || !raw) return;
        const snap = parseSnapshot<S>(raw);
        if (snap && snap.state && Date.now() - snap.savedAt < MAX_AGE_MS) {
          restoredRef.current = true;
          restore(snap.state);
        }
      } catch { /* ignore corrupt snapshot */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Save whenever the app leaves the foreground.
  useEffect(() => {
    const save = () => {
      if (paused) return;
      try {
        const snap: Snapshot<S> = { savedAt: Date.now(), state: getStateRef.current() };
        // Single JSON encode — readable payload.
        AsyncStorage.setItem(storageKey, JSON.stringify(snap)).catch(() => {});
      } catch { /* ignore */ }
    };
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "background" || s === "inactive") save();
    });
    return () => {
      // Also persist on unmount-from-navigation so returning resumes cleanly.
      save();
      sub.remove();
    };
  }, [storageKey, paused]);

  /** Call on explicit exit or game over so no stale match is restored later. */
  const clear = () => { AsyncStorage.removeItem(storageKey).catch(() => {}); };

  return { clear, wasRestored: restoredRef };
}
