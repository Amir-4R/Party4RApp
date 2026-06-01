import { storage } from "@/src/utils/storage";

// Production backend URL — embedded as a build-time constant so the APK
// works even when `.env` is not loaded by the bundler. The `.env` value
// (used in `expo start`) wins when defined; otherwise we fall back to the
// hosted Render deployment that the production APK actually talks to.
const BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://party4rapp.onrender.com";
export const API_BASE = `${BASE_URL}/api`;

export const TOKEN_KEY = "party_auth_token";

async function getHeaders(json = true): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: await getHeaders(false) });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: await getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail = JSON.parse(text).detail || text;
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiPatch<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: await getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: await getHeaders(false),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getWsUrl(roomId: string, token: string): string {
  const wsBase = (BASE_URL || "").replace(/^http/, "ws");
  return `${wsBase}/api/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`;
}
