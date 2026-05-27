from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "Party4R Server is Running Successfully!"}
