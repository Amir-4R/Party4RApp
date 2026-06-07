# دليل تثبيت Party4R على سيرفر مدفوع (VPS)

> هذا الدليل يشرح كيفية نشر الخلفية (Backend) الخاصة بتطبيق **Party4R** على أي خادم افتراضي خاص (VPS) مدفوع مثل DigitalOcean أو Hetzner أو Contabo أو AWS Lightsail بدون أي خدمات مجانية تدخل في وضع النوم (Sleep Mode).

المكدّس التقني (Stack):
- **Backend**: FastAPI + Uvicorn (Python 3.11.9)
- **Database**: MongoDB 7.0 (داخل Docker أو MongoDB Atlas)
- **Reverse Proxy + SSL**: Caddy 2.8 (HTTPS تلقائي مع Let's Encrypt)
- **التحزيم**: Docker + Docker Compose

---

## 1. متطلبات السيرفر المُوصى بها

| المورد | الحد الأدنى | المُوصى به |
|--------|-------------|------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| التخزين | 20 GB SSD | 40 GB SSD |
| النطاق التراسلي | 1 TB/شهر | 2 TB/شهر |
| نظام التشغيل | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

### أفضل بنية استضافة لـ Party4R (Gaming + Chat + Leaderboard + Google Login + Cloud Sync + Notifications + Tournaments)

**التوصية:** VPS واحد بسعة 2vCPU/2GB + قاعدة بيانات MongoDB Atlas مجانية (M0) كنسخة احتياطية، مع Caddy لإدارة SSL تلقائيًا.

- مزوّدون مُوصى بهم (مرتبة من الأرخص للأغلى):
  - **Hetzner Cloud CPX11** — 2 vCPU / 2 GB / 40 GB SSD ≈ 4.5€/شهر
  - **Contabo VPS S** — 4 vCPU / 8 GB / 50 GB SSD ≈ 5€/شهر
  - **DigitalOcean Droplet Basic** — 2 vCPU / 2 GB ≈ 12$/شهر
  - **AWS Lightsail** — 2 vCPU / 2 GB ≈ 10$/شهر

> 💡 **نصيحة**: ابدأ بـ Hetzner CPX11 — فيه أفضل قيمة مقابل السعر ولن يدخل وضع النوم أبدًا.

---

## 2. التثبيت السريع (5 خطوات)

### الخطوة 1: تجهيز الخادم
```bash
# اتصل بالخادم عبر SSH
ssh root@your-vps-ip

# تحديث النظام
apt update && apt upgrade -y

# تثبيت Docker و Docker Compose
apt install -y docker.io docker-compose-plugin curl git
systemctl enable --now docker
```

### الخطوة 2: تنزيل المشروع
```bash
mkdir -p /opt/party4r && cd /opt/party4r

# عبر git
git clone https://github.com/YOUR_USERNAME/party4r.git .

# أو رفع ملفات backend/ يدويًا عبر scp/rsync
```

### الخطوة 3: إعداد متغيرات البيئة
```bash
cd /opt/party4r/backend
cp .env.example .env
nano .env
```

املأ القيم التالية كحد أدنى:
```env
MONGO_URL=mongodb://mongo:27017
DB_NAME=party4r
JWT_SECRET=<شغّل: openssl rand -hex 32>
YOUTUBE_API_KEY=<مفتاحك من Google Cloud Console>
PUBLIC_DOMAIN=api.yourdomain.com
ADMIN_EMAIL=you@example.com
CORS_ORIGINS=*
ADMIN_USERNAMES=youradminuser
```

### الخطوة 4: توجيه النطاق (DNS)
في لوحة تحكم النطاق الخاص بك:
- أضف سجل **A** يربط `api.yourdomain.com` بـ IP السيرفر.
- انتظر 1-5 دقائق حتى ينتشر DNS.

### الخطوة 5: تشغيل التطبيق
```bash
cd /opt/party4r/backend
docker compose up -d

# تأكد من حالة الحاويات
docker compose ps

# اختبر السيرفر
curl https://api.yourdomain.com/api/health
# يجب أن تحصل على: {"status":"ok","db":"ok"}
```

---

## 3. معمارية الحاويات

```
┌─────────────────────────────────────────────┐
│             Internet (HTTPS:443)            │
└────────────────────┬────────────────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│  Caddy (Reverse Proxy + Auto-SSL via LE)    │
│  - يستمع على :80 و :443                      │
│  - يوجّه /api/* إلى backend:8001              │
│  - يدعم WebSockets للغرف                     │
└────────────────────┬────────────────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│       FastAPI Backend (uvicorn × 2)         │
│       - يستمع داخليًا على :8001              │
│       - 69 route (Auth, DMs, Rooms,         │
│         Voting, Push, Leaderboard,          │
│         Tournaments, Cloud Sync, Google)    │
└────────────────────┬────────────────────────┘
                     ▼
┌─────────────────────────────────────────────┐
│         MongoDB 7.0 (volume persistent)     │
│         - بيانات على mongo_data volume      │
│         - منفذ غير مكشوف للخارج (داخلي)     │
└─────────────────────────────────────────────┘
```

---

## 4. التحقق من النشر

تأكد من أن جميع المسارات تعمل:
```bash
# 1) الصحة
curl https://api.yourdomain.com/api/health

# 2) إنشاء مستخدم
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"pass1234","nickname":"Test"}'

# 3) تسجيل دخول
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"pass1234"}'

# 4) لوحات المتصدرين
curl https://api.yourdomain.com/api/leaderboard/honor
```

---

## 5. النسخ الاحتياطي التلقائي

فعّل النسخ الاحتياطي اليومي:
```bash
chmod +x /opt/party4r/backend/scripts/backup.sh
crontab -e
# أضف السطر:
0 3 * * * /opt/party4r/backend/scripts/backup.sh >> /var/log/party4r-backup.log 2>&1
```

---

## 6. تحديث الـ Backend

عند الحاجة لتحديث الكود:
```bash
cd /opt/party4r
git pull
cd backend
docker compose build backend
docker compose up -d backend
```

أو في حالة الاستضافة بدون git (رفع يدوي):
```bash
# ارفع الملفات عبر scp ثم:
docker compose build backend && docker compose up -d backend
```

---

## 7. مراقبة السجلات

```bash
# جميع الخدمات
docker compose logs -f

# الخلفية فقط
docker compose logs -f backend

# قاعدة البيانات فقط
docker compose logs -f mongo
```

---

## 8. ربط التطبيق المحمول بالسيرفر الجديد

في تطبيق Party4R على هاتفك:
1. افتح ملف `.env` داخل `/app/frontend/`.
2. عدّل القيمة:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://api.yourdomain.com
   ```
3. أعد بناء الـ APK من Termux باستخدام `BUILD_TERMUX.sh`.

> ⚠️ **مهم**: لا تضع `/api` في نهاية الـ URL. الكود يضيفها تلقائيًا.

---

## 9. جدار الحماية (UFW)

أمّن السيرفر بفتح المنافذ الضرورية فقط:
```bash
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP (لتجديد SSL)
ufw allow 443/tcp       # HTTPS
ufw enable
```

---

## 10. حل المشكلات الشائعة

| المشكلة | الحل |
|---------|------|
| `caddy: cannot get certificate` | تأكد من أن DNS يشير لـ IP الصحيح وأن المنفذ 80 مفتوح |
| `backend: pymongo.errors.ServerSelectionTimeoutError` | تحقق أن `MONGO_URL=mongodb://mongo:27017` (ليس localhost) |
| `403 / 404 من Caddy` | راجع أن `PUBLIC_DOMAIN` في `.env` يطابق النطاق الفعلي |
| التطبيق يعرض 404 على `/api/api/...` | عدّل `EXPO_PUBLIC_BACKEND_URL` لإزالة `/api` من النهاية |

---

## 11. الميزات المتاحة بعد النشر

بعد الإقلاع، تتوفر **69 نقطة API** بما فيها:
- ✅ تسجيل دخول كلاسيكي + Google OAuth (`/api/auth/google/exchange`)
- ✅ غرف مشاهدة جماعية + WebSocket (`/api/ws/rooms/{id}`)
- ✅ رسائل خاصة بـ TTL (`/api/dms`)
- ✅ تصويت داخل الغرف (`/api/rooms/{id}/votes/*`)
- ✅ لوحات متصدرين (`/api/leaderboard/honor`, `/api/leaderboard/watch_time`, `/api/leaderboard/hosts`)
- ✅ بطولات (`/api/tournaments`)
- ✅ مزامنة سحابية (`/api/cloud/sync`)
- ✅ إشعارات Push عبر Expo (`/api/push/token`)
- ✅ نظام الإبلاغ والإشراف + Honor Points

---

📌 **آخر تحديث**: 2025-06
📞 **الدعم**: راجع `MIGRATION_PLAN.md` لخطة الترحيل من Render.
