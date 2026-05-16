import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { apiGet } from "@/src/api/client";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";

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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<Room[]>("/rooms/public");
      setRooms(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderRoom = ({ item }: { item: Room }) => (
    <TouchableOpacity
      testID={`room-card-${item.id}`}
      onPress={() => router.push(`/room/${item.id}` as any)}
      style={[styles.roomCard, item.member_count > 0 && styles.roomCardActive]}
      activeOpacity={0.8}
    >
      <View style={styles.roomHeader}>
        <Image source={{ uri: getAvatarUrl(item.host_avatar) }} style={styles.hostAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.roomName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.roomHost}>Hosted by {item.host_nickname}</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, item.member_count > 0 && { backgroundColor: COLORS.brand }]} />
          <Text style={styles.liveText}>{item.member_count}</Text>
        </View>
      </View>
      <View style={styles.roomFooter}>
        <Ionicons
          name={item.video_url ? "play-circle" : "tv-outline"}
          size={16}
          color={item.video_url ? COLORS.brand : COLORS.textSecondary}
        />
        <Text style={styles.roomMeta} numberOfLines={1}>
          {item.video_url ? "Playing video" : "Waiting for host"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey {user?.nickname}</Text>
          <Text style={styles.title}>Public Rooms</Text>
        </View>
        <TouchableOpacity
          testID="create-room-fab"
          onPress={() => router.push("/create-room")}
          style={styles.fab}
        >
          <Ionicons name="add" size={24} color={COLORS.bg} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.brand} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          renderItem={renderRoom}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.brand}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="empty-rooms-state">
              <Ionicons name="tv-outline" size={48} color={COLORS.textDisabled} />
              <Text style={styles.emptyTitle}>No live rooms yet</Text>
              <Text style={styles.emptySub}>Be the first to start a watch party.</Text>
              <TouchableOpacity
                testID="empty-create-btn"
                onPress={() => router.push("/create-room")}
                style={styles.emptyBtn}
              >
                <Text style={styles.emptyBtnText}>CREATE ROOM</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  title: { color: COLORS.textPrimary, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  roomCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  roomCardActive: {
    borderColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  roomHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceElevated,
  },
  roomName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "700" },
  roomHost: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textDisabled },
  liveText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "700" },
  roomFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  roomMeta: { color: COLORS.textSecondary, fontSize: 12 },
  empty: { alignItems: "center", padding: 48, marginTop: 24 },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6, textAlign: "center" },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnText: { color: COLORS.bg, fontWeight: "800", letterSpacing: 1 },
});
