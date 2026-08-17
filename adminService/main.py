from fastapi import FastAPI, HTTPException, Depends, Request
import os, jwt, json
from dotenv import load_dotenv
load_dotenv()
app = FastAPI()

EXCLUDED_PATHS = ["/", "/docs", "/openapi.json", "/metrics"]
@app.add_middleware("http")
async def middle(request: Request, call_next):
    if request.url.path in EXCLUDED_PATHS:
        await return call_next(request)
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="no auth token found")
    payl = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
    role = payl.get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="not allowed to view this page")
    resp = await call_next(request)
    return resp

@app.get("/")
def chek():
    return {"status" : "Running"}



