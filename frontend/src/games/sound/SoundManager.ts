// =============================================================================
// src/games/sound/SoundManager.ts — Party4R Game Sound System (crash-safe)
// =============================================================================
// نظام صوت كامل للألعاب يعمل عبر expo-audio. مصمّم بحيث:
//   • لا يتطلّب وجود ملفات الصوت الآن — لو لم يوجد ملف، يتجاهله بأمان (no-op).
//   • لا يُسقط التطبيق أبداً (كل شيء داخل try/catch + lazy require لـ expo-audio).
//   • مكان إضافة الملفات لاحقاً واضح: فعّل require المقابل في SOUND_SOURCES.
//
// كيفية الإضافة لاحقاً:
//   1) ضع الملف في assets/sounds/ (انظر README هناك).
//   2) أزل التعليق عن سطر require المقابل في SOUND_SOURCES أدناه.
//   لا تغيير آخر مطلوب — كل الأحداث مربوطة مسبقاً.
// =============================================================================

export type SoundEvent =
  | "ui_click"
  | "match_start"
  | "countdown_beep"
  | "victory"
  | "defeat"
  | "draw"
  | "rank_up"
  | "match_found"
  | "invite_sent"
  | "invite_accepted"
  | "piece_move"
  | "carrom_collision"
  | "carrom_pocket"
  | "domino_move";

// ── Sources registry ─────────────────────────────────────────────────────────
// كل الأحداث مربوطة. القيمة null = لا يوجد ملف بعد (يتم تجاهله بأمان).
// لإضافة ملف لاحقاً: استبدل null بـ require("@/assets/sounds/<file>.mp3").
const SOUND_SOURCES: Record<SoundEvent, any | null> = {
  ui_click: null,          // require("@/assets/sounds/ui_click.mp3"),
  match_start: null,       // require("@/assets/sounds/match_start.mp3"),
  countdown_beep: null,    // require("@/assets/sounds/countdown_beep.mp3"),
  victory: null,           // require("@/assets/sounds/victory.mp3"),
  defeat: null,            // require("@/assets/sounds/defeat.mp3"),
  draw: null,              // require("@/assets/sounds/draw.mp3"),
  rank_up: null,           // require("@/assets/sounds/rank_up.mp3"),
  match_found: null,       // require("@/assets/sounds/match_found.mp3"),
  invite_sent: null,       // require("@/assets/sounds/invite_sent.mp3"),
  invite_accepted: null,   // require("@/assets/sounds/invite_accepted.mp3"),
  piece_move: null,        // require("@/assets/sounds/piece_move.mp3"),
  carrom_collision: null,  // require("@/assets/sounds/carrom_collision.mp3"),
  carrom_pocket: null,     // require("@/assets/sounds/carrom_pocket.mp3"),
  domino_move: null,       // require("@/assets/sounds/domino_move.mp3"),
};

// ── Lazy expo-audio access (never throws if the module is unavailable) ───────
let _audioMod: any | undefined;
function audio(): any | null {
  if (_audioMod !== undefined) return _audioMod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _audioMod = require("expo-audio");
  } catch {
    _audioMod = null;
  }
  return _audioMod;
}

let _enabled = true;
let _volume = 1.0;
// Cache players per event so repeated SFX don't re-allocate.
const _players: Partial<Record<SoundEvent, any>> = {};

/** Globally enable/disable game SFX (e.g. from a settings toggle). */
export function setSoundEnabled(on: boolean): void { _enabled = on; }
export function isSoundEnabled(): boolean { return _enabled; }
export function setVolume(v: number): void { _volume = Math.max(0, Math.min(1, v)); }

/**
 * Play a sound for an event. Safe no-op when:
 *   • sound is disabled, or
 *   • expo-audio is unavailable, or
 *   • the file for that event hasn't been added yet.
 */
export function playSound(event: SoundEvent): void {
  if (!_enabled) return;
  const source = SOUND_SOURCES[event];
  if (!source) return; // file not added yet — ignore safely
  const mod = audio();
  if (!mod || typeof mod.createAudioPlayer !== "function") return;
  try {
    let player = _players[event];
    if (!player) {
      player = mod.createAudioPlayer(source);
      _players[event] = player;
    }
    try { player.volume = _volume; } catch { /* ignore */ }
    try { player.seekTo?.(0); } catch { /* ignore */ }
    player.play?.();
  } catch {
    // Swallow any playback error — sound must never break gameplay.
  }
}

/** Release cached players (call on unmount of a long-lived screen if desired). */
export function releaseSounds(): void {
  for (const k of Object.keys(_players) as SoundEvent[]) {
    try { _players[k]?.remove?.(); } catch { /* ignore */ }
    delete _players[k];
  }
}
