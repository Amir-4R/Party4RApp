# خطة ترحيل آمنة لـ Party4R: من Render إلى VPS مدفوع

> هذا المستند يوضّح خطوات الترحيل خطوة بخطوة من استضافة Render المجانية (التي تدخل في وضع النوم) إلى سيرفر VPS مدفوع، **بدون أي فقدان لبيانات المستخدمين** (الحسابات، الرسائل، الغرف، نقاط الشرف، إلخ).

---

## 📋 ملخّص الترحيل

| العنصر | المصدر (Render) | الوجهة (VPS) |
|--------|------------------|---------------|
| الخلفية (API) | https://party4rapp.onrender.com | https://api.yourdomain.com |
| قاعدة البيانات | MongoDB Atlas / Render Mongo | MongoDB 7.0 محلي (Docker) أو Atlas |
| تطبيق الهاتف | يستهدف Render | يُعاد بناؤه ليستهدف VPS |
| وقت التوقف المتوقع | < 10 دقائق | — |
| النسخة الاحتياطية | إجبارية قبل البدء | تلقائية يومية |

---

## 🛡 المبادئ الذهبية للترحيل الآمن

1. **لا تحذف Render قبل التأكد 100% من VPS** — احتفظ به نشطًا حتى أسبوع بعد الترحيل.
2. **خذ 3 نسخ احتياطية** (واحدة قبل البدء، واحدة قبل التحويل، واحدة بعد التحقق).
3. **رحّل قاعدة البيانات أولًا**، ثم وجّه التطبيق ثانيًا.
4. **اختبر بمستخدم تجريبي** قبل إعلام المستخدمين الحقيقيين.
5. **قَفِل الكتابة (Read-Only Mode)** أثناء عملية النسخ النهائية لتجنّب تضارب البيانات.

---

## 🚀 الخطوات التفصيلية

### المرحلة 1: التحضير (قبل يوم من الترحيل)

**الهدف**: تجهيز VPS بدون التأثير على Render.

1. اشترِ VPS وفعّل النطاق (راجع `INSTALLATION_GUIDE.md` للتفاصيل).
2. ثبّت Docker و Docker Compose.
3. ارفع كود Party4R إلى المسار `/opt/party4r/`.
4. هيّئ `.env` بنفس قيم Render (خاصة `JWT_SECRET` و `YOUTUBE_API_KEY`).
   > ⚠️ **مهم**: استخدم **نفس** `JWT_SECRET` الموجود في Render، وإلا ستفقد جميع الجلسات النشطة.
5. شغّل `docker compose up -d` على VPS.
6. تحقق: `curl https://api.yourdomain.com/api/health` يجب أن تُرجع `{"status":"ok"}`.

**النتيجة**: VPS يعمل بقاعدة بيانات فارغة، جاهزة لاستقبال البيانات.

---

### المرحلة 2: أخذ نسخة احتياطية كاملة (Backup #1)

من جهازك المحلي أو من Render Shell:
```bash
# اعرف MONGO_URL الحالي من Render Dashboard
export MONGO_URL="mongodb+srv://..."
export DB_NAME="party4r"

# أنشئ نسخة احتياطية مضغوطة
mongodump --uri="$MONGO_URL" --db="$DB_NAME" --archive=party4r-backup-pre-migration.gz --gzip

# تأكد من حجم الملف
ls -lh party4r-backup-pre-migration.gz
```

**احفظ هذا الملف في مكانين على الأقل** (جهازك + Google Drive مثلاً).

---

### المرحلة 3: قفل الكتابة على Render (Read-Only Window)

**الهدف**: منع المستخدمين من إنشاء بيانات جديدة على Render أثناء النسخ النهائي.

#### الخيار أ — تعطيل التسجيل والكتابة عبر متغير بيئة
أضف على Render Dashboard → Environment:
```
MAINTENANCE_MODE=true
```

