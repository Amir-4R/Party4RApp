// =============================================================================
// src/comms/CommsContext.tsx — Party4R Unified Comms Layer
// =============================================================================
// طبقة موحّدة للتواصل (دردشة + صوت) تُستخدم في الغرف والألعاب، ومربوطة
// بالأنظمة القائمة:
//   • الحظر: المحظور لا يستطيع مراسلتك/التحدّث معك (canCommunicateWith).
//   • الكتم المحلي (Local Mute): تكتم شخصاً من جهتك فقط — لا يُطرد ولا يتأثّر
//     سماع الآخرين له. محفوظ لكل مستخدم.
//   • خصوصية المايك: off / opponent / friends / everyone — محفوظة لكل مستخدم.
//   • حالة المايك الحالية (نشط/متوقف) لتلوين الزر.
// كل العمليات آمنة أوفلاين (تتجاهل أخطاء الشبكة) وقابلة للتوصيل بالسيرفر لاحقاً.
// =============================================================================
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { storage } from "@/src/utils/storage";
import { apiGet } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { requestMicPermission, startTransmit, stopTransmit, MicPermission } from "./VoiceManager";

export type MicMode = "off" | "opponent" | "friends" | "everyone";

interface CommsValue {
  // Local mute (per-side only)
  isLocallyMuted: (userId: string) => boolean;
  toggleLocalMute: (userId: string) => void;
  localMutedIds: string[];

  // Block awareness
  isBlocked: (userId: string) => boolean;
  canCommunicateWith: (userId: string) => boolean;
  refreshBlocked: () => Promise<void>;

  // Mic privacy mode (persisted)
  micMode: MicMode;
  setMicMode: (m: MicMode) => void;

  // Mic transmit state
  micActive: boolean;
  micPermission: MicPermission;
  startTalking: () => Promise<void>;
  stopTalking: () => Promise<void>;
  ensureMicPermission: () => Promise<MicPermission>;
}

const Ctx = createContext<CommsValue | undefined>(undefined);

const MUTE_KEY = (uid: string) => `party_local_mutes:${uid || "guest"}`;
const MIC_MODE_KEY = (uid: string) => `party_mic_mode:${uid || "guest"}`;

export function CommsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id || "guest";

  const [localMuted, setLocalMuted] = useState<Record<string, true>>({});
  const [blocked, setBlocked] = useState<Record<string, true>>({});
  const [micMode, setMicModeState] = useState<MicMode>("off");
  const [micActive, setMicActive] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>("undetermined");

  // Load persisted local mutes + mic mode when the user changes.
  useEffect(() => {
    (async () => {
      const m = (await storage.getItem(MUTE_KEY(uid), "")) as string;
      if (m) { try { setLocalMuted(JSON.parse(m)); } catch { /* ignore */ } }
      else setLocalMuted({});
      const mode = (await storage.getItem(MIC_MODE_KEY(uid), "")) as string;
      if (mode === "off" || mode === "opponent" || mode === "friends" || mode === "everyone") {
        setMicModeState(mode);
      } else setMicModeState("off");
    })();
  }, [uid]);

  const refreshBlocked = useCallback(async () => {
    try {
      const d = await apiGet<{ blocked: { id: string }[] }>("/users/blocked");
      const map: Record<string, true> = {};
      for (const b of d.blocked || []) map[b.id] = true;
      setBlocked(map);
    } catch { /* offline / not logged in — ignore */ }
  }, []);

  useEffect(() => { refreshBlocked(); }, [uid, refreshBlocked]);

  const isLocallyMuted = useCallback((id: string) => !!localMuted[id], [localMuted]);
  const toggleLocalMute = useCallback((id: string) => {
    setLocalMuted((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      storage.setItem(MUTE_KEY(uid), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [uid]);

  const isBlocked = useCallback((id: string) => !!blocked[id], [blocked]);
  const canCommunicateWith = useCallback((id: string) => !blocked[id], [blocked]);

  const setMicMode = useCallback((m: MicMode) => {
    setMicModeState(m);
    storage.setItem(MIC_MODE_KEY(uid), m).catch(() => {});
    // Switching to "off" immediately stops any active transmission.
    if (m === "off" && micActive) { setMicActive(false); stopTransmit().catch(() => {}); }
  }, [uid, micActive]);

  const ensureMicPermission = useCallback(async () => {
    const p = await requestMicPermission();
    setMicPermission(p);
    return p;
  }, []);

  const startTalking = useCallback(async () => {
    if (micMode === "off") return;            // privacy: never auto-transmit when off
    const p = await ensureMicPermission();
    if (p === "denied") return;               // caller shows a clear message
    setMicActive(true);
    await startTransmit();
  }, [micMode, ensureMicPermission]);

  const stopTalking = useCallback(async () => {
    setMicActive(false);
    await stopTransmit();
  }, []);

  return (
    <Ctx.Provider
      value={{
        isLocallyMuted, toggleLocalMute, localMutedIds: Object.keys(localMuted),
        isBlocked, canCommunicateWith, refreshBlocked,
        micMode, setMicMode,
        micActive, micPermission, startTalking, stopTalking, ensureMicPermission,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useComms(): CommsValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback so screens never crash if the provider isn't mounted.
    return {
      isLocallyMuted: () => false,
      toggleLocalMute: () => {},
      localMutedIds: [],
      isBlocked: () => false,
      canCommunicateWith: () => true,
      refreshBlocked: async () => {},
      micMode: "off",
      setMicMode: () => {},
      micActive: false,
      micPermission: "undetermined",
      startTalking: async () => {},
      stopTalking: async () => {},
      ensureMicPermission: async () => "undetermined",
    };
  }
  return ctx;
}
