import os
import httpx
from fastapi import HTTPException
from dotenv import load_dotenv
load_dotenv()

QUERY_SERVICE_URL = os.getenv("QUERY_SERVICE_URL", "http://localhost:4003")


async def execute_sql(sql: str, auth_token: str) -> dict:
    url = f"{QUERY_SERVICE_URL}/query"
    headers = {"Authorization": auth_token, "Content-Type": "application/json"}
    payload = {"sql_query": sql}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if not resp.is_success:
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                detail = body.get("detail", f"Query service returned {resp.status_code}")
                raise HTTPException(status_code=resp.status_code, detail=detail)
            return resp.json()
    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Query service is unreachable. Ensure it is running at " + QUERY_SERVICE_URL,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Query service error: {str(exc)}")


async def check_health() -> str:
    url = f"{QUERY_SERVICE_URL}/"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return "up"
    except Exception:
        return "down"
