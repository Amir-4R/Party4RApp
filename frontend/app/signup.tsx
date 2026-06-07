import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { AVATARS, COLORS } from "@/src/constants/avatars";
import { useT } from "@/src/context/LanguageContext";
import GoogleSignInButton from "@/src/components/auth/GoogleSignInButton";

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0].id);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");
    if (!username.trim() || username.trim().length < 3) {
      setError(t("err_username_min"));
      return;
    }
    if (password.length < 6) {
      setError(t("err_password_min"));
      return;
    }
    if (!nickname.trim()) {
      setError(t("err_pick_nickname"));
      return;
    }
    setLoading(true);
    try {
      await signup(username.trim(), password, nickname.trim(), avatar);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message || t("err_signup_failed"));
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
            testID="signup-back"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.brandTag}>{t("join_party")}</Text>
          <Text style={styles.title}>{t("create_identity")}</Text>

          <Text style={[styles.label, { marginTop: 32 }]}>{t("username")}</Text>
          <TextInput
            testID="signup-username-input"
            value={username}
            onChangeText={setUsername}
            placeholder={t("your_unique_handle")}
            placeholderTextColor={COLORS.textDisabled}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>{t("password")}</Text>
          <TextInput
            testID="signup-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textDisabled}
            style={styles.input}
            secureTextEntry
          />

          <Text style={styles.label}>{t("nickname")}</Text>
          <TextInput
            testID="signup-nickname-input"
            value={nickname}
            onChangeText={setNickname}
            placeholder={t("what_others_see")}
            placeholderTextColor={COLORS.textDisabled}
            style={styles.input}
          />

          <Text style={styles.label}>{t("choose_avatar")}</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((a) => (
              <TouchableOpacity
                key={a.id}
                testID={`avatar-select-${a.id}`}
                onPress={() => setAvatar(a.id)}
                style={[
                  styles.avatarTile,
                  avatar === a.id && styles.avatarTileActive,
                ]}
              >
                <Image source={{ uri: a.url }} style={styles.avatarImg} />
              </TouchableOpacity>
            ))}
          </View>

          {error ? (
            <Text style={styles.error} testID="signup-error">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            testID="signup-submit-button"
            onPress={handleSignup}
            disabled={loading}
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>{t("create_account")}</Text>
            )}
          </TouchableOpacity>

          <GoogleSignInButton
            onSuccess={() => router.replace("/(tabs)/home")}
            onError={(e) => setError(e.message || t("err_login_failed"))}
          />
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
    marginTop: 18,
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
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  avatarTile: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  avatarTileActive: {
    borderColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 12 },
  error: { color: COLORS.error, marginTop: 16, fontSize: 14 },
  primaryBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  primaryBtnText: { color: COLORS.bg, fontWeight: "800", fontSize: 16, letterSpacing: 1 },
});
