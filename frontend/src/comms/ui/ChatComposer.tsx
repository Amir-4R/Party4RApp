// =============================================================================
// src/comms/ui/ChatComposer.tsx — Universal, keyboard-safe chat input
// =============================================================================
// مدخل الدردشة الموحَّد عبر جميع المنصّات والأجهزة:
//   • مبني داخل React.memo لئلّا يُعاد render مع كل رسالة جديدة تصل من WS
//     (السبب الأساسي لفقدان الـ focus على Samsung/Xiaomi/Pixel و Android 12-16).
//   • TextInput مُتحكَّم به محلياً عبر useState داخل المكوّن — الأب يُمرِّر
//     onSend فقط؛ لا يحتاج أن يعرف بكل ضربة مفتاح.
//   • blurOnSubmit={false} + auto-refocus بعد الإرسال (مدعوم على iOS/Android/web).
//   • dir="auto" + textAlign auto → عربي/إنكليزي يعملان بدون أي تخصيص.
//   • forwardRef لتمرير ref للأب عند الحاجة (مثل الإغلاق التلقائي عند leaving).
// =============================================================================

import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleProp,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";

export interface ChatComposerHandle {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  getValue: () => string;
}

export interface ChatComposerProps {
  // Send handler — receives the trimmed text. Should return true (or void) on
  // success so the composer can clear & refocus, or false to keep the draft.
  onSend: (text: string) => boolean | void | Promise<boolean | void>;
  // Optional secondary action — e.g. image attach.
  onAttach?: () => void;
  placeholder?: string;
  // Allow tab-style multiline (e.g. in-game chat) — defaults to single-line.
  multiline?: boolean;
  // Locks the input while a send is in-flight (used by DM overlay).
  disabled?: boolean;
  // Style overrides for the outer container — keep mins/horizontal padding etc.
  containerStyle?: StyleProp<ViewStyle>;
  // Optional testIDs for automated tests.
  testIDInput?: string;
  testIDSend?: string;
  testIDAttach?: string;
}

/**
 * Universal ChatComposer — memoized so it survives unrelated parent re-renders
 * (e.g. new WebSocket messages, presence updates, etc.) without losing focus.
 */
const ChatComposerInner = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposerInner(
    {
      onSend,
      onAttach,
      placeholder,
      multiline = false,
      disabled = false,
      containerStyle,
      testIDInput = "chat-input",
      testIDSend = "chat-send",
      testIDAttach = "chat-attach",
    },
    ref,
  ) {
    const [draft, setDraft] = useState("");
    const inputRef = useRef<TextInput>(null);
    const sendingRef = useRef(false);

    // Expose the imperative API to parents.
    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => setDraft(""),
        getValue: () => draft,
      }),
      [draft],
    );

    const handleSend = useCallback(async () => {
      const text = draft.trim();
      if (!text || sendingRef.current || disabled) return;
      sendingRef.current = true;
      try {
        const result = await Promise.resolve(onSend(text));
        // Default behavior: clear & refocus unless the parent explicitly
        // returned `false` (e.g. validation failure).
        if (result !== false) {
          setDraft("");
          // requestAnimationFrame fires AFTER React commits the empty draft,
          // ensuring focus restoration lands on a freshly-rendered input.
          // This is the cross-platform fix for the iOS/Android Enter-blurs-input
          // issue, including react-native-web where `blurOnSubmit={false}` is
          // ignored.
          requestAnimationFrame(() => {
            try {
              inputRef.current?.focus();
            } catch {}
          });
        }
      } finally {
        sendingRef.current = false;
      }
    }, [draft, onSend, disabled]);

    const canSend = draft.trim().length > 0 && !disabled;

    return (
      <View style={[styles.composer, containerStyle]}>
        {onAttach ? (
          <TouchableOpacity
            testID={testIDAttach}
            onPress={onAttach}
            style={styles.attachBtn}
            activeOpacity={0.7}
            disabled={disabled}
          >
            <Ionicons name="image-outline" size={20} color={FUTURISTIC.brand} />
          </TouchableOpacity>
        ) : null}
        <TextInput
          ref={inputRef}
          testID={testIDInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={FUTURISTIC.textMuted}
          style={[styles.input, multiline && styles.inputMultiline]}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          // Critical for keeping the keyboard open across consecutive sends
          // on iOS. (No-op on Android & web, but consistent.)
          blurOnSubmit={false}
          // Single-line by default so Enter triggers onSubmitEditing instead
          // of inserting a newline.
          multiline={multiline}
          // Avoid intrusive auto-correct popups stealing taps on Android.
          autoCorrect={false}
          autoCapitalize="sentences"
          // Tells the platform to switch language/direction automatically per
          // the typed character — works for Arabic/English mixed input on
          // iOS, Android (API 26+), and react-native-web.
          textAlign={Platform.OS === "web" ? undefined : "right"}
          // @ts-ignore — RN-Web exposes `dir`; ignored elsewhere.
          dir="auto"
          // Ensures the input never gets unmounted on focus changes — critical
          // for Android Samsung devices where focus loss is fatal.
          editable={!disabled}
          underlineColorAndroid="transparent"
        />
        <TouchableOpacity
          testID={testIDSend}
          onPress={handleSend}
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color={FUTURISTIC.bg} />
        </TouchableOpacity>
      </View>
    );
  },
);

/**
 * Equality check — re-render only when public-facing props change. The
 * controlled `draft` lives INSIDE the composer so the parent doesn't trigger
 * a render on every keystroke.
 */
const ChatComposer = memo(ChatComposerInner, (prev, next) => {
  return (
    prev.onSend === next.onSend &&
    prev.onAttach === next.onAttach &&
    prev.placeholder === next.placeholder &&
    prev.multiline === next.multiline &&
    prev.disabled === next.disabled &&
    prev.containerStyle === next.containerStyle
  );
});

export default ChatComposer;

// ===========================================================================
const styles = StyleSheet.create({
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: FUTURISTIC.borderSoft,
    backgroundColor: "rgba(8, 9, 18, 0.95)",
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
    minHeight: 44,
    // Ensure the touch target is ≥44px (iOS HIG) — even when the input is
    // empty, it stays easy to tap on small phones.
    maxHeight: 120,
  },
  inputMultiline: {
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: "top",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FUTURISTIC.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  sendBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
});
