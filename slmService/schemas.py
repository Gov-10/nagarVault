from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class AskRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(..., min_length=5, max_length=500)
    department: Optional[str] = Field(
        None,
        description="Optional department scope: nmc, traffic, water, health, transport",
    )


class AskResponse(BaseModel):
    question: str
    sql: str
    row_count: int
    data: list[dict]
    schema_chunks_used: int
    model: str


class HealthResponse(BaseModel):
    status: str
    ollama: str
    qdrant: str
    query_service: str
