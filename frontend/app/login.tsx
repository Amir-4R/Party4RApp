import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, LOGIN_BG_URL } from "@/src/constants/avatars";
import { useT } from "@/src/context/LanguageContext";
import GoogleSignInButton from "@/src/components/auth/GoogleSignInButton";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!username.trim() || !password) {
      setError(t("err_user_pass_required"));
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message || t("err_login_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={{ uri: LOGIN_BG_URL }} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.brandTag}>PARTY4R</Text>
              <Text style={styles.title}>{t("watch_together")}</Text>
              <Text style={styles.subtitle}>{t("auth_subtitle")}</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>{t("username")}</Text>
              <TextInput
                testID="login-username-input"
                value={username}
                onChangeText={setUsername}
                placeholder={t("your_handle")}
                placeholderTextColor={COLORS.textDisabled}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.label, { marginTop: 16 }]}>{t("password")}</Text>
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textDisabled}
                style={styles.input}
                secureTextEntry
              />
              {error ? (
                <Text style={styles.error} testID="login-error">
                  {error}
                </Text>
              ) : null}
              <TouchableOpacity
                testID="login-submit-button"
                onPress={handleLogin}
                disabled={loading}
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.bg} />
                ) : (
                  <Text style={styles.primaryBtnText}>{t("login").toUpperCase()}</Text>
                )}
              </TouchableOpacity>
              <Link href="/signup" asChild>
                <TouchableOpacity testID="login-go-signup" style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>{t("signup")}</Text>
                </TouchableOpacity>
              </Link>

              <GoogleSignInButton
                onSuccess={() => router.replace("/(tabs)/home")}
                onError={(e) => setError(e.message || t("err_login_failed"))}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,11,15,0.55)" },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "space-between", padding: 24, paddingTop: 40 },
  header: { marginBottom: 32 },
  brandTag: {
    color: COLORS.brand,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: 12,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
    lineHeight: 50,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
    maxWidth: "85%",
  },
  form: { paddingBottom: 16 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
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
  error: { color: COLORS.error, marginTop: 12, fontSize: 14 },
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
  secondaryBtn: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryBtnText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
});
