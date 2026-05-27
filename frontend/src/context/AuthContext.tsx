import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";
import { apiGet, apiPost, TOKEN_KEY } from "@/src/api/client";
import { initPushNotifications, clearPushToken } from "@/src/utils/pushNotifications";

export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  avatar_image?: string | null;
  bio?: string | null;
  banner_id?: string | null;
  badges?: string[];
  created_at?: string;
  total_seconds?: number;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  signup: (username: string, password: string, nickname: string, avatar: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await storage.secureGet<string>(TOKEN_KEY, "");
      if (saved) {
        setToken(saved);
        try {
          const me = await apiGet<User>("/auth/me");
          setUser(me);
          // Phase 5 — re-register push (token may have rotated since last open).
          initPushNotifications().catch(() => {});
        } catch {
          await storage.secureRemove(TOKEN_KEY);
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (t: string, u: User) => {
    await storage.secureSet(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    // Phase 5 — register for Expo push (DMs only). Fires-and-forgets.
    initPushNotifications().catch(() => {});
  };

  const signup: AuthContextValue["signup"] = async (username, password, nickname, avatar) => {
    const res = await apiPost<{ access_token: string; user: User }>("/auth/signup", {
      username,
      password,
      nickname,
      avatar,
    });
    await persist(res.access_token, res.user);
  };

  const login: AuthContextValue["login"] = async (username, password) => {
    const res = await apiPost<{ access_token: string; user: User }>("/auth/login", {
      username,
      password,
    });
    await persist(res.access_token, res.user);
  };

  const logout = async () => {
    // Phase 5 — best-effort token clear before token is wiped locally.
    await clearPushToken();
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    try {
      const me = await apiGet<User>("/auth/me");
      setUser(me);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
