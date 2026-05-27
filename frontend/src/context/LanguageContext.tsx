// Lightweight i18n + Language context for Party4RApp.
// Two languages: English (en) + Arabic (ar). Strings cover the highest-impact UI.
// Persists language choice + flips RTL when Arabic is selected.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { I18nManager } from "react-native";
import { storage } from "@/src/utils/storage";

type Lang = "en" | "ar";
const KEY = "party_lang";

const dict: Record<Lang, Record<string, string>> = {
  en: {
    // Common
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    yes: "Yes",
    no: "No",
    close: "Close",
    loading: "Loading...",
    error: "Error",
    back: "Back",
    done: "Done",
    // Tabs
    tab_rooms: "ROOMS",
    tab_friends: "FRIENDS",
    tab_profile: "PROFILE",
    // Auth
    login: "Log in",
    signup: "Create new account",
    username: "USERNAME",
    password: "PASSWORD",
    nickname: "NICKNAME (DISPLAY NAME)",
    choose_avatar: "CHOOSE YOUR AVATAR",
    create_account: "CREATE ACCOUNT",
    watch_together: "Watch.\nTogether.",
    auth_subtitle: "Sync YouTube with friends in real-time, no streaming needed.",
    // Home
    public_rooms: "Public Rooms",
    hey: "Hey",
    hosted_by: "Hosted by",
    no_rooms: "No live rooms yet",
    be_first: "Be the first to start a watch party.",
    create_room: "CREATE ROOM",
    playing_video: "Playing video",
    waiting_for_host: "Waiting for host",
    waiting_host: "Waiting for host",
    // Create room
    new_party: "NEW PARTY",
    start_watch_party: "Start a\nwatch party.",
    room_name: "ROOM NAME",
    youtube_url_optional: "YOUTUBE URL (OPTIONAL)",
    public_room: "Public Room",
    public_room_sub: "Visible to everyone on the dashboard",
    room_password_optional: "ROOM PASSWORD (OPTIONAL)",
    create_enter: "CREATE & ENTER",
    // Room
    hosting: "HOSTING",
    watching: "WATCHING",
    live: "live",
    connecting: "connecting...",
    no_video: "No video yet",
    open_yt_hub: "Open the YouTube hub below",
    change_video: "Change Video",
    search_youtube: "Search YouTube",
    search_yt_privately: "Search YouTube privately...",
    add_to_room: "ADD TO ROOM",
    say_hi: "Say hi to the room",
    send_message: "Send a message...",
    tap_to_play: "Tap to play",
    tap_starts_session: "Starts the room session",
    tap_join_sync: "Join the sync",
    leave_confirm_title: "Leave Room?",
    leave_confirm_msg: "Are you sure you want to leave?",
    leave: "Leave",
    stay: "Stay",
    // Room controls
    settings: "Settings",
    video_volume: "Video Volume",
    video_volume_hint: "Controls the YouTube playback volume in this room.",
    muted_hint: "Muted — slide up to hear audio.",
    // Phase 4 — voting + YT browser
    browse_yt: "Browse YT",
    suggest_video: "Suggest",
    vote_skip: "Vote Skip",
    voting_policy: "Voting Policy",
    everyone_can_vote: "Anyone can vote",
    host_only_votes: "Host only",
    voting_allowed_hint: "Guests can start skip/next votes (majority wins).",
    voting_owner_only_hint: "Only you (the host) can start votes.",
    vote_in_progress: "Vote already running",
    vote_cancelled: "Vote cancelled",
    vote_skipped: "Skipped!",
    vote_next_passed: "Playing next…",
    vote_failed: "Vote did not pass",
    // Profile
    member_since: "MEMBER SINCE",
    total_hours: "TOTAL HOURS",
    bio: "BIO",
    bio_empty: "Tap edit to add a bio",
    preset_avatars: "PRESET AVATARS",
    profile_banner: "PROFILE BANNER",
    badges_label: "BADGES (TAP TO TOGGLE)",
    language: "LANGUAGE",
    log_out: "LOG OUT",
    // Friends
    my_friends: "MY FRIENDS",
    find_people: "FIND PEOPLE",
    friends_label: "FRIENDS",
    incoming_requests: "INCOMING REQUESTS",
    outgoing_requests: "OUTGOING REQUESTS",
    no_friends: "No friends yet",
    tap_find_people: 'Tap "FIND PEOPLE" to add some',
    search_users_placeholder: "Search by username or nickname...",
    add: "ADD",
    accept: "ACCEPT",
    sent: "SENT",
    friend_label: "FRIEND",
    pending: "PENDING",
    type_2_chars: "Type at least 2 characters.",
    no_match: "No users match that search.",
    online: "online",
    offline: "offline",
    wants_friend: "wants to be friends",
    no_friends_show: "No friends to show",
    // Settings page
    app_settings: "APP SETTINGS",
    settings_subtitle: "Customize your experience",
    language_section: "Language",
    language_english: "English",
    language_arabic: "العربية",
    rtl_restart_title: "Restart required",
    rtl_restart_msg:
      "Language updated. Please fully close and reopen the app to apply right-to-left layout.",
    rtl_restart_ok: "Got it",
    // Errors & misc
    err_user_pass_required: "Username and password are required",
    err_login_failed: "Login failed",
    err_signup_failed: "Signup failed",
    err_username_min: "Username must be at least 3 characters",
    err_password_min: "Password must be at least 6 characters",
    err_pick_nickname: "Pick a nickname",
    err_room_name_required: "Room name is required",
    err_room_create_failed: "Failed to create room",
    your_handle: "your-handle",
    your_unique_handle: "your-unique-handle",
    what_others_see: "What others see in rooms",
    friday_anime: "Friday Anime Night",
    yt_url_placeholder: "https://youtube.com/watch?v=...",
    keep_it_secret: "Keep it secret",
    join_party: "JOIN PARTY",
    create_identity: "Create your\nidentity.",
  },
  ar: {
    cancel: "إلغاء",
    save: "حفظ",
    edit: "تعديل",
    yes: "نعم",
    no: "لا",
    close: "إغلاق",
    loading: "جارٍ التحميل...",
    error: "خطأ",
    back: "رجوع",
    done: "تم",
    tab_rooms: "الغرف",
    tab_friends: "الأصدقاء",
    tab_profile: "الملف",
    login: "تسجيل الدخول",
    signup: "إنشاء حساب جديد",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    nickname: "الاسم الظاهر",
    choose_avatar: "اختر صورتك الرمزية",
    create_account: "إنشاء حساب",
    watch_together: "شاهد.\nمعاً.",
    auth_subtitle: "زامن يوتيوب مع أصدقائك في الوقت الفعلي، بدون بث مباشر.",
    public_rooms: "الغرف العامة",
    hey: "مرحباً",
    hosted_by: "من تنظيم",
    no_rooms: "لا توجد غرف نشطة بعد",
    be_first: "كن أول من يبدأ حفلة مشاهدة.",
    create_room: "إنشاء غرفة",
    playing_video: "يشغّل فيديو",
    waiting_for_host: "بانتظار المضيف",
    waiting_host: "بانتظار المضيف",
    new_party: "حفلة جديدة",
    start_watch_party: "ابدأ\nحفلة مشاهدة.",
    room_name: "اسم الغرفة",
    youtube_url_optional: "رابط يوتيوب (اختياري)",
    public_room: "غرفة عامة",
    public_room_sub: "ظاهرة للجميع في اللوحة",
    room_password_optional: "كلمة سر الغرفة (اختياري)",
    create_enter: "إنشاء ودخول",
    hosting: "أنت المضيف",
    watching: "تشاهد",
    live: "متصل",
    connecting: "جارٍ الاتصال...",
    no_video: "لا يوجد فيديو بعد",
    open_yt_hub: "افتح مركز يوتيوب أدناه",
    change_video: "تغيير الفيديو",
    search_youtube: "ابحث في يوتيوب",
    search_yt_privately: "ابحث في يوتيوب بشكل خاص...",
    add_to_room: "إضافة للغرفة",
    say_hi: "ألق التحية على الغرفة",
    send_message: "أرسل رسالة...",
    tap_to_play: "اضغط للتشغيل",
    tap_starts_session: "يبدأ جلسة الغرفة",
    tap_join_sync: "انضم للمزامنة",
    leave_confirm_title: "مغادرة الغرفة؟",
    leave_confirm_msg: "هل أنت متأكد أنك تريد المغادرة؟",
    leave: "غادر",
    stay: "ابقَ",
    settings: "الإعدادات",
    video_volume: "صوت الفيديو",
    video_volume_hint: "يتحكم في مستوى صوت يوتيوب في هذه الغرفة.",
    muted_hint: "مكتوم — اسحب للأعلى لسماع الصوت.",
    // Phase 4 — voting + YT browser (Arabic)
    browse_yt: "تصفح يوتيوب",
    suggest_video: "اقترح",
    vote_skip: "تصويت تخطي",
    voting_policy: "سياسة التصويت",
    everyone_can_vote: "يمكن للجميع التصويت",
    host_only_votes: "المضيف فقط",
    voting_allowed_hint: "يمكن للضيوف بدء تصويتات التخطي/التالي (الأغلبية تفوز).",
    voting_owner_only_hint: "أنت فقط (المضيف) يمكنك بدء التصويتات.",
    vote_in_progress: "هناك تصويت جارٍ بالفعل",
    vote_cancelled: "تم إلغاء التصويت",
    vote_skipped: "تم التخطي!",
    vote_next_passed: "يتم تشغيل التالي…",
    vote_failed: "لم يمر التصويت",
    member_since: "عضو منذ",
    total_hours: "إجمالي الساعات",
    bio: "النبذة",
    bio_empty: "اضغط تعديل لإضافة نبذة",
    preset_avatars: "صور رمزية جاهزة",
    profile_banner: "خلفية الملف",
    badges_label: "الشارات (انقر للتبديل)",
    language: "اللغة",
    log_out: "تسجيل الخروج",
    my_friends: "أصدقائي",
    find_people: "ابحث عن أشخاص",
    friends_label: "الأصدقاء",
    incoming_requests: "الطلبات الواردة",
    outgoing_requests: "الطلبات المرسلة",
    no_friends: "لا يوجد أصدقاء بعد",
    tap_find_people: 'اضغط "ابحث عن أشخاص" لإضافة البعض',
    search_users_placeholder: "ابحث بالاسم أو اللقب...",
    add: "إضافة",
    accept: "قبول",
    sent: "مُرسَل",
    friend_label: "صديق",
    pending: "معلّق",
    type_2_chars: "اكتب حرفين على الأقل.",
    no_match: "لا يوجد مستخدمون مطابقون.",
    online: "متصل",
    offline: "غير متصل",
    wants_friend: "يريد إضافتك صديقًا",
    no_friends_show: "لا يوجد أصدقاء لعرضهم",
    app_settings: "إعدادات التطبيق",
    settings_subtitle: "خصّص تجربتك",
    language_section: "اللغة",
    language_english: "English",
    language_arabic: "العربية",
    rtl_restart_title: "يلزم إعادة التشغيل",
    rtl_restart_msg:
      "تم تحديث اللغة. الرجاء إغلاق التطبيق وفتحه مجدداً لتفعيل الاتجاه من اليمين إلى اليسار.",
    rtl_restart_ok: "حسناً",
    err_user_pass_required: "اسم المستخدم وكلمة المرور مطلوبان",
    err_login_failed: "فشل تسجيل الدخول",
    err_signup_failed: "فشل إنشاء الحساب",
    err_username_min: "اسم المستخدم يجب أن يحتوي 3 أحرف على الأقل",
    err_password_min: "كلمة المرور يجب أن تحتوي 6 أحرف على الأقل",
    err_pick_nickname: "اختر اسماً ظاهراً",
    err_room_name_required: "اسم الغرفة مطلوب",
    err_room_create_failed: "تعذّر إنشاء الغرفة",
    your_handle: "اسم-المستخدم",
    your_unique_handle: "اسم-المستخدم-الفريد",
    what_others_see: "ما يراه الآخرون في الغرف",
    friday_anime: "ليلة أنمي الجمعة",
    yt_url_placeholder: "https://youtube.com/watch?v=...",
    keep_it_secret: "اجعلها سرّية",
    join_party: "انضم للحفلة",
    create_identity: "أنشئ\nهويتك.",
  },
};

