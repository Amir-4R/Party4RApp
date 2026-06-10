# Party4R — Full Project (Frontend + Backend)

نسخة كاملة من تطبيق Party4R بنظام Expo (React Native) + FastAPI + MongoDB.
هذا الـ ZIP يحتوي على الكود المصدري فقط بدون `node_modules` ولا `.venv` ولا الكاش.

## بنية المشروع

```
party4r-full/
├── frontend/                    # تطبيق Expo (Web/iOS/Android)
│   ├── app/                     # ملفات الراوتر (Expo Router)
│   │   ├── (tabs)/             # شاشات الـ Tab الرئيسية
│   │   ├── game/               # الألعاب (Carrom, Chess, Damma)
│   │   ├── tournament/         # البطولات
│   │   ├── dms/                # المحادثات الخاصة
│   │   ├── room/               # غرف اللعب
│   │   └── legal/              # شروط الاستخدام
│   ├── src/
│   │   ├── games/              # محركات الألعاب
│   │   │   ├── carrom/         # محرك الكيرم (ICF) + AI
│   │   │   └── chess/          # محرك الشطرنج + SVG + AI (3 صعوبات)
│   │   ├── context/            # React Contexts (Auth, Language, Theme, Game)
│   │   ├── theme/              # FUTURISTIC theme palette
│   │   ├── constants/          # avatars, ranks, customization
│   │   └── utils/              # API client, cloud sync, helpers
│   ├── assets/                 # صور، خطوط، أصوات
│   ├── app.json
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                    # ⚠ غيّر URLs قبل النشر
│
└── backend/                    # FastAPI (Python 3.11+)
    ├── server.py               # نقطة الدخول الرئيسية + كل الـ routes
    ├── cloud_sync.py           # مزامنة التفضيلات
    ├── tournaments.py          # نظام البطولات
    ├── leaderboard.py          # المتصدرين
    ├── google_auth.py          # Google OAuth
    ├── notifications.py        # Push Notifications
    ├── requirements.txt
    └── .env                    # ⚠ غيّر MONGO_URL & JWT_SECRET قبل النشر
```

## التشغيل المحلي

### 1) Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# عدّل MONGO_URL في .env إلى Atlas الخاص بك
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2) Frontend
```bash
cd frontend
yarn install                              # أو npm install
# عدّل EXPO_PUBLIC_BACKEND_URL في .env
yarn start                                # للويب
yarn start --android                      # Android (يتطلب Android Studio)
yarn start --ios                          # iOS (يتطلب Xcode)
```

## ميزات مهمة

### ألعاب
- **الكيرم** (Carrom): محرك فيزياء كامل بمعادلات ICF، بوت AI، حفر بإصابة محسوبة بفيزياء الـ skim
- **الشطرنج**: قطع SVG منحوتة (3 ثيمات: classic/royal/ocean)، بوت بـ 3 صعوبات (Minimax + α-β)
- **الدامة** (Damma): لاعبَين محليّين

### Cloud Sync
- مزامنة الثيم، اللغة، الكلمات المكتومة بين الأجهزة

### Tournaments
- نظام Brackets مع تحديث مباشر (Polling)

### Authentication
- JWT-based + Google OAuth

## API Endpoints رئيسية
- `POST /api/auth/register` & `/login`
- `GET /api/leaderboard/honor`
- `POST /api/cloud/sync`
- `GET /api/tournaments`
- `GET /api/exports/{filename}` — لتنزيل ملفات المصدر

## الحقوق
- قطع الشطرنج SVG مأخوذة من مجموعة **Cburnett** (Public Domain — Wikipedia/Lichess)
- كل الأكواد الأخرى ملكية المشروع
