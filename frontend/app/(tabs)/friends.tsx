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
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { apiGet, apiPost, API_BASE } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { useT } from "@/src/context/LanguageContext";

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
  const [tab, setTab] = useState<"friends" | "search">("friends");
  const [data, setData] = useState<FriendsData>({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<FriendsData>("/friends");
      setData(d);
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
      Alert.alert("Sent", "Friend request sent");
      await load();
      runSearch();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed");
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
    Alert.alert("Remove friend?", `Unfriend ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
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
    if (isFriend(item.id)) action = <Text style={styles.tag}>{t("friend_label")}</Text>;
    else if (isOutgoing(item.id)) action = <Text style={styles.tag}>{t("sent")}</Text>;
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("tab_friends")}</Text>
        <TouchableOpacity
          testID="open-dms"
          onPress={() => router.push("/dms")}
          style={{ marginLeft: "auto", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: COLORS.brandDim, borderWidth: 1, borderColor: COLORS.brand }}
        >
          <Ionicons name="chatbubbles" size={20} color={COLORS.brand} />
        </TouchableOpacity>
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  tabActive: { borderBottomColor: COLORS.brand },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  badge: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: "center",
  },
  badgeText: { color: COLORS.bg, fontSize: 10, fontWeight: "800" },
  section: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  avatarWrap: { position: "relative" },
  av: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceElevated,
  },
  dot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  nick: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700" },
  handle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  tag: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: COLORS.bg, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  empty: { alignItems: "center", padding: 32, marginTop: 12 },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "700",
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
