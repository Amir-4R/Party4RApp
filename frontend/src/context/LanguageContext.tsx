// /app/frontend/src/context/LanguageContext.tsx
// =============================================================================
// PARTY4R — i18n + RTL + Cairo font (Phase 7 full localization)
// =============================================================================
//
// Provides:
//   • `t(key)` for UI strings (English + Arabic).
//   • `tErr(rawError)` for mapping backend HTTPException detail strings into
//     localized strings (Arabic only — English passes through).
//   • `nf(n)` number formatter (kept as Western numerals per product spec).
//   • Persisted language choice across launches.
//   • RTL handling via `I18nManager` — applies forceRTL on language change
//     and signals callers that a JS reload is required for layout flip.
//   • Cairo font is loaded once on startup via expo-font + the
//     `@expo-google-fonts/cairo` package. When `ar` is active, the font is
//     applied globally as the default Text fontFamily.
//
// Notes:
//   • Western numerals (1, 2, 3) are kept by spec — `nf()` is an identity
//     hook reserved for future "Arabic-Indic numerals" toggle.
//   • Error mapping is deliberately conservative: unknown errors fall back to
//     the raw text so we never hide a developer message.

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { I18nManager, Text } from "react-native";
import {
  useFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from "@expo-google-fonts/cairo";
import { storage } from "@/src/utils/storage";

type Lang = "en" | "ar";
const KEY = "party_lang";

// =============================================================================
// Dictionary
// =============================================================================
const dict: Record<Lang, Record<string, string>> = {
  en: {
    // ---- Common ----
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    yes: "Yes",
    no: "No",
    close: "Close",
    loading: "Loading...",
    error: "Error",
    back: "Back",
    done: "Done",
    ok: "OK",
    retry: "Retry",
    open_settings: "Open Settings",
    sent: "Sent",
    failed: "Failed",
    coming_soon: "Coming soon",

    // ---- Tabs ----
    tab_rooms: "ROOMS",
    tab_friends: "FRIENDS",
    tab_profile: "PROFILE",
    tab_play: "PLAY",

    // ---- Play Hub ----
    play_hub_title: "Game Center",
    play_hub_subtitle: "Choose your game",
    play_coming_soon: "Coming Soon",
    play_chess: "Chess",
    play_carrom: "Carrom",
    play_damma: "Damma",
    play_global: "Play Online",
    play_friends: "Play with Friends",
    play_tournaments: "Tournaments",
    play_leaderboard: "Leaderboard",
    play_achievements: "Achievements",
    play_missions: "Daily Missions",
    drag_to_aim: "Drag away from the striker, release to shoot",
    power: "Power",
    you: "You",
    opponent: "Opponent",
    cover_queen: "Pocket a coin this turn to claim the Queen (+50)",
    foul_striker: "Foul! Striker pocketed — −10 pts",
    foul_timeout: "Time out! Turn passed to opponent",
    game_over: "Game Over",
    you_win: "You win!",
    opponent_wins: "Opponent wins",
    its_a_draw: "It's a draw!",
    bot: "Bot",
    game_not_found: "Game not found",

    // ---- Leaderboard ----
    lb_title: "Leaderboard",
    lb_kicker: "Global rankings",
    lb_tab_honor: "Honor",
    lb_tab_watch: "Watch",
    lb_tab_hosts: "Hosts",
    lb_empty_title: "No rankings yet",
    lb_empty_sub: "Be the first to earn honor points or host a watch party.",
    lb_button: "Leaderboard",

    // ---- Google Login ----
    google_signin: "Continue with Google",
    google_signing_in: "Signing in...",
    google_or: "OR",

    // ---- Tournaments ----
    tournaments_title: "Tournaments",
    tournaments_kicker: "Compete & win",
    tour_section_live: "LIVE NOW",
    tour_section_open: "OPEN — JOIN NOW",
    tour_section_finished: "FINISHED",
    tour_empty_title: "No tournaments yet",
    tour_empty_sub: "Create the first tournament and crown a champion.",
    tour_create_first: "Create Tournament",
    tour_create_title: "Create",
    tour_create_kicker: "Set up a competition",
    tour_label_title: "Tournament title",
    tour_placeholder_title: "FIFA Tournament 2025",
    tour_label_desc: "Description (optional)",
    tour_placeholder_desc: "Rules, format, schedule...",
    tour_label_size: "Bracket size",
    tour_label_prize: "Prize (optional)",
    tour_placeholder_prize: "100$ • Trophy • Honor",
    tour_create_cta: "Create Tournament",
    tour_err_title_short: "Title must be at least 3 characters",
    tour_join: "Join Tournament",
    tour_leave: "Leave Tournament",
    tour_start: "Start Tournament",
    tour_score_title: "Who won this match?",
    tour_participants: "Participants",
    tour_bracket: "Bracket",
    tour_round: "Round",
    tour_final: "Final",
    tour_champion: "🏆 Champion",
    tour_not_found: "Tournament not found",
    tour_button: "Tournaments",

    // ---- Cloud Sync ----
    sync_section: "CLOUD SYNC",
    sync_syncing: "Syncing...",
    sync_synced: "Synced ✓",
    sync_failed: "Sync failed",
    sync_idle: "Not synced yet",
    sync_idle_sub: "Tap refresh to sync your settings",

    // ---- Muted Words ----
    mw_title: "Muted Words",
    mw_subtitle: "Hide messages containing these words",
    mw_kicker: "Personal filter",
    mw_help: "Add words you don't want to see. Messages containing them will be hidden in chat (case-insensitive).",
    mw_placeholder: "Type a word to mute",
    mw_empty_title: "No muted words yet",
    mw_empty_sub: "Add words you want to hide from chats and messages.",
    mw_err_too_long: "Word too long (max 40 characters)",
    mw_err_full: "Maximum 100 muted words reached",

    // ---- Auth ----
    login: "Log in",
    signup: "Create new account",
    username: "USERNAME",
    password: "PASSWORD",
    nickname: "NICKNAME (DISPLAY NAME)",
    choose_avatar: "CHOOSE YOUR AVATAR",
    create_account: "CREATE ACCOUNT",
    watch_together: "Watch.\nTogether.",
    auth_subtitle:
      "Sync YouTube with friends in real-time, no streaming needed.",
    your_handle: "your-handle",
    your_unique_handle: "your-unique-handle",
    what_others_see: "What others see in rooms",

    // ---- Home ----
    public_rooms: "Public Rooms",
    hey: "Hey",
    hosted_by: "Hosted by",
    no_rooms: "No active rooms found",
    be_first:
      "Be the first to start a watch party. Or browse the search to discover more.",
    create_room: "CREATE ROOM",
    playing_video: "Playing video",
    waiting_for_host: "Waiting for host",
    waiting_host: "Waiting for host",
    syncing_rooms: "SYNCING ROOMS…",

    // ---- Search screen ----
    search_rooms_title: "Search rooms",
    search_rooms_placeholder: "Search by room name…",
    kicker_discover: "DISCOVER",
    recent: "RECENT",
    clear: "CLEAR",
    trending_now: "TRENDING NOW",
    recommended_for_you: "RECOMMENDED FOR YOU",
    no_exact_matches: "No exact matches",
    try_shorter_query: "Try a shorter or fuzzier query.",
    no_public_rooms_yet: "No public rooms yet",
    be_first_host:
      "Be the first to host a room from the home screen.",
    match_one: "match",
    match_many: "matches",
    for_query: "for",
    by_label: "by",

    // ---- DMs ----
    kicker_direct: "DIRECT",
    kicker_social: "SOCIAL",
    messages: "Messages",
    no_conversations_yet: "No conversations yet",
    add_friends_to_message: "Add friends and say hi to start chatting.",
    say_hi: "Say hi!",
    say_hi_emoji: "Say hi 👋",
    start_conversation_with: "Start a conversation with",
    shared: "SHARED",
    typing: "TYPING",
    online_caps: "ONLINE",
    offline_caps: "OFFLINE",
    live_caps: "LIVE",
    type_message_dots: "Type a message…",
    edit_message_dots: "Edit message…",
    editing_message: "EDITING MESSAGE",
    send_failed: "Send failed",
    image_too_large: "Image too large",
    pick_under_500kb: "Pick an image under ~500KB.",
    max_500kb: "Max ~500KB.",
    message: "Message",
    what_to_do: "What do you want to do?",
    message_deleted_inline: "message deleted",
    loading_conversations: "LOADING CONVERSATIONS…",
    photo_label: "📷 Photo",

    // ---- Create room ----
    new_party: "NEW PARTY",
    start_watch_party: "Start a\nwatch party.",
    room_name: "ROOM NAME",
    youtube_url_optional: "YOUTUBE URL (OPTIONAL)",
    public_room: "Public Room",
    public_room_sub: "Visible to everyone on the dashboard",
    room_password_optional: "ROOM PASSWORD (OPTIONAL)",
    create_enter: "CREATE & ENTER",
    friday_anime: "Friday Anime Night",
    yt_url_placeholder: "https://youtube.com/watch?v=...",
    keep_it_secret: "Keep it secret",
    join_party: "JOIN PARTY",
    create_identity: "Create your\nidentity.",

    // ---- Room ----
    hosting: "HOSTING",
    watching: "WATCHING",
    live: "live",
    connecting: "connecting...",
    no_video: "No video yet",
    open_yt_hub: "Open the YouTube hub below",
    change_video: "Change",
    search_youtube: "Search YT",
    search_yt_privately: "Search YouTube privately...",
    add_to_room: "ADD TO ROOM",
    send_message: "Send a message...",
    tap_to_play: "Tap to play",
    tap_starts_session: "Starts the room session",
    tap_join_sync: "Join the sync",
    leave_confirm_title: "Leave Room?",
    leave_confirm_msg: "Are you sure you want to leave?",
    leave: "Leave",
    stay: "Stay",
    transfer_leadership: "Transfer Leadership",
    make_host_q: "Make {name} the host?",
    transfer: "Transfer",
    playback_issue: "Playback issue",
    couldnt_load_youtube: "Couldn't load YouTube",
    couldnt_add: "Couldn't add",
    couldnt_add_msg: "Try again with a YouTube video URL.",
    search_failed: "Search failed",
    try_again: "Try again",
    private_search_hint:
      "Search privately — only what you \"Add to Room\" gets shared.",
    web: "Web",
    youtube_label: "YouTube",

    // Room controls
    settings: "Settings",
    video_volume: "Video Volume",
    video_volume_hint:
      "Controls the YouTube playback volume in this room.",
    muted_hint: "Muted — slide up to hear audio.",
    gallery_access_needed: "Gallery access needed",
    gallery_access_msg_profile: "Allow gallery access to upload your photo.",
    gallery_access_msg_chat:
      "Share photos in chat by allowing access in Settings.",

    // Phase 4 — voting + YT browser
    browse_yt: "Browse YT",
    suggest_video: "Suggest",
    vote_skip: "Vote Skip",
    voting_policy: "Voting Policy",
    everyone_can_vote: "Anyone can vote",
    host_only_votes: "Host only",
    voting_allowed_hint:
      "Guests can start skip/next votes (majority wins).",
    voting_owner_only_hint: "Only you (the host) can start votes.",
    vote_in_progress: "Vote already running",
    vote_wait_finish: "Wait for it to finish first.",
    vote_cancelled: "Vote cancelled",
    vote_skipped: "Skipped!",
    vote_next_passed: "Playing next…",
    vote_failed: "Vote did not pass",
    vote_to_skip: "VOTE TO SKIP",
    vote_play_next: "VOTE — PLAY NEXT",
    you_started_vote: "YOU STARTED THIS VOTE",
    vote_yes: "YES",
    vote_no: "NO",
    need_label: "need",
    yes_label: "yes",
    no_label: "no",
    seconds_short: "s",

    // ---- Profile ----
    member_since: "MEMBER SINCE",
    total_hours: "TOTAL HOURS",
    bio: "BIO",
    bio_empty: "Tap edit to add a bio",
    bio_placeholder: "A few words about you...",
    preset_avatars: "PRESET AVATARS",
    profile_banner: "PROFILE BANNER",
    badges_label: "BADGES (TAP TO TOGGLE)",
    language: "LANGUAGE",
    log_out: "LOG OUT",

    // ---- Friends ----
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
    sent_caps: "SENT",
    friend_caps: "FRIEND",
    pending: "PENDING",
    type_2_chars: "Type at least 2 characters.",
    no_match: "No users match that search.",
    online: "online",
    offline: "offline",
    wants_friend: "wants to be friends",
    no_friends_show: "No friends to show",
    friend_request_sent: "Friend request sent",
    remove_friend_q: "Remove friend?",
    unfriend_msg: "Unfriend {name}?",
    remove: "Remove",
    go: "GO",
    go_arrow: "→",

    // ---- Settings ----
    app_settings: "SETTINGS",
    settings_subtitle: "Personalize your Party4R experience",
    language_section: "Language",
    language_english: "English",
    language_arabic: "العربية",
    rtl_restart_title: "Restart required",
    rtl_restart_msg:
      "Language updated. Please fully close and reopen the app to apply right-to-left layout.",
    rtl_restart_ok: "Got it",
    settings_theme: "THEME",
    more_themes: "MORE THEMES",
    theme_library: "THEME LIBRARY",
    themes_count_one: "{n} theme",
    themes_count_many: "{n} themes",
    search_themes: "Search themes…",
    no_themes_found: "No themes match",
    settings_account: "ACCOUNT",
    settings_privacy_safety: "PRIVACY & SAFETY",
    settings_danger_zone: "DANGER ZONE",
    privacy_controls: "Privacy Controls",
    privacy_controls_sub: "Online status, last seen, profile visibility",
    blocked_users: "Blocked Users",
    blocked_users_sub: "Manage who can't contact you",
    privacy_policy: "Privacy Policy",
    privacy_policy_sub: "How we handle your data",
    terms_of_service: "Terms of Service",
    terms_of_service_sub: "Community guidelines",
    delete_account: "Delete Account",
    delete_account_sub: "Permanently erase all your data",
    delete_account_confirm:
      "This permanently deletes your account, friends, rooms, and all data. This cannot be undone.",
    delete_forever: "Delete Forever",
    more_settings_soon: "More settings coming soon — notifications, audio…",
    theme_neon_sub: "Neon green · Cyber default",
    theme_midnight_sub: "Blue · Calm dark",
    theme_amoled_sub: "Pure black · Battery saver",
    theme_purple_sub: "Purple · High contrast",
    layout_change: "Layout change",
    please_restart: "Please restart to apply the new direction.",

    // ---- Privacy screen ----
    kicker_visibility: "VISIBILITY",
    privacy_title: "PRIVACY",
    privacy_subtitle: "Control what others can see about you",
    privacy_online_status: "Online Status",
    privacy_online_status_sub: "Who can see when you're online",
    privacy_last_seen: "Last Seen",
    privacy_last_seen_sub: "Who can see when you were last active",
    privacy_profile: "Profile",
    privacy_profile_sub: "Who can view your profile",
    privacy_shared_time: "Shared Time",
    privacy_shared_time_sub: "Who can see hours spent co-watching",
    visibility_everyone: "Everyone",
    visibility_friends: "Friends only",
    visibility_nobody: "Nobody",

    // ---- Blocked ----
    kicker_safety: "SAFETY",
    blocked_title: "BLOCKED",
    blocked_subtitle_one: "{n} user blocked",
    blocked_subtitle_many: "{n} users blocked",
    no_blocked_title: "No Blocked Users",
    no_blocked_sub: "You haven't blocked anyone yet.",
    unblock_btn: "UNBLOCK",
    unblock_title: "Unblock",
    unblock_msg: "Unblock {name}? They will be able to message you again.",

    // ---- Legal ----
    kicker_legal: "LEGAL",
    privacy_policy_title: "PRIVACY POLICY",
    terms_title: "TERMS",
    legal_subtitle: "Effective 2026 · Minimum age 13",
    privacy_policy_intro:
      "We collect the minimum amount of data needed to make Party4R work, and we delete it as soon as we can.",
    terms_intro:
      "By using Party4R you agree to the following terms. We keep them short, plain, and fair.",
    pp_1_title: "1. What We Collect",
    pp_1_body:
      "• Account: username, nickname, password (hashed), avatar choice\n• Chats / DMs: text + base64 images you send (auto-deleted after 30/60 days)\n• Rooms: name, host, members, last video URL\n• Reports: reporter ID, target ID, reason (90-day retention)\n• Honor points: integer score per user\n• Privacy settings: your visibility choices",
    pp_2_title: "2. Data Minimization (TTL)",
    pp_2_body:
      "We delete data automatically when no longer needed:\n• Chats — 30 days\n• Direct messages — 60 days\n• Reports — 90 days\n• Rooms — deleted when empty for 24 hours",
    pp_3_title: "3. What We Don't Collect",
    pp_3_body:
      "• Email addresses (unless you contact support)\n• Phone numbers\n• Location data\n• Browsing history outside our app\n• Contacts / address books\n• Payment info (the app is free)",
    pp_4_title: "4. Who Can See What",
    pp_4_body:
      "You fully control your visibility from Settings → Privacy:\n• Online status — everyone / friends / nobody\n• Last seen — everyone / friends / nobody\n• Profile — everyone / friends / nobody\n• Shared time — everyone / friends / nobody",
    pp_5_title: "5. Account Deletion",
    pp_5_body:
      "You can permanently delete your account from Settings → Account → Delete Account. This wipes all your data immediately. No recovery is possible.",
    pp_6_title: "6. Children",
    pp_6_body:
      "Party4RApp is not for users under 13. If we learn an account belongs to a child under 13 we will delete it.",
    pp_7_title: "7. Contact",
    pp_7_body: "Privacy questions: yemenamer20@gmail.com",
    tos_1_title: "1. Acceptable Use",
    tos_1_body:
      "You agree NOT to:\n• Harass, threaten, or bully other users\n• Share sexually explicit, hateful, or violent content\n• Spam links or commercial content without permission\n• Impersonate others or share false identities\n• Attempt to access accounts that aren't yours\n• Circumvent moderation, blocks, or honor restrictions",
    tos_2_title: "2. Reporting & Moderation",
    tos_2_body:
      "You can report users or messages from any room. Reports are investigated by our moderation team. False reports may reduce your honor score.",
    tos_3_title: "3. Honor Score",
    tos_3_body:
      "Everyone starts with 100 honor points. Verified reports against you reduce your score. Low honor (≤ 20) restricts your ability to send messages or create rooms.",
    tos_4_title: "4. Account Termination",
    tos_4_body:
      "We may suspend or terminate accounts that violate these terms. You can delete your account at any time via Settings.",
    tos_5_title: "5. No Warranties",
    tos_5_body:
      'Party4RApp is provided "as is." We don\'t guarantee uninterrupted service.',
    tos_6_title: "6. Contact",
    tos_6_body: "Questions or appeals: yemenamer20@gmail.com",

    // ---- Splash ----
    initializing: "INITIALIZING SYNC ENGINE",
    version_label: "v 1.0",

    // ---- YouTube browser ----
    yt_browser_title: "YouTube",
    yt_browser_search_placeholder: "Search YouTube...",
    video_detected: "✓ Video detected",
    browse_video_to_add: "Browse a video to add it",

    // ---- Errors ----
    err_user_pass_required: "Username and password are required",
    err_login_failed: "Login failed",
    err_signup_failed: "Signup failed",
    err_username_min: "Username must be at least 3 characters",
    err_password_min: "Password must be at least 6 characters",
    err_pick_nickname: "Pick a nickname",
    err_room_name_required: "Room name is required",
    err_room_create_failed: "Failed to create room",
    err_could_not_update_setting: "Could not update setting",
    err_failed_to_delete_account: "Failed to delete account",

    // ---- Backend error mappings (mirrored in Arabic; English uses raw) ----
  },
  ar: {
    // ---- Common ----
    cancel: "إلغاء",
    save: "حفظ",
    edit: "تعديل",
    delete: "حذف",
    yes: "نعم",
    no: "لا",
    close: "إغلاق",
    loading: "جارٍ التحميل...",
    error: "خطأ",
    back: "رجوع",
    done: "تم",
    ok: "حسناً",
    retry: "إعادة المحاولة",
    open_settings: "فتح الإعدادات",
    sent: "تم الإرسال",
    failed: "فشل",
    coming_soon: "قريباً",

    // ---- Tabs ----
    tab_rooms: "الغرف",
    tab_friends: "الأصدقاء",
    tab_profile: "الملف",
    tab_play: "العب",

    // ---- Play Hub ----
    play_hub_title: "مركز الألعاب",
    play_hub_subtitle: "اختر لعبتك",
    play_coming_soon: "قريباً",
    play_chess: "شطرنج",
    play_carrom: "كيرم",
    play_damma: "ضمنة",
    play_global: "العب أونلاين",
    play_friends: "العب مع أصدقاء",
    play_tournaments: "البطولات",
    play_leaderboard: "التصنيف العالمي",
    play_achievements: "الإنجازات",
    play_missions: "المهام اليومية",
    drag_to_aim: "اسحب بعيداً عن القطّاعة ثم أفلت لإطلاقها",
    power: "القوة",
    you: "أنت",
    opponent: "الخصم",
    cover_queen: "أدخل قطعة هذا الدور لكسب الملكة (+50)",
    foul_striker: "خطأ! دخلت القطّاعة الحفرة — −10 نقاط",
    foul_timeout: "انتهى الوقت! الدور للخصم",
    game_over: "انتهت المباراة",
    you_win: "لقد فزت!",
    opponent_wins: "فاز الخصم",
    its_a_draw: "تعادل!",
    bot: "روبوت",
    game_not_found: "اللعبة غير موجودة",

    // ---- Leaderboard ----
    lb_title: "لوحة المتصدرين",
    lb_kicker: "الترتيب العالمي",
    lb_tab_honor: "الشرف",
    lb_tab_watch: "المشاهدة",
    lb_tab_hosts: "المضيفون",
    lb_empty_title: "لا يوجد ترتيب بعد",
    lb_empty_sub: "كن أول من يكسب نقاط شرف أو يستضيف غرفة مشاهدة.",
    lb_button: "المتصدرون",

    // ---- Google Login ----
    google_signin: "المتابعة باستخدام Google",
    google_signing_in: "جاري تسجيل الدخول...",
    google_or: "أو",

    // ---- Tournaments ----
    tournaments_title: "البطولات",
    tournaments_kicker: "تنافس واربح",
    tour_section_live: "مباشر الآن",
    tour_section_open: "مفتوح — انضم الآن",
    tour_section_finished: "منتهية",
    tour_empty_title: "لا توجد بطولات بعد",
    tour_empty_sub: "أنشئ البطولة الأولى وكن البطل.",
    tour_create_first: "أنشئ بطولة",
    tour_create_title: "إنشاء",
    tour_create_kicker: "أعد منافسة جديدة",
    tour_label_title: "عنوان البطولة",
    tour_placeholder_title: "بطولة فيفا 2025",
    tour_label_desc: "الوصف (اختياري)",
    tour_placeholder_desc: "القواعد، الصيغة، الجدول...",
    tour_label_size: "حجم الـ Bracket",
    tour_label_prize: "الجائزة (اختياري)",
    tour_placeholder_prize: "100$ • كأس • نقاط شرف",
    tour_create_cta: "إنشاء البطولة",
    tour_err_title_short: "العنوان يجب ألا يقل عن 3 أحرف",
    tour_join: "انضم للبطولة",
    tour_leave: "مغادرة البطولة",
    tour_start: "ابدأ البطولة",
    tour_score_title: "من ربح هذه المباراة؟",
    tour_participants: "المشاركون",
    tour_bracket: "الجدول",
    tour_round: "جولة",
    tour_final: "النهائي",
    tour_champion: "🏆 البطل",
    tour_not_found: "البطولة غير موجودة",
    tour_button: "البطولات",

    // ---- Cloud Sync ----
    sync_section: "المزامنة السحابية",
    sync_syncing: "جاري المزامنة...",
    sync_synced: "متزامن ✓",
    sync_failed: "فشلت المزامنة",
    sync_idle: "لم تتم المزامنة بعد",
    sync_idle_sub: "اضغط على زر التحديث لمزامنة إعداداتك",

    // ---- Muted Words ----
    mw_title: "الكلمات المسكتة",
    mw_subtitle: "إخفاء الرسائل التي تحوي هذه الكلمات",
    mw_kicker: "فلتر شخصي",
    mw_help: "أضف الكلمات التي لا تريد رؤيتها. الرسائل التي تحويها ستختفي من المحادثات (غير حساس لحالة الأحرف).",
    mw_placeholder: "اكتب كلمة لإسكاتها",
    mw_empty_title: "لا توجد كلمات مسكتة بعد",
    mw_empty_sub: "أضف الكلمات التي تريد إخفاءها من المحادثات والرسائل.",
    mw_err_too_long: "الكلمة طويلة جداً (الحد 40 حرف)",
    mw_err_full: "تم الوصول للحد الأقصى (100 كلمة)",

    // ---- Auth ----
    login: "تسجيل الدخول",
    signup: "إنشاء حساب جديد",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    nickname: "الاسم الظاهر",
    choose_avatar: "اختر صورتك الرمزية",
    create_account: "إنشاء حساب",
    watch_together: "شاهد.\nمعاً.",
    auth_subtitle:
      "زامن يوتيوب مع أصدقائك في الوقت الفعلي، بدون بث مباشر.",
    your_handle: "اسم-المستخدم",
    your_unique_handle: "اسم-المستخدم-الفريد",
    what_others_see: "ما يراه الآخرون في الغرف",

    // ---- Home ----
    public_rooms: "الغرف العامة",
    hey: "مرحباً",
    hosted_by: "من تنظيم",
    no_rooms: "لا توجد غرف نشطة بعد",
    be_first:
      "كن أول من يبدأ حفلة مشاهدة. أو تصفّح البحث لاستكشاف المزيد.",
    create_room: "إنشاء غرفة",
    playing_video: "يشغّل فيديو",
    waiting_for_host: "بانتظار المضيف",
    waiting_host: "بانتظار المضيف",
    syncing_rooms: "مزامنة الغرف…",

    // ---- Search screen ----
    search_rooms_title: "البحث عن غرف",
    search_rooms_placeholder: "ابحث باسم الغرفة…",
    kicker_discover: "اكتشف",
    recent: "الأخيرة",
    clear: "مسح",
    trending_now: "الأكثر رواجاً",
    recommended_for_you: "موصى به لك",
    no_exact_matches: "لا توجد نتائج مطابقة",
    try_shorter_query: "جرّب استعلاماً أقصر أو أعمّ.",
    no_public_rooms_yet: "لا توجد غرف عامة بعد",
    be_first_host:
      "كن أول من يستضيف غرفة من الشاشة الرئيسية.",
    match_one: "نتيجة",
    match_many: "نتيجة",
    for_query: "لـ",
    by_label: "بواسطة",

    // ---- DMs ----
    kicker_direct: "خاص",
    kicker_social: "اجتماعي",
    messages: "الرسائل",
    no_conversations_yet: "لا توجد محادثات بعد",
    add_friends_to_message:
      "أضف أصدقاء وألقِ التحية لبدء المحادثة.",
    say_hi: "ألقِ التحية!",
    say_hi_emoji: "ألقِ التحية 👋",
    start_conversation_with: "ابدأ محادثة مع",
    shared: "مشترك",
    typing: "يكتب",
    online_caps: "متصل",
    offline_caps: "غير متصل",
    live_caps: "مباشر",
    type_message_dots: "اكتب رسالة…",
    edit_message_dots: "تعديل الرسالة…",
    editing_message: "تعديل الرسالة",
    send_failed: "فشل الإرسال",
    image_too_large: "الصورة كبيرة جداً",
    pick_under_500kb: "اختر صورة أقل من ٥٠٠ كيلوبايت تقريباً.",
    max_500kb: "بحد أقصى ٥٠٠ كيلوبايت تقريباً.",
    message: "رسالة",
    what_to_do: "ماذا تريد أن تفعل؟",
    message_deleted_inline: "تم حذف الرسالة",
    loading_conversations: "تحميل المحادثات…",
    photo_label: "📷 صورة",

    // ---- Create room ----
    new_party: "حفلة جديدة",
    start_watch_party: "ابدأ\nحفلة مشاهدة.",
    room_name: "اسم الغرفة",
    youtube_url_optional: "رابط يوتيوب (اختياري)",
    public_room: "غرفة عامة",
    public_room_sub: "ظاهرة للجميع في اللوحة",
    room_password_optional: "كلمة سر الغرفة (اختياري)",
    create_enter: "إنشاء ودخول",
    friday_anime: "ليلة أنمي الجمعة",
    yt_url_placeholder: "https://youtube.com/watch?v=...",
    keep_it_secret: "اجعلها سرّية",
    join_party: "انضم للحفلة",
    create_identity: "أنشئ\nهويتك.",

    // ---- Room ----
    hosting: "أنت المضيف",
    watching: "تشاهد",
    live: "متصل",
    connecting: "جارٍ الاتصال...",
    no_video: "لا يوجد فيديو بعد",
    open_yt_hub: "افتح مركز يوتيوب أدناه",
    change_video: "تغيير",
    search_youtube: "بحث يوتيوب",
    search_yt_privately: "ابحث في يوتيوب بشكل خاص...",
    add_to_room: "إضافة للغرفة",
    send_message: "أرسل رسالة...",
    tap_to_play: "اضغط للتشغيل",
    tap_starts_session: "يبدأ جلسة الغرفة",
    tap_join_sync: "انضم للمزامنة",
    leave_confirm_title: "مغادرة الغرفة؟",
    leave_confirm_msg: "هل أنت متأكد أنك تريد المغادرة؟",
    leave: "غادر",
    stay: "ابقَ",
    transfer_leadership: "نقل القيادة",
    make_host_q: "هل تريد جعل {name} هو المضيف؟",
    transfer: "نقل",
    playback_issue: "مشكلة في التشغيل",
    couldnt_load_youtube: "تعذّر تحميل يوتيوب",
    couldnt_add: "تعذّر الإضافة",
    couldnt_add_msg: "حاول مجدداً برابط فيديو يوتيوب صالح.",
    search_failed: "فشل البحث",
    try_again: "حاول مجدداً",
    private_search_hint:
      "ابحث بخصوصية — لا يظهر للآخرين إلا ما تختار إضافته للغرفة.",
    web: "الويب",
    youtube_label: "يوتيوب",

    // Room controls
    settings: "الإعدادات",
    video_volume: "صوت الفيديو",
    video_volume_hint: "يتحكم في مستوى صوت يوتيوب في هذه الغرفة.",
    muted_hint: "مكتوم — اسحب للأعلى لسماع الصوت.",
    gallery_access_needed: "الوصول إلى المعرض مطلوب",
    gallery_access_msg_profile:
      "اسمح بالوصول إلى المعرض لرفع صورتك.",
    gallery_access_msg_chat:
      "للمشاركة في المحادثة، اسمح بالوصول من الإعدادات.",

    // Phase 4 — voting + YT browser
    browse_yt: "تصفح يوتيوب",
    suggest_video: "اقترح",
    vote_skip: "تصويت تخطي",
    voting_policy: "سياسة التصويت",
    everyone_can_vote: "يمكن للجميع التصويت",
    host_only_votes: "المضيف فقط",
    voting_allowed_hint:
      "يمكن للضيوف بدء تصويتات التخطي/التالي (الأغلبية تفوز).",
    voting_owner_only_hint: "أنت فقط (المضيف) يمكنك بدء التصويتات.",
    vote_in_progress: "هناك تصويت جارٍ بالفعل",
    vote_wait_finish: "انتظر حتى ينتهي أولاً.",
    vote_cancelled: "تم إلغاء التصويت",
    vote_skipped: "تم التخطي!",
    vote_next_passed: "يتم تشغيل التالي…",
    vote_failed: "لم يمر التصويت",
    vote_to_skip: "تصويت للتخطي",
    vote_play_next: "تصويت — التالي",
    you_started_vote: "أنت بدأت هذا التصويت",
    vote_yes: "نعم",
    vote_no: "لا",
    need_label: "مطلوب",
    yes_label: "نعم",
    no_label: "لا",
    seconds_short: "ث",

    // ---- Profile ----
    member_since: "عضو منذ",
    total_hours: "إجمالي الساعات",
    bio: "النبذة",
    bio_empty: "اضغط تعديل لإضافة نبذة",
    bio_placeholder: "كلمات قليلة عنك...",
    preset_avatars: "صور رمزية جاهزة",
    profile_banner: "خلفية الملف",
    badges_label: "الشارات (انقر للتبديل)",
    language: "اللغة",
    log_out: "تسجيل الخروج",

    // ---- Friends ----
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
    sent_caps: "مُرسَل",
    friend_caps: "صديق",
    pending: "معلّق",
    type_2_chars: "اكتب حرفين على الأقل.",
    no_match: "لا يوجد مستخدمون مطابقون.",
    online: "متصل",
    offline: "غير متصل",
    wants_friend: "يريد إضافتك صديقاً",
    no_friends_show: "لا يوجد أصدقاء لعرضهم",
    friend_request_sent: "تم إرسال طلب الصداقة",
    remove_friend_q: "إزالة الصديق؟",
    unfriend_msg: "إلغاء صداقة {name}؟",
    remove: "إزالة",
    go: "اذهب",
    go_arrow: "←",

    // ---- Settings ----
    app_settings: "الإعدادات",
    settings_subtitle: "خصّص تجربة Party4R الخاصة بك",
    language_section: "اللغة",
    language_english: "English",
    language_arabic: "العربية",
    rtl_restart_title: "يلزم إعادة التشغيل",
    rtl_restart_msg:
      "تم تحديث اللغة. الرجاء إغلاق التطبيق وفتحه مجدداً لتفعيل الاتجاه من اليمين إلى اليسار.",
    rtl_restart_ok: "حسناً",
    settings_theme: "السمة",
    more_themes: "المزيد من السمات",
    theme_library: "مكتبة السمات",
    themes_count_one: "{n} سمة",
    themes_count_many: "{n} سمات",
    search_themes: "ابحث عن سمة…",
    no_themes_found: "لا توجد سمات مطابقة",
    settings_account: "الحساب",
    settings_privacy_safety: "الخصوصية والأمان",
    settings_danger_zone: "منطقة الخطر",
    privacy_controls: "إعدادات الخصوصية",
    privacy_controls_sub: "الحالة، آخر ظهور، ظهور الملف",
    blocked_users: "المستخدمون المحظورون",
    blocked_users_sub: "تحكّم بمن لا يستطيع التواصل معك",
    privacy_policy: "سياسة الخصوصية",
    privacy_policy_sub: "كيف نتعامل مع بياناتك",
    terms_of_service: "شروط الخدمة",
    terms_of_service_sub: "إرشادات المجتمع",
    delete_account: "حذف الحساب",
    delete_account_sub: "حذف جميع بياناتك نهائياً",
    delete_account_confirm:
      "سيؤدي هذا إلى حذف حسابك وأصدقائك وغرفك وكل بياناتك نهائياً. لا يمكن التراجع عن هذا الإجراء.",
    delete_forever: "حذف نهائي",
    more_settings_soon:
      "المزيد من الإعدادات قريباً — الإشعارات، الصوت…",
    theme_neon_sub: "أخضر نيون · افتراضي سايبر",
    theme_midnight_sub: "أزرق · داكن هادئ",
    theme_amoled_sub: "أسود نقي · موفّر للبطارية",
    theme_purple_sub: "بنفسجي · تباين عالٍ",
    layout_change: "تغيير الاتجاه",
    please_restart: "الرجاء إعادة التشغيل لتطبيق الاتجاه الجديد.",

    // ---- Privacy screen ----
    kicker_visibility: "الظهور",
    privacy_title: "الخصوصية",
    privacy_subtitle: "تحكّم في ما يمكن للآخرين رؤيته عنك",
    privacy_online_status: "حالة الاتصال",
    privacy_online_status_sub: "من يستطيع رؤية أنك متصل",
    privacy_last_seen: "آخر ظهور",
    privacy_last_seen_sub: "من يستطيع رؤية آخر مرة كنت فيها نشطاً",
    privacy_profile: "الملف الشخصي",
    privacy_profile_sub: "من يستطيع عرض ملفك",
    privacy_shared_time: "الوقت المشترك",
    privacy_shared_time_sub: "من يستطيع رؤية ساعات المشاهدة معاً",
    visibility_everyone: "الجميع",
    visibility_friends: "الأصدقاء فقط",
    visibility_nobody: "لا أحد",

    // ---- Blocked ----
    kicker_safety: "الأمان",
    blocked_title: "المحظورون",
    blocked_subtitle_one: "{n} مستخدم محظور",
    blocked_subtitle_many: "{n} مستخدمين محظورين",
    no_blocked_title: "لا يوجد مستخدمون محظورون",
    no_blocked_sub: "لم تحظر أحداً بعد.",
    unblock_btn: "إلغاء الحظر",
    unblock_title: "إلغاء الحظر",
    unblock_msg:
      "هل تريد إلغاء حظر {name}؟ سيتمكن من مراسلتك مجدداً.",

    // ---- Legal ----
    kicker_legal: "قانوني",
    privacy_policy_title: "سياسة الخصوصية",
    terms_title: "الشروط",
    legal_subtitle: "ساري ٢٠٢٦ · الحد الأدنى للعمر ١٣",
    privacy_policy_intro:
      "نجمع الحد الأدنى من البيانات اللازمة لتشغيل Party4R، ونحذفها بأسرع ما يمكن.",
    terms_intro:
      "باستخدامك Party4R فإنك توافق على الشروط التالية. نبقيها قصيرة وواضحة وعادلة.",
    pp_1_title: "١. ما الذي نجمعه",
    pp_1_body:
      "• الحساب: اسم المستخدم، الاسم الظاهر، كلمة المرور (مشفّرة)، الصورة الرمزية\n• المحادثات والرسائل الخاصة: النص والصور المرسلة (تُحذف تلقائياً بعد ٣٠/٦٠ يوماً)\n• الغرف: الاسم، المضيف، الأعضاء، آخر رابط فيديو\n• البلاغات: معرّف المُبلِّغ، معرّف المُبلَّغ عنه، السبب (تُحفظ ٩٠ يوماً)\n• نقاط الشرف: قيمة عددية لكل مستخدم\n• إعدادات الخصوصية: خياراتك للظهور",
    pp_2_title: "٢. تقليل البيانات (TTL)",
    pp_2_body:
      "نحذف البيانات تلقائياً عند انتهاء الحاجة:\n• المحادثات — ٣٠ يوماً\n• الرسائل الخاصة — ٦٠ يوماً\n• البلاغات — ٩٠ يوماً\n• الغرف — تُحذف عند كونها فارغة لمدة ٢٤ ساعة",
    pp_3_title: "٣. ما لا نجمعه",
    pp_3_body:
      "• البريد الإلكتروني (إلا إذا تواصلت مع الدعم)\n• أرقام الهاتف\n• الموقع الجغرافي\n• سجل التصفح خارج التطبيق\n• جهات الاتصال\n• معلومات الدفع (التطبيق مجاني)",
    pp_4_title: "٤. من يمكنه رؤية ماذا",
    pp_4_body:
      "تتحكم كاملاً في ظهورك من الإعدادات ← الخصوصية:\n• حالة الاتصال — الجميع / الأصدقاء / لا أحد\n• آخر ظهور — الجميع / الأصدقاء / لا أحد\n• الملف الشخصي — الجميع / الأصدقاء / لا أحد\n• الوقت المشترك — الجميع / الأصدقاء / لا أحد",
    pp_5_title: "٥. حذف الحساب",
    pp_5_body:
      "يمكنك حذف حسابك نهائياً من الإعدادات ← الحساب ← حذف الحساب. سيتم محو جميع بياناتك فوراً. لا يمكن الاسترجاع.",
    pp_6_title: "٦. الأطفال",
    pp_6_body:
      "تطبيق Party4R غير مخصص لمن هم دون ١٣ عاماً. إذا علمنا أن حساباً يخص طفلاً دون ١٣ سنحذفه.",
    pp_7_title: "٧. التواصل",
    pp_7_body: "أسئلة الخصوصية: yemenamer20@gmail.com",
    tos_1_title: "١. الاستخدام المقبول",
    tos_1_body:
      "أنت توافق على عدم القيام بما يلي:\n• مضايقة أو تهديد أو تنمر على الآخرين\n• مشاركة محتوى جنسي صريح أو مسيء أو عنيف\n• إرسال روابط مزعجة أو محتوى تجاري دون إذن\n• انتحال شخصيات الآخرين أو نشر هويات مزيفة\n• محاولة الوصول إلى حسابات ليست لك\n• الالتفاف على الرقابة أو الحظر أو قيود الشرف",
    tos_2_title: "٢. الإبلاغ والرقابة",
    tos_2_body:
      "يمكنك الإبلاغ عن مستخدمين أو رسائل من أي غرفة. تتم مراجعة البلاغات من قبل فريق الرقابة. البلاغات الكاذبة قد تخفض نقاط شرفك.",
    tos_3_title: "٣. نقاط الشرف",
    tos_3_body:
      "يبدأ الجميع بـ ١٠٠ نقطة شرف. البلاغات الموثقة ضدك تخفض النقاط. عند انخفاضها (≤ ٢٠) ستُقيد قدرتك على إرسال الرسائل أو إنشاء غرف.",
    tos_4_title: "٤. إنهاء الحساب",
    tos_4_body:
      "قد نوقف أو نُنهي الحسابات المخالفة لهذه الشروط. يمكنك حذف حسابك في أي وقت من الإعدادات.",
    tos_5_title: "٥. بدون ضمانات",
    tos_5_body:
      "يُقدَّم Party4R \"كما هو\". لا نضمن استمرار الخدمة دون انقطاع.",
    tos_6_title: "٦. التواصل",
    tos_6_body: "الأسئلة والاعتراضات: yemenamer20@gmail.com",

    // ---- Splash ----
    initializing: "تهيئة محرك المزامنة",
    version_label: "v 1.0",

    // ---- YouTube browser ----
    yt_browser_title: "يوتيوب",
    yt_browser_search_placeholder: "ابحث في يوتيوب...",
    video_detected: "✓ تم اكتشاف الفيديو",
    browse_video_to_add: "تصفّح فيديو لإضافته",

    // ---- Errors ----
    err_user_pass_required: "اسم المستخدم وكلمة المرور مطلوبان",
    err_login_failed: "فشل تسجيل الدخول",
    err_signup_failed: "فشل إنشاء الحساب",
    err_username_min: "اسم المستخدم يجب أن يحتوي ٣ أحرف على الأقل",
    err_password_min: "كلمة المرور يجب أن تحتوي ٦ أحرف على الأقل",
    err_pick_nickname: "اختر اسماً ظاهراً",
    err_room_name_required: "اسم الغرفة مطلوب",
    err_room_create_failed: "تعذّر إنشاء الغرفة",
    err_could_not_update_setting: "تعذّر تحديث الإعداد",
    err_failed_to_delete_account: "فشل حذف الحساب",
  },
};

// =============================================================================
// Backend error → Arabic mapping
// =============================================================================
// Keyed by the English HTTPException detail string from the backend. Anything
// unknown falls through to the raw message — never block the user with a
// confusing translation miss.
const ERR_AR: Record<string, string> = {
  "Not authenticated": "لم يتم تسجيل الدخول",
  "Invalid token": "رمز الدخول غير صالح",
  "User not found": "المستخدم غير موجود",
  "Username already taken": "اسم المستخدم مستخدم بالفعل",
  "Incorrect username or password": "اسم المستخدم أو كلمة المرور غير صحيحة",
  "Avatar image too large (max ~500KB)":
    "صورة الملف الشخصي كبيرة جداً (الحد ٥٠٠ كيلوبايت تقريباً)",
  "Image too large (max ~500KB)":
    "الصورة كبيرة جداً (الحد ٥٠٠ كيلوبايت تقريباً)",
  "Room not found": "الغرفة غير موجودة",
  "Incorrect room password": "كلمة سر الغرفة غير صحيحة",
  "Only host can change video": "فقط المضيف يمكنه تغيير الفيديو",
  "Only the room owner can update settings":
    "فقط مالك الغرفة يمكنه تغيير الإعدادات",
  "No YouTube video ID found in URL":
    "لم يتم العثور على معرّف فيديو يوتيوب في الرابط",
  "Cannot DM yourself": "لا يمكنك مراسلة نفسك",
  "You blocked this user": "لقد حظرت هذا المستخدم",
  "You are blocked by this user": "أنت محظور من هذا المستخدم",
  "Only friends can DM": "فقط الأصدقاء يمكنهم تبادل الرسائل الخاصة",
  "Empty message": "الرسالة فارغة",
  "Message not found": "الرسالة غير موجودة",
  "Can only edit your own messages": "يمكنك تعديل رسائلك فقط",
  "Can only delete your own messages": "يمكنك حذف رسائلك فقط",
  "Message is deleted": "تم حذف الرسالة",
  "Cannot block yourself": "لا يمكنك حظر نفسك",
  "Cannot friend yourself": "لا يمكنك إضافة نفسك صديقاً",
  "Cannot report yourself": "لا يمكنك الإبلاغ عن نفسك",
  "Target user not found": "المستخدم المستهدف غير موجود",
  "No pending request from this user": "لا يوجد طلب صداقة من هذا المستخدم",
  "Invalid Expo push token format": "تنسيق رمز الإشعارات غير صالح",
  "YouTube API key not configured": "مفتاح يوتيوب غير مهيأ",
};

// Helpers for fuzzy-matching backend errors that include dynamic suffixes
// (e.g. "Too many block requests. Please slow down.") — we strip the
// dynamic word and try a templated lookup.
function fuzzyMapError(msg: string, lang: Lang): string | null {
  if (lang !== "ar") return null;
  if (!msg) return null;
  // "Too many X requests. Please slow down." → generic
  if (/^Too many .+ requests\. Please slow down\.$/i.test(msg)) {
    return "عدد كبير من الطلبات. الرجاء الإبطاء.";
  }
  if (/^invalid visibility for /i.test(msg)) {
    return "إعداد ظهور غير صالح";
  }
  if (/^YouTube API error/i.test(msg)) {
    return "خطأ من واجهة يوتيوب";
  }
  return null;
}

// =============================================================================
// Context
// =============================================================================
interface LangCtx {
  lang: Lang;
  isRTL: boolean;
  fontsLoaded: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  tErr: (raw: any) => string;
  nf: (n: number) => string;
  setLang: (l: Lang) => Promise<{ needsRestart: boolean }>;
}

const LanguageContext = createContext<LangCtx | undefined>(undefined);

// Helper — replace {placeholder} tokens.
function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [isRTL, setIsRTL] = useState<boolean>(I18nManager.isRTL);

  // Cairo font weights for Arabic UI.
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
  });

  // ---- Apply global Arabic font to every Text once it loads + lang is ar ----
  useEffect(() => {
    if (!fontsLoaded) return;
    // RN's defaultProps merge pattern. We deliberately KEEP existing styles
    // and only inject fontFamily so authors can still override per-Text.
    // @ts-ignore — defaultProps exists in RN for Text.
    const defaults = (Text as any).defaultProps || {};
    if (lang === "ar") {
      // @ts-ignore
      (Text as any).defaultProps = {
        ...defaults,
        style: [{ fontFamily: "Cairo_600SemiBold" }, defaults.style],
      };
    } else {
      // @ts-ignore — reset to undefined so the platform default font returns.
      (Text as any).defaultProps = {
        ...defaults,
        style: defaults.style && Array.isArray(defaults.style)
          ? defaults.style.filter((x: any) => !(x && x.fontFamily?.startsWith("Cairo")))
          : undefined,
      };
    }
  }, [fontsLoaded, lang]);

  // ---- Restore saved language on mount ----
  useEffect(() => {
    (async () => {
      const saved = (await storage.getItem(KEY, "")) as string;
      if (saved === "ar" || saved === "en") {
        setLangState(saved as Lang);
        try {
          I18nManager.allowRTL(saved === "ar");
          // Note: do NOT forceRTL on load; the layout direction was already
          // set on a previous setLang() call. forceRTL here would cause an
          // unwanted reload on every cold start.
        } catch {}
      }
    })();
  }, []);

  // ---- setLang ----
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

  // ---- t() ----
  const t: LangCtx["t"] = (key, params) => {
    const raw = dict[lang][key] || dict.en[key] || key;
    return interpolate(raw, params);
  };

  // ---- tErr() — backend error translator ----
  const tErr: LangCtx["tErr"] = (raw) => {
    // Accept Error, string, or any object with .message
    let msg = "";
    if (!raw) return t("error");
    if (typeof raw === "string") msg = raw;
    else if (raw.message) msg = String(raw.message);
    else msg = String(raw);
    msg = msg.trim();
    if (!msg) return t("error");
    if (lang !== "ar") return msg; // English — passthrough
    if (ERR_AR[msg]) return ERR_AR[msg];
    const fuzzy = fuzzyMapError(msg, lang);
    if (fuzzy) return fuzzy;
    return msg;
  };

  // ---- nf() — number formatter (Western numerals per spec) ----
  const nf: LangCtx["nf"] = (n) => String(n);

  const value = useMemo<LangCtx>(
    () => ({ lang, isRTL, fontsLoaded, t, tErr, nf, setLang }),
    [lang, isRTL, fontsLoaded]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used inside LanguageProvider");
  return ctx;
}