interface LangCtx {
  lang: Lang;
  isRTL: boolean;
  t: (key: string) => string;
  setLang: (l: Lang) => Promise<{ needsRestart: boolean }>;
}

const LanguageContext = createContext<LangCtx | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [isRTL, setIsRTL] = useState<boolean>(I18nManager.isRTL);

  useEffect(() => {
    (async () => {
      const saved = (await storage.getItem(KEY, "")) as string;
      if (saved === "ar" || saved === "en") {
        setLangState(saved as Lang);
        // Try to keep RTL state in sync with stored choice (no force on load to avoid surprise reloads)
        try {
          I18nManager.allowRTL(saved === "ar");
        } catch {}
      }
    })();
  }, []);

  const setLang: LangCtx["setLang"] = async (l) => {
    await storage.setItem(KEY, l);
    setLangState(l);
    const wantsRTL = l === "ar";
    let needsRestart = false;
    try {
      I18nManager.allowRTL(wantsRTL);
      if (I18nManager.isRTL !== wantsRTL) {
        I18nManager.forceRTL(wantsRTL);
        needsRestart = true;
      }
    } catch {}
    setIsRTL(wantsRTL);
    return { needsRestart };
  };

  const t = (key: string) => dict[lang][key] || dict.en[key] || key;

  return (
    <LanguageContext.Provider value={{ lang, isRTL, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used inside LanguageProvider");
  return ctx;
}
