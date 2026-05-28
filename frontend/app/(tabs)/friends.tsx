import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost, API_BASE } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { useT } from "@/src/context/LanguageContext";
import { FUTURISTIC, GRADIENTS, TYPO } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import GlowDivider from "@/src/components/futuristic/GlowDivider";
import { LinearGradient } from "expo-linear-gradient";

interface Friend {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  avatar_image?: string | null;
  online?: boolean;
}

interface FriendsData {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
}

const TOKEN_KEY = "party_auth_token";

async function authedFetch(path: string, init?: RequestInit) {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function avatarOf(u: Friend): string {
  return u.avatar_image || getAvatarUrl(u.avatar);
}

export default function FriendsScreen() {
  const { t } = useT();
  const router = useRouter();
  const [tab, setTab] = useState<"friends" | "search">("friends");
  const [data, setData] = useState<FriendsData>({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [loading, setLoading] = useState(true);
  const [unreadDms, setUnreadDms] = useState(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<FriendsData>("/friends");
      setData(d);
    } catch {}
    try {
      const dms = await apiGet<{ conversations: { unread: number }[] }>("/dms");
      const total = (dms.conversations || []).reduce(
        (s, c) => s + (c.unread || 0),
        0
      );
      setUnreadDms(total);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await apiGet<Friend[]>(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(r);
    } catch {}
    setSearching(false);
  };

  const sendRequest = async (id: string) => {
    try {
      await authedFetch(`/friends/request/${id}`, { method: "POST" });
      Alert.alert(t("sent"), t("friend_request_sent"));
      await load();
      runSearch();
    } catch (e: any) {
      Alert.alert(t("error"), e.message || t("failed"));
    }
  };

  const acceptRequest = async (id: string) => {
    await authedFetch(`/friends/accept/${id}`, { method: "POST" });
    load();
  };

  const rejectRequest = async (id: string) => {
    await authedFetch(`/friends/reject/${id}`, { method: "POST" });
    load();
  };

  const removeFriend = (id: string, name: string) => {
    Alert.alert(t("remove_friend_q"), t("unfriend_msg", { name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: async () => {
          await authedFetch(`/friends/${id}`, { method: "DELETE" });
          load();
        },
      },
    ]);
  };

  const isFriend = (id: string) => data.friends.some((f) => f.id === id);
  const isOutgoing = (id: string) => data.outgoing.some((f) => f.id === id);
  const isIncoming = (id: string) => data.incoming.some((f) => f.id === id);

  const renderFriend = (item: Friend, mode: "friend" | "incoming" | "outgoing") => (
    <View style={styles.row} testID={`friend-row-${item.id}`}>
      <View style={styles.avatarWrap}>
        <Image source={{ uri: avatarOf(item) }} style={styles.av} />
        {mode === "friend" && (
          <View
            style={[
              styles.dot,
              { backgroundColor: item.online ? COLORS.success : COLORS.textDisabled },
            ]}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nick}>{item.nickname}</Text>
        <Text style={styles.handle}>@{item.username}</Text>
      </View>
      {mode === "friend" && (
        <TouchableOpacity
          testID={`unfriend-${item.id}`}
          onPress={() => removeFriend(item.id, item.nickname)}
          style={styles.iconAction}
        >
          <Ionicons name="close" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}
      {mode === "incoming" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            testID={`reject-${item.id}`}
            onPress={() => rejectRequest(item.id)}
            style={styles.iconAction}
          >
            <Ionicons name="close" size={18} color={COLORS.error} />
          </TouchableOpacity>
          <TouchableOpacity
            testID={`accept-${item.id}`}
            onPress={() => acceptRequest(item.id)}
            style={[styles.iconAction, { backgroundColor: COLORS.brand }]}
          >
            <Ionicons name="checkmark" size={18} color={COLORS.bg} />
          </TouchableOpacity>
        </View>
      )}
      {mode === "outgoing" && (
        <Text style={styles.pendingText}>{t("pending")}</Text>
      )}
    </View>
  );

  const renderSearchRow = (item: Friend) => {
    let action;
    if (isFriend(item.id)) action = <Text style={styles.tag}>{t("friend_caps")}</Text>;
    else if (isOutgoing(item.id)) action = <Text style={styles.tag}>{t("sent_caps")}</Text>;
    else if (isIncoming(item.id))
      action = (
        <TouchableOpacity
          testID={`accept-search-${item.id}`}
          onPress={() => acceptRequest(item.id)}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>{t("accept")}</Text>
        </TouchableOpacity>
      );
    else
      action = (
        <TouchableOpacity
          testID={`add-${item.id}`}
          onPress={() => sendRequest(item.id)}
          style={styles.addBtn}
        >
          <Ionicons name="person-add" size={14} color={COLORS.bg} />
          <Text style={styles.addBtnText}>{t("add")}</Text>
        </TouchableOpacity>
      );
    return (
      <View style={styles.row} testID={`search-row-${item.id}`}>
        <Image source={{ uri: avatarOf(item) }} style={styles.av} />
        <View style={{ flex: 1 }}>
          <Text style={styles.nick}>{item.nickname}</Text>
          <Text style={styles.handle}>@{item.username}</Text>
        </View>
        {action}
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <LinearGradient colors={GRADIENTS.appBg as unknown as string[]} style={StyleSheet.absoluteFill} />
      <LightBeam angle={-20} color={FUTURISTIC.brandSoft} speed={11000} thickness={200} intensity={0.42} />
      <LightBeam angle={18} color={FUTURISTIC.accentSoft} speed={13000} delay={2400} thickness={180} intensity={0.38} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t("kicker_social")}</Text>
          <Text style={styles.title}>{t("tab_friends").toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          testID="open-dms"
          onPress={() => router.push("/dms")}
          style={styles.dmsBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubbles" size={20} color={FUTURISTIC.brand} />
          {unreadDms > 0 && (
            <View style={styles.dmBadge}>
              <Text style={styles.dmBadgeText}>
                {unreadDms > 99 ? "99+" : unreadDms}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <GlowDivider color={FUTURISTIC.brand} speed={5400} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          testID="tab-friends"
          style={[styles.tab, tab === "friends" && styles.tabActive]}
          onPress={() => setTab("friends")}
        >
          <Text style={[styles.tabText, tab === "friends" && { color: COLORS.brand }]}>
            {t("my_friends")}
          </Text>
          {data.incoming.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{data.incoming.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-search"
          style={[styles.tab, tab === "search" && styles.tabActive]}
          onPress={() => setTab("search")}
        >
          <Text style={[styles.tabText, tab === "search" && { color: COLORS.brand }]}>
            {t("find_people")}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "friends" ? (
        loading ? (
          <ActivityIndicator color={COLORS.brand} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={[]}
            keyExtractor={() => "k"}
            renderItem={() => null}
            ListHeaderComponent={
              <>
                {data.incoming.length > 0 && (
                  <>
                    <Text style={styles.section}>{t("incoming_requests")}</Text>
                    {data.incoming.map((u) => (
                      <View key={u.id}>{renderFriend(u, "incoming")}</View>
                    ))}
                  </>
                )}
                {data.outgoing.length > 0 && (
                  <>
                    <Text style={styles.section}>{t("outgoing_requests")}</Text>
                    {data.outgoing.map((u) => (
                      <View key={u.id}>{renderFriend(u, "outgoing")}</View>
                    ))}
                  </>
                )}
                <Text style={styles.section}>
                  {t("friends_label")} · {data.friends.length}
                </Text>
                {data.friends.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="people" size={40} color={COLORS.textDisabled} />
                    <Text style={styles.emptyText}>{t("no_friends")}</Text>
                    <Text style={styles.emptySub}>{t("tap_find_people")}</Text>
                  </View>
                ) : (
                  data.friends.map((u) => (
                    <View key={u.id}>{renderFriend(u, "friend")}</View>
                  ))
                )}
              </>
            }
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          />
        )
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
            <TextInput
              testID="search-users-input"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runSearch}
              placeholder={t("search_users_placeholder")}
              placeholderTextColor={COLORS.textDisabled}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity testID="search-users-go" onPress={runSearch}>
              <Text style={styles.goText}>GO</Text>
            </TouchableOpacity>
          </View>
          {searching ? (
            <ActivityIndicator color={COLORS.brand} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => renderSearchRow(item)}
              contentContainerStyle={{ padding: 16, paddingTop: 4 }}
              ListEmptyComponent={
                <Text style={styles.searchHint}>
                  {query.length >= 2
                    ? "No users match that search."
                    : "Type at least 2 characters."}
                </Text>
              }
            />
          )}
        </View>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FUTURISTIC.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  kicker: { ...TYPO.micro, color: FUTURISTIC.textMuted },
  dmsBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: FUTURISTIC.brandSoft,
    borderWidth: 1,
    borderColor: FUTURISTIC.brandEdge,
    position: "relative",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  dmBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: FUTURISTIC.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: FUTURISTIC.bg,
    shadowColor: FUTURISTIC.error,
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  dmBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  title: {
    ...TYPO.h1,
    color: FUTURISTIC.textPrimary,
    textShadowColor: FUTURISTIC.brandSoft,
    textShadowRadius: 10,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: FUTURISTIC.brand,
  },
  tabText: {
    color: FUTURISTIC.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  badge: {
    backgroundColor: FUTURISTIC.brand,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 18,
    alignItems: "center",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  badgeText: { color: "#001A0C", fontSize: 10, fontWeight: "900" },
  section: {
    color: FUTURISTIC.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 18,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  avatarWrap: { position: "relative" },
  av: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: FUTURISTIC.surface2,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
  },
  dot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: FUTURISTIC.bg,
  },
  nick: { color: FUTURISTIC.textPrimary, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  handle: { color: FUTURISTIC.textMuted, fontSize: 12, marginTop: 2 },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: FUTURISTIC.surface2,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingText: {
    color: FUTURISTIC.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  tag: {
    color: FUTURISTIC.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: FUTURISTIC.brand,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  addBtnText: { color: "#001A0C", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  empty: { alignItems: "center", padding: 32, marginTop: 12 },
  emptyText: {
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  emptySub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 16,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  goText: {
    color: COLORS.brand,
    fontWeight: "800",
    letterSpacing: 1,
    fontSize: 13,
  },
  searchHint: {
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 24,
    fontSize: 14,
  },
});