ثم في `server.py` (إذا لم يكن مُفعّلًا)، يقرأ هذا المتغير ويُرجع 503 لجميع الكتابات.

#### الخيار ب — إيقاف Render مؤقتًا (الأسرع)
من Render Dashboard → Suspend → Yes.
> ⚠️ هذا يقطع الخدمة كليًا. استخدمه فقط لو كان عدد المستخدمين قليلًا أو في ساعة منخفضة الاستخدام.

---

### المرحلة 4: النسخة الاحتياطية النهائية (Backup #2)

بعد قفل الكتابة، خذ نسخة احتياطية ثانية مباشرة:
```bash
mongodump --uri="$MONGO_URL" --db="party4r" \
  --archive=party4r-final-snapshot.gz --gzip
```

هذه هي **النسخة الحقيقية** التي ستُستعاد على VPS.

---

### المرحلة 5: استعادة البيانات على VPS

انسخ الملف إلى VPS واستعد:
```bash
scp party4r-final-snapshot.gz root@your-vps-ip:/tmp/

ssh root@your-vps-ip
cd /opt/party4r/backend

# انسخ النسخة إلى داخل حاوية mongo
docker compose cp /tmp/party4r-final-snapshot.gz mongo:/tmp/snap.gz

# استعد البيانات
docker compose exec mongo mongorestore \
  --archive=/tmp/snap.gz --gzip --drop

# تحقق من عدد المستخدمين
docker compose exec mongo mongosh party4r --eval 'db.users.countDocuments({})'
```

أو استخدم السكربت الجاهز:
```bash
bash /opt/party4r/backend/scripts/restore.sh /tmp/party4r-final-snapshot.gz
```

---

### المرحلة 6: التحقق من سلامة البيانات

تأكد من المعلومات الحرجة:
```bash
docker compose exec mongo mongosh party4r --eval '
  print("Users: "     + db.users.countDocuments({}));
  print("DMs: "       + db.dms.countDocuments({}));
  print("Rooms: "     + db.rooms.countDocuments({}));
  print("Reports: "   + db.reports.countDocuments({}));
  print("Push tokens: " + db.push_tokens.countDocuments({}));
'
```

اختبر تسجيل دخول لمستخدم حقيقي:
```bash
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser1","password":"pass1234"}'
```

يجب أن تحصل على `access_token` صحيح.

---

### المرحلة 7: تحويل التطبيق المحمول

هذه الخطوة تتم في الـ Frontend:

1. عدّل `/app/frontend/.env`:
   ```env
   EXPO_PUBLIC_BACKEND_URL=https://api.yourdomain.com
   ```
2. أعد بناء الـ APK عبر Termux:
   ```bash
   cd ~/party4r-frontend
   bash BUILD_TERMUX.sh
   ```
3. وزّع الـ APK الجديد على المستخدمين (Telegram / WhatsApp / Telegram Channel).

> 💡 **نصيحة**: ضع داخل التطبيق تنبيه "إصدار جديد متوفر" يدفع المستخدمين للتحديث.

---

### المرحلة 8: فترة التحقق (24-72 ساعة)

**لا تُغلق Render** خلال هذه الفترة. راقب:
- سجلات VPS: `docker compose logs -f backend`
- استخدام الذاكرة/المعالج: `docker stats`
- نسخ احتياطي يومي تلقائي: `crontab -l`

إذا اكتشف المستخدمون مشكلة:
- ✅ Render لا يزال يعمل (لو لم تُغلقه) — حوّلهم مؤقتًا.
- ✅ النسخة الاحتياطية متاحة — استعدها على VPS.

---

### المرحلة 9: إيقاف Render نهائيًا

