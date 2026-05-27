import os
from fastapi import FastAPI, HTTPException
from pymongo import MongoClient

app = FastAPI()

# سحب رابط قاعدة البيانات بأمان من إعدادات Render
MONGO_URI = os.getenv("MONGO_URI")

try:
    # الاتصال بقاعدة البيانات
    client = MongoClient(MONGO_URI)
    # اسم قاعدة البيانات (يمكنك تغييره للاسم الذي تحبه)
    db = client["Party4R_DB"] 
    print("Connected to MongoDB successfully!")
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")

@app.get("/")
def read_root():
    return {"status": "Party4R Server is Running Successfully!"}

# نقطة اختبار للتأكد من أن السيرفر يقرأ ويكتب في قاعدة البيانات
@app.get("/test-db")
def test_database():
    if MONGO_URI is None:
        raise HTTPException(status_code=500, detail="MONGO_URI variable is missing in Render settings!")
    
    try:
        # تجربة إدخال مستند بسيط في جدول اسمه test_collection
        test_collection = db["test_collection"]
        test_collection.insert_one({"message": "Hello from Party4R!", "status": "success"})
        return {"database_status": "Connected and writing successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

