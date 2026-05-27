// /app/frontend/app/search.tsx
// =============================================================================
// PARTY4R — Room Search (Phase 7)
// =============================================================================
//
// Dedicated discovery screen for public rooms.
//
// Features:
//   • Real-time fuzzy room search (subsequence + substring scoring).
//   • Smart suggestions as the user types (auto-debounced).
//   • Trending list (top public rooms by member count, when search is empty).
//   • Recent searches history (AsyncStorage, max 8 entries).
//   • Recommended rooms when the search returns 0 exact matches (looser fuzzy).
//   • Smooth fade-in animations on result list refresh.
//   • Futuristic glass search bar with neon focus glow.
//   • Premium MetallicCard rooms and chrome history pills.
//
// Performance:
//   • Pure client-side filtering — no backend search index needed.
//   • Debounce 90ms keeps typing snappy while preventing churn.
//   • FlashList not used to avoid extra dependency; FlatList with extractor.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Pressable,
  Platform,
  Keyboard,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/src/api/client";
import { getAvatarUrl } from "@/src/constants/avatars";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import MetallicCard from "@/src/components/futuristic/MetallicCard";
import GlowDivider from "@/src/components/futuristic/GlowDivider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useT } from "@/src/context/LanguageContext";

interface Room {
  id: string;
  name: string;
  host_id: string;
  host_nickname: string;
  host_avatar: string;
  is_public: boolean;
  has_password: boolean;
  video_url?: string | null;
  member_count: number;
  created_at: string;
}

const HISTORY_KEY = "p4r:search_history";
const MAX_HISTORY = 8;

// ============================================================================
// Fuzzy matching helper
// ============================================================================
// Returns a score 0..1 where higher = better. 0 means no match.
// Strategy:
//   • Exact match → 1.0
//   • Substring (case-insensitive) → 0.7..0.95 depending on position
//   • Subsequence match (all query chars in order) → 0.3..0.6
//   • No match → 0
function fuzzyScore(needle: string, haystack: string): number {
  if (!needle) return 1;
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase();
  if (!n) return 1;
  if (h === n) return 1;
  // Substring
  const idx = h.indexOf(n);
  if (idx === 0) return 0.95;       // starts with → high
  if (idx > 0) return 0.85 - Math.min(0.2, idx / 60);
  // Subsequence
  let hi = 0;
  let hits = 0;
  for (let i = 0; i < n.length; i++) {
    while (hi < h.length && h[hi] !== n[i]) hi++;
    if (hi >= h.length) return 0;
    hits++;
    hi++;
  }
  if (hits === n.length) {
    // All chars matched in order
    return 0.30 + 0.30 * (n.length / h.length);
  }
  return 0;
}

// ============================================================================
// PulseRing — single animated ring around the search icon when focused
// ============================================================================
function PulseRing({ active }: { active: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (active) {
      v.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    } else {
      v.value = withTiming(0, { duration: 200 });
    }
  }, [v, active]);
  const s = useAnimatedStyle(() => ({
    opacity: 1 - v.value,
    transform: [{ scale: 0.6 + v.value * 0.6 }],
  }));
  if (!active) return null;
  return <Animated.View pointerEvents="none" style={[styles.searchPulseRing, s]} />;
}