بعد التأكد التام (3-7 أيام مستقرة):
1. خذ نسخة احتياطية أخيرة من Render (Backup #3 — أرشيف).
2. اذهب إلى Render Dashboard → Settings → Delete Service.
3. أغلق MongoDB Atlas القديم (إن كان منفصلًا عن VPS).
4. احتفظ بـ Backup #3 لمدة 30 يومًا على الأقل.

---

## 🔄 خطة العودة (Rollback Plan)

إذا حدث خطأ كارثي بعد الترحيل:

### السيناريو 1: مشكلة في VPS — استعادة Render
```bash
# 1. أعد تشغيل Render Service من Dashboard
# 2. أعِد توجيه DNS مؤقتًا:
#    عدّل سجل A لـ api.yourdomain.com إلى Render IP
#    (أو غيّر EXPO_PUBLIC_BACKEND_URL إلى رابط Render مباشرة)
# 3. ابنِ APK طارئ ووزّعه
```

### السيناريو 2: فقدان بيانات على VPS — استعادة من Backup
```bash
ssh root@your-vps-ip
cd /opt/party4r/backend
bash scripts/restore.sh /path/to/party4r-final-snapshot.gz
docker compose restart backend
```

### السيناريو 3: VPS سقط بالكامل
```bash
# 1. اشترِ VPS جديدًا بسرعة (Hetzner: 60 ثانية لإنشاء instance)
# 2. اتبع INSTALLATION_GUIDE.md من البداية
# 3. استعد آخر نسخة احتياطية (يتم تخزينها يوميًا في /opt/party4r/backend/backups/)
```

---

## ✅ قائمة تحقّق نهائية (Checklist)

قبل الإعلان عن نجاح الترحيل، تأكد من:

- [ ] `curl https://api.yourdomain.com/api/health` يُرجع `{"status":"ok"}`
- [ ] تسجيل دخول مستخدم حقيقي يعمل
- [ ] قراءة الرسائل الخاصة تعمل
- [ ] إنشاء غرفة جديدة + الانضمام عبر WebSocket يعمل
- [ ] إشعارات Push تصل (اختبار من جهاز فعلي)
- [ ] لوحات المتصدرين تعرض بيانات
- [ ] عدد المستخدمين في VPS = عدد المستخدمين في Render قبل الترحيل
- [ ] النسخ الاحتياطي اليومي مفعّل في cron
- [ ] جدار الحماية (UFW) مفعّل
- [ ] شهادة SSL صالحة (لون قفل أخضر في المتصفح)
- [ ] `JWT_SECRET` على VPS = `JWT_SECRET` على Render (للحفاظ على الجلسات)

---

## 📅 جدول زمني مقترح

| اليوم | المهمة | الوقت المتوقع |
|------|--------|----------------|
| -1 | شراء VPS، تثبيت Docker، رفع الكود، اختبار `/api/health` | 1-2 ساعة |
| 0  | Backup #1، قفل الكتابة، Backup #2، الاستعادة، التحقق، تحويل DNS | 30-60 دقيقة |
| 0  | بناء APK جديد، توزيعه | 1 ساعة |
| +1 إلى +7 | مراقبة، إصلاح أي مشاكل، الإبقاء على Render احتياطيًا | يومية |
| +7 | حذف Render نهائيًا (مع الاحتفاظ بـ Backup #3) | 10 دقائق |

---

## 🆘 إذا احتجت مساعدة

راجع:
- `INSTALLATION_GUIDE.md` — تفاصيل الإعداد الأولي
- `scripts/backup.sh` — كيفية النسخ الاحتياطي
- `scripts/restore.sh` — كيفية الاستعادة
- `scripts/migrate-from-render.sh` — سكربت تلقائي للترحيل
- `Caddyfile` — إعدادات SSL والـ Reverse Proxy
- `docker-compose.yml` — تكوين الحاويات

---

📌 **آخر تحديث**: 2025-06
🔐 **مستوى الأمان**: جميع البيانات تُنقل عبر اتصالات مشفرة (TLS).
💾 **معدل فقدان البيانات المتوقع**: 0% (مع اتباع الخطوات أعلاه).
