// /app/frontend/src/utils/cloudSync.ts
// =============================================================================
// Party4R — Cloud Sync hook
// =============================================================================
// Roams user preferences (language, theme, blocked users, muted words, ...)
// across devices via the /api/cloud/sync backend.
//
// Design:
//   • Pull-on-login: as soon as the user signs in, we pull the latest payload
//     from the server and apply it locally (overwrites local AsyncStorage).
//   • Push-on-change: every local setting change is debounced 2s then pushed.
//   • Optimistic concurrency: server uses `base_version` to detect conflicts.
//   • A small status object (`{ syncing, lastSyncedAt, error }`) is exposed so
//     the Settings screen can show a "Synced ✓" badge.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/src/context/AuthContext";
import { apiGet, apiPost } from "@/src/api/client";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface SyncPayload {
  language?: "en" | "ar";
  theme?: string;
  notifications?: {
    dms?: boolean;
    rooms?: boolean;
    tournaments?: boolean;
  };
  blocked_users?: string[];
  muted_words?: string[];
  last_room_id?: string | null;
  // Free-form custom keys
  custom?: Record<string, any>;
}

interface SyncStatus {
  syncing: boolean;
  lastSyncedAt: string | null;
  version: number;
  error: string | null;
  hasPulledOnce: boolean;
}

interface CloudSyncCtx {
  status: SyncStatus;
  /** Read the latest synced payload (may be empty before first pull) */
  payload: SyncPayload;
  /** Merge changes locally → triggers a debounced push to the server */
  update: (changes: Partial<SyncPayload>) => void;
  /** Force a fresh pull from server (e.g. user taps "Sync now") */
  pull: () => Promise<void>;
  /** Force-push current local payload immediately */
  push: () => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncCtx | undefined>(undefined);

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------
export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();

  const [payload, setPayload] = useState<SyncPayload>({});
  const [status, setStatus] = useState<SyncStatus>({
    syncing: false,
    lastSyncedAt: null,
    version: 0,
    error: null,
    hasPulledOnce: false,
  });

  // We hold the in-flight push timer so we can cancel & re-schedule on rapid
  // edits (e.g. user toggles a switch multiple times in a row).
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a fresh ref to the latest payload + version so the timer callback
  // doesn't capture a stale closure.
  const payloadRef = useRef<SyncPayload>({});
  const versionRef = useRef<number>(0);
  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  // ──────────────────────────────────────────────────────────────────────────
  // PULL — fetch the latest server payload (called on login & "Sync now")
  // ──────────────────────────────────────────────────────────────────────────
  const pull = useCallback(async () => {
    if (!token || !user) return;
    setStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const res = await apiGet<{
        payload: SyncPayload;
        version: number;
        updated_at: string | null;
      }>("/cloud/sync");
      setPayload(res.payload || {});
      versionRef.current = res.version || 0;
      setStatus({
        syncing: false,
        lastSyncedAt: res.updated_at,
        version: res.version || 0,
        error: null,
        hasPulledOnce: true,
      });
    } catch (e: any) {
      setStatus((s) => ({
        ...s,
        syncing: false,
        error: e?.message || "Pull failed",
        hasPulledOnce: true,
      }));
    }
  }, [token, user]);

  // ──────────────────────────────────────────────────────────────────────────
  // PUSH — send current payload to server with optimistic concurrency
  // ──────────────────────────────────────────────────────────────────────────
  const push = useCallback(async () => {
    if (!token || !user) return;
    setStatus((s) => ({ ...s, syncing: true, error: null }));
    try {
      const res = await apiPost<{
        ok: boolean;
        conflict?: boolean;
        version?: number;
        updated_at?: string;
        server_version?: number;
        payload?: SyncPayload;
      }>("/cloud/sync", {
        payload: payloadRef.current,
        base_version: versionRef.current,
      });
      if (res.conflict) {
        // Server has newer data — overwrite local with server's, bump version.
        const serverPayload = res.payload || {};
        setPayload(serverPayload);
        versionRef.current = res.server_version || 0;
        setStatus({
          syncing: false,
          lastSyncedAt: new Date().toISOString(),
          version: res.server_version || 0,
          error: "Updated from another device",
          hasPulledOnce: true,
        });
        return;
      }
      versionRef.current = res.version || versionRef.current + 1;
      setStatus({
        syncing: false,
        lastSyncedAt: res.updated_at || new Date().toISOString(),
        version: res.version || versionRef.current,
        error: null,
        hasPulledOnce: true,
      });
    } catch (e: any) {
      setStatus((s) => ({
        ...s,
        syncing: false,
        error: e?.message || "Push failed",
      }));
    }
  }, [token, user]);

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE — merge user-supplied changes & schedule a debounced push
  // ──────────────────────────────────────────────────────────────────────────
  const update = useCallback(
    (changes: Partial<SyncPayload>) => {
      setPayload((prev) => {
        const next = { ...prev, ...changes };
        payloadRef.current = next;
        return next;
      });
      if (pushTimer.current) clearTimeout(pushTimer.current);
      // Debounce 2s — rapid toggles only result in one network call.
      pushTimer.current = setTimeout(() => {
        push();
      }, 2000);
    },
    [push],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Effects — auto-pull on login
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (token && user) {
      pull();
    } else {
      // Logged out → wipe local copy so next user starts fresh.
      setPayload({});
      versionRef.current = 0;
      setStatus({
        syncing: false,
        lastSyncedAt: null,
        version: 0,
        error: null,
        hasPulledOnce: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  // Cleanup pending timer on unmount
  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    },
    [],
  );

  return (
    <CloudSyncContext.Provider value={{ status, payload, update, pull, push }}>
      {children}
    </CloudSyncContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------
export function useCloudSync(): CloudSyncCtx {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) {
    // Sensible no-op fallback so non-wrapped tests don't blow up.
    return {
      status: {
        syncing: false,
        lastSyncedAt: null,
        version: 0,
        error: null,
        hasPulledOnce: false,
      },
      payload: {},
      update: () => {},
      pull: async () => {},
      push: async () => {},
    };
  }
  return ctx;
}
