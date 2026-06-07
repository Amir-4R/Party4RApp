// /app/frontend/src/components/auth/GoogleSignInButton.tsx
// =============================================================================
// Party4R — Google Sign-In button.
// =============================================================================
// • Uses expo-auth-session/providers/google (works in Expo Go, standalone APK,
//   and React Native Web with a single component).
// • Detects whether the backend has Google Login configured by hitting
//   /api/auth/google/config before drawing — when disabled the button is
//   hidden so the login screen doesn't appear broken in early environments.
// • On success forwards the Google id_token to /api/auth/google/exchange and
//   persists the returned JWT through AuthContext.loginWithToken.

import React, { useEffect, useState } from "react";
import { Text, StyleSheet, ActivityIndicator, Pressable, View, Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC } from "@/src/theme/futuristic";

// Required so the in-app browser closes after the OAuth flow returns.
WebBrowser.maybeCompleteAuthSession();

interface Props {
  /** Called after a successful Google login & JWT exchange */
  onSuccess?: () => void;
  /** Called on cancel / error so the parent screen can surface a message */
  onError?: (err: Error) => void;
  /** When true, render the button in a compact "icon-only" style */
  compact?: boolean;
}

interface ServerConfig {
  enabled: boolean;
  client_id_web: string | null;
}

export default function GoogleSignInButton({ onSuccess, onError, compact }: Props) {
  const { t } = useT();
  const { loginWithToken } = useAuth();

  // ── 1) Probe backend so we don't show the button when it's disabled ─────
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    apiGet<ServerConfig>("/auth/google/config")
      .then(setConfig)
      .catch(() => setConfig({ enabled: false, client_id_web: null }));
  }, []);

  // ── 2) Spin up Google OAuth request once we know the client ID ──────────
  // We always pass the web client ID — Expo AuthSession uses it for Expo Go
  // and web; for the standalone Android APK the backend ALSO accepts the
  // Android client ID, but the frontend keeps a single canonical ID for
  // simplicity.  When you add an Android-specific client ID, swap the
  // `androidClientId` and `iosClientId` below.
  const webClientId =
    config?.client_id_web ||
    (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB as string | undefined) ||
    "";

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: webClientId || "PLACEHOLDER_NOT_CONFIGURED",
    iosClientId: webClientId || undefined,
    androidClientId: webClientId || undefined,
    webClientId: webClientId || undefined,
    scopes: ["openid", "profile", "email"],
  });

  // ── 3) When Google returns an id_token, exchange it with our backend ────
  useEffect(() => {
    (async () => {
      if (!response) return;

      if (response.type === "success") {
        const idToken =
          (response as any).params?.id_token ||
          (response as any).authentication?.idToken;

        if (!idToken) {
          onError?.(new Error("No id_token returned by Google"));
          return;
        }
        setExchanging(true);
        try {
          const data = await apiPost<{ access_token: string; user: any }>(
            "/auth/google/exchange",
            { id_token: idToken },
          );
          await loginWithToken(data.access_token, data.user);
          onSuccess?.();
        } catch (e: any) {
          onError?.(e instanceof Error ? e : new Error(String(e?.message || e)));
        } finally {
          setExchanging(false);
        }
      } else if (response.type === "error") {
        onError?.(new Error(response.error?.message || "Google sign-in failed"));
      }
      // type: "cancel" / "dismiss" → silently ignore
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // ── 4) Render ───────────────────────────────────────────────────────────
  if (!config) return null; // still probing — render nothing
  if (!config.enabled) return null; // backend disabled

  const handlePress = async () => {
    if (!request) return;
    try {
      await promptAsync();
    } catch (e: any) {
      onError?.(e instanceof Error ? e : new Error(String(e?.message || e)));
    }
  };

  const disabled = !request || exchanging;

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.compact,
          disabled && { opacity: 0.55 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
        testID="google-signin-compact"
      >
        {exchanging ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="logo-google" size={22} color="#fff" />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
      ]}
      testID="google-signin-button"
    >
      <View style={styles.iconWrap}>
        {exchanging ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="logo-google" size={20} color="#fff" />
        )}
      </View>
      <Text style={styles.label}>
        {exchanging ? t("google_signing_in") : t("google_signin")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    marginTop: 14,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  label: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  compact: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
