// =============================================================================
// src/comms/VoiceManager.ts — Party4R Voice (mic) manager — crash-safe
// =============================================================================
// يدير صلاحية المايك وحالة "التحدّث" محلياً. النقل الصوتي الشبكي (Real-time)
// يحتاج سيرفر/خدمة غير جاهزة الآن، لذا هذا المدير:
//   • يطلب صلاحية المايك بأمان (lazy require لـ expo-audio، لا يرمي استثناء).
//   • يدير حالة الإرسال محلياً (للون الزر الأحمر وحالة "أتحدّث الآن").
//   • يوفّر نقطة توصيل واحدة (setTransport) لإضافة النقل الصوتي لاحقاً دون
//     لمس أي واجهة.
// لا يسجّل/يكتب أي ملف صوت — مجرّد إدارة حالة + صلاحية — حتى لا يؤثر على الأداء.
// =============================================================================

export type MicPermission = "granted" | "denied" | "undetermined";

let _audioMod: any | undefined;
function audio(): any | null {
  if (_audioMod !== undefined) return _audioMod;
  try { _audioMod = require("expo-audio"); } catch { _audioMod = null; }
  return _audioMod;
}

// Optional real-time transport plug point (wired later when a voice server
// exists). Receives transmit start/stop so audio can be streamed.
export interface VoiceTransport {
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
}
let _transport: VoiceTransport | null = null;
export function setVoiceTransport(t: VoiceTransport | null): void { _transport = t; }

let _transmitting = false;
export function isTransmitting(): boolean { return _transmitting; }

/** Request microphone permission. Never throws. */
export async function requestMicPermission(): Promise<MicPermission> {
  const mod = audio();
  if (!mod) return "undetermined";
  try {
    // expo-audio exposes permission helpers either on the module or AudioModule.
    const reqFn =
      mod.requestRecordingPermissionsAsync ||
      mod.AudioModule?.requestRecordingPermissionsAsync;
    if (typeof reqFn !== "function") return "undetermined";
    const res = await reqFn.call(mod.AudioModule || mod);
    if (res?.granted || res?.status === "granted") return "granted";
    if (res?.canAskAgain === false || res?.status === "denied") return "denied";
    return "undetermined";
  } catch {
    return "undetermined";
  }
}

/** Begin transmitting (local state + optional transport). Never throws. */
export async function startTransmit(): Promise<void> {
  _transmitting = true;
  try { await _transport?.start(); } catch { /* ignore */ }
}

/** Stop transmitting. Never throws. */
export async function stopTransmit(): Promise<void> {
  _transmitting = false;
  try { await _transport?.stop(); } catch { /* ignore */ }
}
