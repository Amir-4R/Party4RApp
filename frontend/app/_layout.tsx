import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/context/LanguageContext";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { View } from "react-native";

function RootShell() {
  // Subscribing to themeId here triggers a remount of the inner Stack via
  // `key={themeId}` whenever the user switches themes. Because every screen
  // imports the (now mutable) FUTURISTIC tokens, a remount cleanly applies the
  // new colors everywhere — navigation bars, cards, buttons, glows, gradients,
  // chat bubbles, popups, search, settings — globally and instantly.
  const { theme, themeId } = useTheme();
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
            <RootShell />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