// ============================================================================
// Main screen
// ============================================================================
export default function SearchScreen() {
  const router = useRouter();
  const { t } = useT();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // ---- Load public rooms + history on mount ----
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Room[]>("/rooms/public");
        setAllRooms(data);
      } catch {} finally {
        setLoading(false);
      }
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (raw) setHistory(JSON.parse(raw));
      } catch {}
    })();
    // Auto-focus the search bar after mount
    setTimeout(() => inputRef.current?.focus(), 250);
  }, []);

  // ---- Debounce input (90ms) ----
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 90);
    return () => clearTimeout(id);
  }, [query]);

  // ---- Persist history ----
  const persistQuery = useCallback(async (q: string) => {
    if (!q || q.length < 2) return;
    setHistory((prev) => {
      const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearHistory = async () => {
    setHistory([]);
    try { await AsyncStorage.removeItem(HISTORY_KEY); } catch {}
  };

  // ---- Derived results ----
  const results = useMemo(() => {
    if (!debouncedQuery) return [];
    const scored = allRooms
      .map((r) => ({ r, s: fuzzyScore(debouncedQuery, r.name) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.r.member_count - a.r.member_count);
    return scored.map((x) => x.r);
  }, [debouncedQuery, allRooms]);

  const trending = useMemo(
    () => [...allRooms].sort((a, b) => b.member_count - a.member_count).slice(0, 8),
    [allRooms]
  );

  // ---- Recommended (loosely related when exact results are sparse) ----
  const recommended = useMemo(() => {
    if (!debouncedQuery || results.length >= 5) return [];
    const words = debouncedQuery.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
    if (words.length === 0) return [];
    const seen = new Set(results.map((r) => r.id));
    return allRooms
      .filter((r) => !seen.has(r.id))
      .map((r) => {
        const lname = r.name.toLowerCase();
        let s = 0;
        for (const w of words) if (lname.includes(w[0])) s += 0.1;
        for (const w of words) if (lname.includes(w.slice(0, 2))) s += 0.3;
        return { r, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.r);
  }, [debouncedQuery, results, allRooms]);

  const onSubmit = () => {
    if (debouncedQuery.length >= 2) {
      persistQuery(debouncedQuery);
    }
    Keyboard.dismiss();
  };

  const openRoom = (r: Room) => {
    persistQuery(debouncedQuery || r.name);
    router.push(`/room/${r.id}` as any);
  };

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <View style={styles.bg}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-20} color="rgba(34,255,136,0.10)" speed={11000} thickness={200} intensity={0.40} />
      <LightBeam angle={18} color="rgba(168,85,247,0.09)" speed={13000} delay={2400} thickness={180} intensity={0.36} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={FUTURISTIC.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{t("kicker_discover")}</Text>
            <Text style={styles.title}>{t("search_rooms_title").toUpperCase()}</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchBarOuter}>
          <View
            style={[
              styles.searchBarEdge,
              focused && {
                shadowColor: FUTURISTIC.brand,
                shadowOpacity: 0.7,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            <LinearGradient
              colors={
                focused
                  ? ["rgba(255,255,255,0.55)", "rgba(34,255,136,0.55)", "rgba(168,85,247,0.45)"]
                  : ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.05)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, padding: 1 }}
            >
              <View style={styles.searchBarInner}>
                <View style={styles.searchIconWrap}>
                  <PulseRing active={focused} />
                  <Ionicons
                    name="search"
                    size={18}
                    color={focused ? FUTURISTIC.brand : FUTURISTIC.textMuted}
                  />
                </View>
                <TextInput
                  ref={inputRef}
                  testID="search-input"
                  value={query}
                  onChangeText={setQuery}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onSubmitEditing={onSubmit}
                  placeholder={t("search_rooms_placeholder") || "Search by room name…"}
                  placeholderTextColor={FUTURISTIC.textDisabled}
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")} style={styles.clearBtn} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={20} color={FUTURISTIC.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 2, marginTop: 2 }}>
          <GlowDivider color={FUTURISTIC.brand} speed={5400} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={FUTURISTIC.brand} />
            <Text style={styles.loadingText}>{t("syncing_rooms")}</Text>
          </View>
        ) : debouncedQuery ? (
          // ---------------- Search results ----------------
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            ListHeaderComponent={
              <View style={styles.resultHeader}>
                <Text style={styles.resultCount}>
                  {results.length} {results.length === 1 ? t("match_one") : t("match_many")}
                </Text>
                <Text style={styles.queryEcho} numberOfLines={1}>
                  {t("for_query")} "{debouncedQuery}"
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyRing}>
                  <Ionicons name="search-outline" size={36} color={FUTURISTIC.brand} />
                </View>
                <Text style={styles.emptyTitle}>{t("no_exact_matches")}</Text>
                <Text style={styles.emptySub}>{t("try_shorter_query")}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <RoomRow room={item} onPress={openRoom} highlightQuery={debouncedQuery} />
            )}
            ListFooterComponent={
              recommended.length > 0 ? (
                <View style={{ marginTop: 24 }}>
                  <SectionHead label={t("recommended_for_you")} icon="sparkles" />
                  {recommended.map((r) => (
                    <RoomRow key={r.id} room={r} onPress={openRoom} highlightQuery={debouncedQuery} />
                  ))}
                </View>
              ) : null
            }
          />
        ) : (
          // ---------------- Default view (history + trending) ----------------
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            {history.length > 0 && (
              <View style={{ marginBottom: 18 }}>
                <View style={styles.sectionHead}>
                  <Ionicons name="time-outline" size={14} color={FUTURISTIC.textMuted} />
                  <Text style={styles.sectionHeadLabel}>{t("recent")}</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={clearHistory} activeOpacity={0.7}>
                    <Text style={styles.clearLink}>{t("clear")}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pillsWrap}>
                  {history.map((q, i) => (
                    <TouchableOpacity
                      key={`${q}-${i}`}
                      onPress={() => { setQuery(q); inputRef.current?.focus(); }}
                      style={styles.historyPill}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="reload-outline" size={12} color={FUTURISTIC.textSecondary} />
                      <Text style={styles.historyPillText} numberOfLines={1}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {trending.length > 0 ? (
              <>
                <SectionHead label={t("trending_now")} icon="flame" />
                {trending.map((r) => (
                  <RoomRow key={r.id} room={r} onPress={openRoom} />
                ))}
              </>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyRing}>
                  <Ionicons name="globe-outline" size={36} color={FUTURISTIC.brand} />
                </View>
                <Text style={styles.emptyTitle}>{t("no_public_rooms_yet")}</Text>
                <Text style={styles.emptySub}>{t("be_first_host")}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// ============================================================================
// SectionHead — caps label with icon
// ============================================================================
function SectionHead({ label, icon }: { label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={14} color={FUTURISTIC.brand} />
      <Text style={[styles.sectionHeadLabel, { color: FUTURISTIC.brand }]}>{label}</Text>
    </View>
  );
}

// ============================================================================
// RoomRow — single result card. Highlights the matched substring in the name.
// ============================================================================
function RoomRow({ room, onPress, highlightQuery }: { room: Room; onPress: (r: Room) => void; highlightQuery?: string }) {
  const { t } = useT();
  const active = room.member_count > 0;
  return (
    <TouchableOpacity onPress={() => onPress(room)} activeOpacity={0.85} style={{ marginBottom: 10 }}>
      <MetallicCard accent={active ? "green" : "neutral"} padding={12} radius={FUTURISTIC.radius.md}>
        <View style={styles.row}>
          <LinearGradient
            colors={
              active
                ? ["rgba(34,255,136,0.85)", "rgba(168,85,247,0.45)"]
                : ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <Image source={{ uri: getAvatarUrl(room.host_avatar) }} style={styles.avatar} />
          </LinearGradient>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <HighlightedText
              text={room.name}
              query={highlightQuery}
              style={styles.name}
              numberOfLines={1}
            />
            <Text style={styles.host} numberOfLines={1}>
              {t("by_label")} {room.host_nickname}
            </Text>
          </View>

          <View style={[styles.memberPill, active && styles.memberPillActive]}>
            <Ionicons
              name="people"
              size={12}
              color={active ? FUTURISTIC.brand : FUTURISTIC.textMuted}
            />
            <Text style={[styles.memberText, active && { color: FUTURISTIC.brand }]}>
              {room.member_count}
            </Text>
          </View>
          {room.has_password && (
            <Ionicons name="lock-closed" size={13} color={FUTURISTIC.textMuted} style={{ marginLeft: 6 }} />
          )}
          <Ionicons
            name="chevron-forward"
            size={16}
            color={FUTURISTIC.textMuted}
            style={{ marginLeft: 4 }}
          />
        </View>
      </MetallicCard>
    </TouchableOpacity>
  );
}

// ============================================================================
// HighlightedText — bolds + colors the matched portion of a name.
// ============================================================================
function HighlightedText({
  text,
  query,
  style,
  numberOfLines,
}: {
  text: string;
  query?: string;
  style?: any;
  numberOfLines?: number;
}) {
  if (!query) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {before}
      <Text style={{ color: FUTURISTIC.brand, fontWeight: "900" }}>{match}</Text>
      {after}
    </Text>
  );
}

// ============================================================================
// Styles
// ============================================================================
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: FUTURISTIC.bg },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
  },
  kicker: { ...TYPO.micro, color: FUTURISTIC.textMuted },
  title: {
    ...TYPO.h1,
    color: FUTURISTIC.textPrimary,
    textShadowColor: "rgba(34,255,136,0.30)",
    textShadowRadius: 10,
  },
  // Search bar
  searchBarOuter: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  searchBarEdge: { borderRadius: 16 },
  searchBarInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FUTURISTIC.surface1,
    borderRadius: 15,
    paddingHorizontal: 4,
    height: 52,
  },
  searchIconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  searchPulseRing: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: FUTURISTIC.brand,
  },
  searchInput: {
    flex: 1,
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    paddingHorizontal: 6,
    letterSpacing: 0.3,
  },
  clearBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  // Loading
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { ...TYPO.caption, color: FUTURISTIC.textMuted },
  // Results header
  resultHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
  resultCount: { color: FUTURISTIC.brand, fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  queryEcho: { color: FUTURISTIC.textMuted, fontSize: 12, flex: 1, fontStyle: "italic" },
  // Section heads
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionHeadLabel: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1.8 },
  clearLink: { color: FUTURISTIC.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  // History pills
  pillsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
  },
  historyPillText: { color: FUTURISTIC.textSecondary, fontSize: 12, fontWeight: "700", maxWidth: 140 },
  // Room rows
  row: { flexDirection: "row", alignItems: "center" },
  avatarRing: { width: 48, height: 48, borderRadius: 14, padding: 2 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: FUTURISTIC.surface2 },
  name: { color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  host: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 2, letterSpacing: 0.2 },
  memberPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: FUTURISTIC.surface2,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
  },
  memberPillActive: {
    backgroundColor: FUTURISTIC.brandSoft,
    borderColor: FUTURISTIC.brandEdge,
  },
  memberText: { color: FUTURISTIC.textMuted, fontSize: 11, fontWeight: "900" },
  // Empty state
  empty: { alignItems: "center", padding: 40 },
  emptyRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: FUTURISTIC.surface1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyTitle: {
    color: FUTURISTIC.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 18,
    letterSpacing: 0.5,
  },
  emptySub: {
    color: FUTURISTIC.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 280,
  },
});
