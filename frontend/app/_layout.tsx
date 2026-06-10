import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { CloudSyncProvider } from "@/src/utils/cloudSync";
import { GameProvider } from "@/src/context/GameContext";
import { CommsProvider } from "@/src/comms/CommsContext";
import { View } from "react-native";
import { pingBackend } from "@/src/api/client";

function RootShell() {
  // Subscribing to themeId here triggers a remount of the inner Stack via
  // `key={themeId}` whenever the user switches themes. Because every screen
  // imports the (now mutable) FUTURISTIC tokens, a remount cleanly applies the
  // new colors everywhere — navigation bars, cards, buttons, glows, gradients,
  // chat bubbles, popups, search, settings — globally and instantly.
  const { theme, themeId } = useTheme();

  // Wake the Render free-tier backend the moment the app launches so that by
  // the time the user reaches the login screen the server is already warm.
  useEffect(() => {
    pingBackend();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="light" backgroundColor={theme.bg} translucent={false} />
      <Stack
        key={themeId}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: "fade",
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CloudSyncProvider>
              <GameProvider>
                <CommsProvider>
                  <RootShell />
                </CommsProvider>
              </GameProvider>
            </CloudSyncProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
