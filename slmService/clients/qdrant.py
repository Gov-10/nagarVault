import os
from fastapi import HTTPException
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, QueryRequest
from dotenv import load_dotenv
load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "nagar_schema"

_client: AsyncQdrantClient | None = None


def get_client() -> AsyncQdrantClient:
    global _client
    if _client is None:
        _client = AsyncQdrantClient(url=QDRANT_URL)
    return _client


async def search_schema(
    vector: list[float],
    top_k: int = 5,
    department: str | None = None,
) -> list[str]:
    client = get_client()
    query_filter = None
    if department:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="department",
                    match=MatchValue(value=department),
                )
            ]
        )
    try:
        results = await client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            limit=top_k,
            query_filter=query_filter,
            with_payload=True,
        )
        return [hit.payload["text"] for hit in results.points]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Qdrant search failed: {str(exc)}")


async def check_health() -> str:
    client = get_client()
    try:
        await client.get_collections()
        return "up"
    except Exception:
        return "down"
