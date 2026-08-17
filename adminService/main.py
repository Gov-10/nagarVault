from fastapi import FastAPI, HTTPException, Depends, Request
import os, jwt, json, httpx, asyncpg
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()
app = FastAPI()
JAEGER_URL, QDRANT_URL = os.getenv("JAEGER_URL"), os.getenv("QDRANT_URL")
EXCLUDED_PATHS = ["/", "/docs", "/openapi.json", "/metrics"]
@app.middleware("http")
async def middle(request: Request, call_next):
    if request.url.path in EXCLUDED_PATHS:
        return await call_next(request)
    token = request.cookies.get("session_token")
    if not token:
        return JSONResponse(status_code=401, content={"detail" : "no auth token found"})
    payl = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
    role = payl.get("role")
    if role != "admin":
        return JSONResponse(status_code=403, content={"detail": "not allowed to view this page"})
    if datetime.utcnow() > payl.get("exp"):
        return JSONResponse(status_code=401, content={"detail": "token expired"})
    resp = await call_next(request)
    return resp

@app.get("/")
def chek():
    return {"status" : "Running"}

@app.get("/health/cluster")
async def cluster_heal():
    status_report = {"postgres": "UNKNOWN", "qdrant": "UNKNOWN", "jaeger": "UNKNOWN"}
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{QDRANT_URL}/healthz")
            status_report["qdrant"] = "UP" if res.status_code==200 else "DOWN"
        except Exception:
            status_report["qdrant"] = "UNREACHABLE"
        try:
            res = await client.get(f"{JAEGER_URL}")
            status_report["jaeger"] = "UP" if res.status_code==200 else "DOWN"
        except Exception:
            status_report["jaeger"] = "UNREACHABLE"
    return {"status" : "evaluated", "components": status_report}


@app.get("/audit-logs")
async def get_audit(limit: int= Query(50, le=200), status_filter: str= Query(None, description="ALLOWED or BLOCKED")):
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    try:
        if status_filter:
            query = "SELECT * FROM audit_logs WHERE status = $1 ORDER BY timestamp DESC LIMIT $2"
            rows = await conn.fetch(query, status_filter.upper(), limit)
        else:
            query = "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1"
            rows = await conn.fetch(query, limit)
        return {"count": len(rows), "logs": [dict(r) for r in rows]}
    finally:
        await conn.close()

@app.post("/vector/resync")
async def trigger():
    return {"status": "success", "message": "Schema re-indexing task queued for Qdrant."}

@app.post("/dlq")
async def list_dlq():
    return {"dlq_topic": "complaints.dlq.topic", "pending_messages": 3, "items": [{"id": "msg_01", "reason": "Malformed JSON payload from Water Sensor W-102", "timestamp": "2026-08-17T17:10:00Z"},{"id": "msg_02", "reason": "Missing ward_id mapping", "timestamp": "2026-08-17T17:22:00Z"}]}


@app.get("/traces/slow-queries")
async def get_slow(min_duration: int=500):
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(f"{JAEGER_URL}/api/traces", params={"service": "query-service", "minDuration": f"{min_duration_ms}ms", "limit": 20})
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to query Jaeger trace engine: {str(e)}")



