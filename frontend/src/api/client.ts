// =============================================================================
// API Client — Party4R
// =============================================================================
// Hard-coded production backend (Render). The .env value still wins during
// `expo start` for local dev, but the bare React Native bundler used by
// `./gradlew assembleRelease` on Termux does NOT load .env files, so this
// fallback is what keeps the APK functional.
//
// Production endpoint:  https://party4rapp.onrender.com/api
//
// This module also implements:
//   1. Silent auto-retry while the Render free-tier instance is spinning up
//      (cold-start can take 30–90s). Retries every 5s for up to ~3 min, then
//      surfaces a friendly error so the UI can still recover gracefully.
//   2. Mobile-friendly request headers (Accept, X-Requested-With) so iOS /
//      Android WebView / native fetch all negotiate JSON correctly.
//   3. Auto-recovery if the server briefly goes down and comes back —
//      transient network failures (TypeError "Network request failed") and
//      HTTP 502/503/504 are treated as "wake-up in progress".
// =============================================================================

import { storage } from "@/src/utils/storage";

// ---------------------------------------------------------------------------
// 1. Base URL configuration
// ---------------------------------------------------------------------------
// User-provided override (e.g. for self-hosted setups) wins via .env;
// otherwise we lock to the Render production deployment.
const RAW_BASE: string =
  (process.env.EXPO_PUBLIC_BACKEND_URL as string | undefined) ||
  "https://party4rapp.onrender.com";

// API_BASE always carries the /api prefix that the FastAPI backend expects.
// We tolerate both "https://host" and "https://host/api" inputs so legacy
// .env values don't break things.
const HOST_WITHOUT_TRAILING_API = RAW_BASE.replace(/\/api\/?$/, "").replace(
  /\/+$/,
  ""
);
export const API_BASE: string = `${HOST_WITHOUT_TRAILING_API}/api`;

// Exposed so other modules (e.g. WS URL builder) can read the host root.
export const BACKEND_HOST: string = HOST_WITHOUT_TRAILING_API;

export const TOKEN_KEY = "party_auth_token";

// ---------------------------------------------------------------------------
// 2. Headers (mobile-friendly)
// ---------------------------------------------------------------------------
async function getHeaders(json = true): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const h: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "Party4R-Mobile",
  };
  if (json) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// ---------------------------------------------------------------------------
// 3. Retry-aware fetch wrapper
// ---------------------------------------------------------------------------
// Retry strategy: every RETRY_DELAY_MS milliseconds, up to MAX_RETRIES times.
// Triggered ONLY by transient errors that match the Render cold-start
// signature (network failure / 502 / 503 / 504). All other errors propagate
// immediately so 401/403/404/422 still surface to the UI as usual.
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 36; // ~3 minutes — covers worst-case Render warm-up

// Simple subscription channel so the UI can show a "Waking server up…" hint
// while the cold-start retry loop is running, if it wants to.
type ColdStartListener = (waking: boolean) => void;
const coldStartListeners = new Set<ColdStartListener>();
let coldStartActive = false;

function setColdStart(waking: boolean) {
  if (coldStartActive === waking) return;
  coldStartActive = waking;
  coldStartListeners.forEach((cb) => {
    try {
      cb(waking);
    } catch {}
  });
}

export function onColdStartChange(cb: ColdStartListener): () => void {
  coldStartListeners.add(cb);
  // Immediate sync of current state.
  try {
    cb(coldStartActive);
  } catch {}
  return () => {
    coldStartListeners.delete(cb);
  };
}

export function isServerWakingUp(): boolean {
  return coldStartActive;
}

function shouldRetry(status: number | null, errMsg: string): boolean {
  // Transient HTTP statuses returned during Render boot
  if (status === 502 || status === 503 || status === 504) return true;
  // Network-level failures (no DNS / TCP / TLS yet)
  if (status === null) {
    const m = (errMsg || "").toLowerCase();
    return (
      m.includes("network request failed") ||
      m.includes("failed to fetch") ||
      m.includes("network error") ||
      m.includes("timeout") ||
      m.includes("aborted")
    );
  }
  return false;
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface FetchOpts {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  json?: boolean;
}

async function fetchWithRetry<T>(opts: FetchOpts): Promise<T> {
  const { path, method, body, json = true } = opts;
  const url = `${API_BASE}${path}`;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= MAX_RETRIES) {
    let status: number | null = null;
    try {
      const headers = await getHeaders(json);
      const res = await fetch(url, {
        method,
        headers,
        body: body && method !== "GET" ? JSON.stringify(body) : undefined,
      });
      status = res.status;

      // Retry-worthy server responses (Render still booting)
      if (shouldRetry(status, "")) {
        throw new Error(`HTTP ${status} (server warming up)`);
      }

      if (!res.ok) {
        const text = await res.text();
        let detail = text;
        try {
          const parsed = JSON.parse(text);
          detail = parsed.detail || parsed.message || text;
        } catch {}
        const err = new Error(detail || `HTTP ${res.status}`);
        (err as Error & { status?: number }).status = status;
        // Non-retryable — propagate immediately
        setColdStart(false);
        throw err;
      }

      // Success — clear cold-start indicator (if it was set)
      setColdStart(false);

      // No-body responses
      if (res.status === 204) return undefined as unknown as T;
      return (await res.json()) as T;
    } catch (e) {
      const err = e as Error;
      lastError = err;

      // If this error is NOT retryable, propagate it now.
      if (!shouldRetry(status, err.message || "")) {
        setColdStart(false);
        throw err;
      }

      // Retryable. Surface "server waking" hint to the UI.
      setColdStart(true);

      if (attempt >= MAX_RETRIES) break;
      attempt += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[api] ${method} ${path} failed (${err.message}). Retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms…`
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  setColdStart(false);
  throw (
    lastError ||
    new Error(
      "Couldn't reach the server. Please check your connection and try again."
    )
  );
}

// ---------------------------------------------------------------------------
// 4. Public API surface (unchanged signature — callers don't need updates)
// ---------------------------------------------------------------------------
export async function apiGet<T>(path: string): Promise<T> {
  return fetchWithRetry<T>({ path, method: "GET", json: false });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetchWithRetry<T>({ path, method: "POST", body });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return fetchWithRetry<T>({ path, method: "PATCH", body });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return fetchWithRetry<T>({ path, method: "DELETE", json: false });
}

// ---------------------------------------------------------------------------
// 5. WebSocket URL builder (re-uses the Render host)
// ---------------------------------------------------------------------------
export function getWsUrl(roomId: string, token: string): string {
  const wsBase = BACKEND_HOST.replace(/^http/, "ws");
  return `${wsBase}/api/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// 6. Optional: explicit warm-up ping (called once on app boot to wake Render
//    before the user hits Login). Best-effort — silent on failure.
// ---------------------------------------------------------------------------
export async function pingBackend(): Promise<void> {
  try {
    await fetch(`${API_BASE}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    // Backend may be cold — that's fine. Real requests will retry.
  }
}
