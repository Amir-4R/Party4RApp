// /app/frontend/src/utils/pushNotifications.ts
// Phase 5 — Expo Push Notifications helper.
// - Asks the user for notification permission (Android 13+ and iOS).
// - Retrieves an Expo push token and POSTs it to /api/push/token.
// - Configures a global handler that SUPPRESSES alerts while the app is
//   in foreground (DMs are already live via WS).
//
// Public API:
//   await initPushNotifications()       — call once after auth.
//   await clearPushToken()              — call on logout.

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiPost, apiDelete } from "@/src/api/client";

// Set ONCE: suppress notifications while app is in foreground.
// (Per user request: foreground = no banner, just live UI update.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

let _registered = false;

export async function initPushNotifications(): Promise<string | null> {
  if (_registered) return null;
  if (!Device.isDevice) {
    // Expo Go on web / simulator doesn't issue real tokens. Skip silently.
    return null;
  }

  try {
    // Android needs an explicit channel for high-priority chat notifications.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("dms", {
        name: "Direct Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00FFA3",
        sound: "default",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    // Expo SDK 53+ requires projectId for getExpoPushTokenAsync().
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp?.data;
    if (!token) return null;

    await apiPost("/push/token", { token });
    _registered = true;
    return token;
  } catch (e) {
    // Never throw: push is purely additive. Log for debugging only.
    if (__DEV__) console.warn("[push] init failed:", e);
    return null;
  }
}

export async function clearPushToken(): Promise<void> {
  try {
    await apiDelete("/push/token");
  } catch {}
  _registered = false;
}
