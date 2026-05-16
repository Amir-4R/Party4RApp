import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";
import { apiGet, apiPost, TOKEN_KEY } from "@/src/api/client";

export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
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
