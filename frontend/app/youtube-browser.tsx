// /app/frontend/app/youtube-browser.tsx — Phase 4 lightweight YouTube WebView
// Lets the host browse YouTube inside the app, then "Add to Room" extracts
// the video id from the current URL and returns it to the room via params.

import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { COLORS } from "@/src/constants/avatars";
import { apiPost } from "@/src/api/client";

const YT_SEARCH = (q: string) => `https://m.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const YT_HOME = "https://m.youtube.com";

export default function YouTubeBrowser() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const wvRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState(YT_HOME);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [canBack, setCanBack] = useState(false);
  const [adding, setAdding] = useState(false);

  const isVideo = /watch\?v=|\/shorts\//.test(currentUrl);

  const search = () => {
    if (!query.trim()) return;
    wvRef.current?.injectJavaScript(`window.location.href='${YT_SEARCH(query.trim())}'; true;`);
  };

  const refresh = () => wvRef.current?.reload();

  const back = () => {
    if (canBack) wvRef.current?.goBack();
    else router.back();
  };

  const addToRoom = async () => {
    if (!isVideo || adding) return;
    setAdding(true);
    try {
      // Backend extracts the video id; no API key needed
      const data = await apiPost<{ video_id: string; video_url: string; title?: string }>(
        "/youtube/extract",
        { url: currentUrl }
      );
      router.replace({
        pathname: roomId ? `/room/${roomId}` : "/(tabs)/home",
        params: { addedVideo: data.video_url, addedVideoId: data.video_id },
      });
    } catch (e: any) {
      Alert.alert("Couldn't add", e.message || "Try again with a YouTube video URL.");
    } finally { setAdding(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={back} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search YouTube..."
            placeholderTextColor={COLORS.textDisabled}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={search}
          />
        </View>
        <TouchableOpacity onPress={refresh} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* WebView */}
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <WebView
          ref={wvRef}
          source={{ uri: YT_HOME }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(s) => {
            setCurrentUrl(s.url);
            setCanBack(s.canGoBack);
          }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          style={{ flex: 1 }}
          renderError={() => (
            <View style={styles.error}>
              <Ionicons name="cloud-offline-outline" size={42} color={COLORS.error} />
              <Text style={styles.errorText}>Couldn't load YouTube</Text>
              <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        />
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.brand} />
          </View>
        )}
      </View>

      {/* Bottom action bar */}
      {roomId && (
        <View style={styles.bottomBar}>
          <Text style={styles.bottomLabel} numberOfLines={1}>
            {isVideo ? "✓ Video detected" : "Browse a video to add it"}
          </Text>
          <TouchableOpacity
            onPress={addToRoom}
            disabled={!isVideo || adding}
            style={[styles.addBtn, (!isVideo || adding) && { opacity: 0.4 }]}
          >
            {adding ? (
              <ActivityIndicator color={COLORS.bg} size="small" />
            ) : (
              <Text style={styles.addText}>ADD TO ROOM</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", padding: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 10, height: 38, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 0 },
  loader: { position: "absolute", top: 12, alignSelf: "center", backgroundColor: COLORS.surface, padding: 8, borderRadius: 99, borderWidth: 1, borderColor: COLORS.brand },
  error: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  errorText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: 15 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.brand, borderRadius: 10 },
  retryText: { color: COLORS.bg, fontWeight: "800", letterSpacing: 1 },
  bottomBar: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  bottomLabel: { flex: 1, color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  addBtn: { backgroundColor: COLORS.brand, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  addText: { color: COLORS.bg, fontWeight: "900", letterSpacing: 1, fontSize: 13 },
});
