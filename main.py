import os
from fastapi import FastAPI, HTTPException
import uvicorn
import pymongo

app = FastAPI(title="My First Render App")

# 1. سحب الرابط السري تلقائياً من سيرفر Render
MONGO_DETAILS = os.environ.get("MONGO_URI")

# 2. إعداد الاتصال بقاعدة البيانات
try:
    if not MONGO_DETAILS:
        raise ValueError("خطأ: لم يتم العثور على متغير MONGO_URI في البيئة!")
    
    client = pymongo.MongoClient(MONGO_DETAILS)
    db = client["my_database"]  # اسم قاعدة البيانات
    collection = db["users"]     # اسم الجدول (Collection)
    print("تم الاتصال بـ MongoDB بنجاح!")
except Exception as e:
    print(f"فشل الاتصال بقاعدة البيانات: {e}")
    collection = None

# الصفحة الرئيسية للتطبيق (تأكيد التشغيل)
@app.get("/")
def read_root():
    return {
        "status": "التطبيق يعمل بنجاح أونلاين!",
        "database_connected": collection is not None
    }

# نقطة اتصال تجريبية لإضافة مستخدم وتخزينه في قاعدة البيانات
@app.get("/add-user/{name}")
def add_user(name: str):
    if collection is None:
        raise HTTPException(status_code=500, detail="قاعدة البيانات غير متصلة")
    
    try:
        # إدخال البيانات في MongoDB
        user_data = {"name": name, "status": "active"}
        result = collection.insert_one(user_data)
        
        return {
            "message": f"تم حفظ المستخدم {name} بنجاح في قاعدة البيانات!",
            "inserted_id": str(result.inserted_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء الحفظ: {str(e)}")

# أمر تشغيل السيرفر تلقائياً
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 10000)), reload=True)
