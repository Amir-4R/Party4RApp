# 🔐 تفعيل Google Login على Party4R

> هذا الملف يوضّح كيفية تفعيل ميزة "تسجيل الدخول بـ Google" بعد أن تحصل على الـ Client IDs من Google Cloud Console.

---

## ✅ ما تم تجهيزه مسبقاً

**Backend** (مكتمل):
- ✅ `/api/auth/google/config` — يخبر التطبيق إذا كانت الميزة مفعّلة
- ✅ `/api/auth/google/exchange` — يستقبل id_token من Google ويُصدر JWT
- ✅ التحقق من توقيع Google باستخدام `google-auth` library
- ✅ التحقق من `email_verified`, `issuer`, `audience`
- ✅ ربط المستخدمين الحاليين بحساباتهم في Google (Account Linking)
- ✅ إنشاء مستخدم جديد إذا لم يكن موجوداً
- ✅ Index فريد على `google_sub` و `email`

**Frontend** (مكتمل):
- ✅ `expo-auth-session` + `expo-web-browser` مثبّت
- ✅ `<GoogleSignInButton />` component في `src/components/auth/`
- ✅ مدمج في شاشتي `login.tsx` و `signup.tsx`
- ✅ يختفي تلقائياً عندما لا تكون الميزة مفعّلة في الـ Backend
- ✅ `AuthContext.loginWithToken()` لحفظ الـ JWT

---

## 🎯 الخطوات لتفعيل الميزة في الإنتاج

### 1️⃣ احصل على Client IDs من Google Cloud Console

#### أ. Web Client (إلزامي)
1. اذهب إلى: https://console.cloud.google.com/apis/credentials
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Party4R Web`
5. **Authorized JavaScript origins**:
   ```
   https://api.party4r.com           ← VPS domain
   http://localhost:19006             ← Expo web dev
   http://localhost:3000              ← Preview
   ```
6. **Authorized redirect URIs** (أضف الكل):
   ```
   https://auth.expo.io/@anonymous/party4r-app
   https://api.party4r.com/oauth2redirect/google
   party4r://oauth2redirect/google
   ```
7. **Create** → انسخ Client ID

#### ب. Android Client (للـ APK)
1. **Create Credentials** → **OAuth client ID**
2. Application type: **Android**
3. Package name: `com.party4r.app`
4. SHA-1 certificate fingerprint:
   ```bash
   # من Termux:
   keytool -list -v -keystore ~/party4r-release.jks -alias party4r
   ```
5. انسخ السطر `SHA1: AB:CD:...`
6. **Create** → انسخ Android Client ID

---

### 2️⃣ ضع الـ Client IDs في `.env`

افتح `/app/backend/.env` (أو `.env` في VPS) وأضف:
```bash
GOOGLE_OAUTH_CLIENT_ID_WEB=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_ID_ANDROID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
```

أعد تشغيل الـ Backend:
```bash
# محلياً:
sudo supervisorctl restart backend

# على VPS مع Docker:
docker compose restart backend
```

---

### 3️⃣ تحقق من التفعيل

```bash
curl https://api.party4r.com/api/auth/google/config
# يجب أن يُرجع: {"enabled":true,"client_id_web":"..."}
```

---

### 4️⃣ أعد بناء APK

```bash
# على Termux:
cd ~/party4r-frontend
bash BUILD_TERMUX.sh
```

> ✅ التطبيق سيكتشف تلقائياً أن الميزة مُفعّلة ويظهر زر "Continue with Google" في شاشتي تسجيل الدخول والتسجيل الجديد.

---

## 🧪 اختبار الميزة محلياً

### Backend test:
```bash
# 1. تحقق من الـ config endpoint
curl http://localhost:8001/api/auth/google/config

# 2. (اختياري) جرّب تبادل token عبر OAuth Playground:
#    https://developers.google.com/oauthplayground
#    اختر "Google OAuth2 API v2" → openid + email + profile
#    احصل على id_token وأرسله:

curl -X POST http://localhost:8001/api/auth/google/exchange \
  -H 'Content-Type: application/json' \
  -d '{"id_token":"YOUR_REAL_ID_TOKEN"}'

# يجب أن تحصل على: {"access_token":"...","user":{...}}
```

### Frontend test:
1. افتح التطبيق على localhost:3000/login
2. اضغط زر "Continue with Google"
3. سيفتح متصفح للتسجيل
4. بعد الموافقة → تنتقل إلى /home وتم تسجيل الدخول

---

## ⚠️ نقاط مهمة

1. **JWT_SECRET نفسه**: تأكد أن `JWT_SECRET` على VPS = `JWT_SECRET` على Render (لكي تستمر الجلسات الحالية).
2. **TTL للـ tokens**: Google id_token صالح لـ 1 ساعة، لكن JWT الذي يُصدره Party4R صالح لـ 30 يوم (راجع `create_token` في server.py).
3. **Email linking**: إذا كان للمستخدم بالفعل حساب بنفس الـ email في DB ومن ثم سجّل بـ Google، سيتم ربط حسابه تلقائياً (لا يُنشأ حساب ثاني).
4. **Conflict**: إذا كان للـ email حساب مرتبط بـ Google sub مختلف، يُرجع 409.

---

## 📦 الملفات ذات الصلة

- `/app/backend/google_auth.py` — التحقق من الـ token + إنشاء/ربط المستخدم
- `/app/backend/.env.example` — قالب البيئة مع GOOGLE_OAUTH_*
- `/app/frontend/src/components/auth/GoogleSignInButton.tsx` — الزر + flow الـ OAuth
- `/app/frontend/src/context/AuthContext.tsx` — `loginWithToken()` لحفظ JWT
- `/app/frontend/app/login.tsx` — يدمج الزر
- `/app/frontend/app/signup.tsx` — يدمج الزر

---

📌 **آخر تحديث**: 2025-06
✅ **حالة الجاهزية**: 100% — كل ما تحتاجه هو لصق Client IDs في `.env`.
