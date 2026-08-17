from fastapi import FastAPI
from index import run_index

app = FastAPI()


@app.get("/")
def chek():
    return {"status": "Running"}


@app.post("/reindex")
async def reindex():
    chunks_indexed = await run_index()
    return {"status": "ok", "chunks_indexed": chunks_indexed}
