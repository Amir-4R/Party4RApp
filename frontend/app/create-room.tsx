import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "@/src/api/client";
import { COLORS } from "@/src/constants/avatars";
import { useT } from "@/src/context/LanguageContext";

export default function CreateRoomScreen() {
  const router = useRouter();
  const { t } = useT();
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) {
      setError(t("err_room_name_required"));
      return;
    }
    setLoading(true);
    try {
      const room = await apiPost<{ id: string }>("/rooms", {
        name: name.trim(),
        is_public: isPublic,
        password: !isPublic && password ? password : null,
        video_url: videoUrl.trim() || null,
      });
      router.replace(`/room/${room.id}` as any);
    } catch (e: any) {
      setError(e.message || t("err_room_create_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            testID="create-room-back"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Ionicons name="close" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.brandTag}>{t("new_party")}</Text>
          <Text style={styles.title}>{t("start_watch_party")}</Text>

          <Text style={[styles.label, { marginTop: 32 }]}>{t("room_name")}</Text>
          <TextInput
            testID="room-name-input"
            value={name}
            onChangeText={setName}
            placeholder={t("friday_anime")}
            placeholderTextColor={COLORS.textDisabled}
            style={styles.input}
          />

          <Text style={styles.label}>{t("youtube_url_optional")}</Text>
          <TextInput
            testID="room-video-input"
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder={t("yt_url_placeholder")}
            placeholderTextColor={COLORS.textDisabled}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t("public_room")}</Text>
              <Text style={styles.toggleSub}>{t("public_room_sub")}</Text>
            </View>
            <Switch
              testID="room-public-toggle"
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: COLORS.border, true: COLORS.brandDim }}
              thumbColor={isPublic ? COLORS.brand : COLORS.textSecondary}
            />
          </View>

          {!isPublic && (
            <>
              <Text style={styles.label}>{t("room_password_optional")}</Text>
              <TextInput
                testID="room-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder={t("keep_it_secret")}
                placeholderTextColor={COLORS.textDisabled}
                style={styles.input}
                secureTextEntry
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="create-room-submit"
            onPress={handleCreate}
            disabled={loading}
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>{t("create_enter")}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, paddingTop: 8 },
  back: { width: 40, height: 40, justifyContent: "center", marginBottom: 16 },
  brandTag: {
    color: COLORS.brand,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 42,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  toggleTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700" },
  toggleSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  error: { color: COLORS.error, marginTop: 16, fontSize: 14 },
  primaryBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  primaryBtnText: { color: COLORS.bg, fontWeight: "800", fontSize: 16, letterSpacing: 1 },
});
