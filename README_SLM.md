# NagarVault SLM Query Engine

Natural language querying for NagarVault civic data, powered by local LLMs running fully air-gapped on your Kubernetes cluster.

Ask questions like *"How many open waterlogging complaints are in Zone 5?"* and get back the SQL query and live results — with no data ever leaving your server.

---

## How it works

The SLM engine sits between your users and the database, handling the full NL → SQL → Results pipeline:

```
User question
    ↓
slmService  (BGE-M3 embed → Qdrant RAG → Qwen3:2b SQL generation)
    ↓
queryService  (sqlglot AST validation + RBAC enforcement)
    ↓
PostgreSQL
    ↓
Results back to user
```

**Two new services were added:**

| Service | Port | Purpose |
|---|---|---|
| `slmService` | 4004 | Accepts natural language questions, runs RAG, calls Qwen3:2b, returns SQL + results |
| `schemaIndexer` | 4005 | Embeds schema docs into Qdrant for RAG retrieval. Runs once on deploy, re-triggerable via admin API |

**Models used:**

| Model | Purpose | RAM needed |
|---|---|---|
| `bge-m3` | Dense text embeddings for RAG retrieval | ~600 MB |
| `qwen3:2b` | SQL generation from natural language | ~2 GB (Q4 quantized) |

---

## Prerequisites

Before starting, ensure you have:

- **Operating system**: Linux, macOS, or Windows (WSL2 recommended on Windows)
- **Docker Desktop** v4.20 or later with Docker Compose v2
- **RAM**: 8 GB minimum, 16 GB recommended
- **Disk space**: ~6 GB free for model weights (bge-m3 ~600 MB + qwen3:2b ~1.8 GB) plus container images
- **Ollama**: installed separately (see Step 1)

---

## Step 1 — Install Ollama

Ollama runs the LLMs locally on your machine or server. It must be installed as a system process so its HTTP API is available on port 11434.

**macOS:**
```bash
brew install ollama
```

Or download the macOS app from https://ollama.com/download

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

This installs the `ollama` binary and sets up a systemd service that starts automatically.

**Windows:**
Download and run the installer from https://ollama.com/download/windows

After installation, Ollama runs as a background service. Verify it is working:

```bash
ollama --version
# Expected output: ollama version 0.x.x

curl http://localhost:11434/api/tags
# Expected output: {"models":[...]}
```

---

## Step 2 — Pull the models

Pull both models before starting the stack. This downloads the weights to Ollama's local model store.

```bash
ollama pull bge-m3
ollama pull qwen3:2b
```

BGE-M3 is around 600 MB. Qwen3:2b is around 1.8 GB in Q4 quantization. Depending on your connection, this takes 2–10 minutes.

Verify both models are available:

```bash
ollama list
```

You should see both `bge-m3:latest` and `qwen3:2b:latest` in the output.

**Test a quick embedding to confirm bge-m3 works:**

```bash
curl http://localhost:11434/api/embed \
  -d '{"model": "bge-m3", "input": "waterlogging complaints in zone 5"}'
```

The response should include an `"embeddings"` array with 1024 floats.

**Test SQL generation to confirm qwen3:2b works:**

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:2b",
  "stream": false,
  "think": false,
  "options": {"temperature": 0},
  "messages": [
    {"role": "system", "content": "Return only a SQL SELECT query. No explanation."},
    {"role": "user", "content": "Count all rows in a table called nmc_complaints"}
  ]
}'
```

The response `message.content` should contain something like `SELECT COUNT(*) FROM nmc_complaints;`

---

## Step 3 — Local development setup

### 3a. Configure environment files

Copy the example env files for the two new services:

```bash
cp slmService/.env.example slmService/.env
cp schemaIndexer/.env.example schemaIndexer/.env
```

The defaults work for local Docker Compose. The only value you may need to change is `JWT_SECRET` — it must match across all services.

For the SLM service, `slmService/.env` should look like:

```
OLLAMA_URL=http://ollama:11434
QDRANT_URL=http://qdrant:6333
QUERY_SERVICE_URL=http://query-service:4003
JWT_SECRET=change-me
```

> **Note:** When running locally with `docker compose`, `OLLAMA_URL` should point to the `ollama` container. If you run Ollama on the host and services in Docker, use `http://host.docker.internal:11434` instead.

### 3b. Start the full stack

From the repo root:

```bash
docker compose up --build
```

This will:
1. Start Ollama, Qdrant, and PostgreSQL
2. Wait for Ollama to pass its health check (up to 2 minutes on first start)
3. Start the `schema-indexer` which embeds all 40 schema chunks and loads them into Qdrant
4. Start all other services

Watch the indexer logs to confirm it completes:

```bash
docker compose logs schema-indexer --follow
```

Expected output:

```
Loaded 40 schema chunks from schema_docs.json
  Created collection 'nagar_schema'
  Embedded 8/40 chunks
  Embedded 16/40 chunks
  Embedded 24/40 chunks
  Embedded 32/40 chunks
  Embedded 40/40 chunks
Indexed 40/40 chunks into Qdrant collection 'nagar_schema'
```

### 3c. Verify Qdrant collection

Open http://localhost:6333/dashboard in your browser. You should see a collection named `nagar_schema` with 40 vectors.

Alternatively, check via the REST API:

```bash
curl http://localhost:6333/collections/nagar_schema
```

The response should include `"vectors_count": 40`.

### 3d. Verify the SLM service is healthy

```bash
curl http://localhost:4004/health
```

Expected response:

```json
{
  "status": "healthy",
  "ollama": "up",
  "qdrant": "up",
  "query_service": "up"
}
```

If any component shows `"down"`, check its container logs with `docker compose logs <service-name>`.

---

## Step 4 — Test the endpoint

The SLM service requires a valid JWT in the `Authorization` header, issued by the `authService`.

### 4a. Create a test user and obtain a token

First, create a user via the auth service:

```bash
curl -c cookies.txt -X POST http://localhost:4000/create \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test Officer",
    "username": "test_officer",
    "user_id": "USR-001",
    "password": "testpassword",
    "role": "nmc_officer"
  }'
```

Log in to get a session cookie:

```bash
curl -c cookies.txt -X POST http://localhost:4000/login \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "test_officer",
    "user_id": "USR-001",
    "password": "testpassword",
    "role": "nmc_officer"
  }'
```

For the SLM service, you need the raw JWT token. Either extract it from the cookie, or for testing purposes, generate one directly using `JWT_SECRET` from your `.env`.

### 4b. Ask a natural language question

```bash
curl -X POST http://localhost:4004/ask \
  -H 'Content-Type: application/json' \
  -H 'Authorization: <your-jwt-token>' \
  -d '{
    "question": "How many open complaints are in Zone 5?",
    "department": "nmc"
  }'
```

Expected response shape:

```json
{
  "question": "How many open complaints are in Zone 5?",
  "sql": "SELECT COUNT(*) FROM nmc_complaints WHERE status = 'open' AND ward_id = 'ZONE-5';",
  "row_count": 1,
  "data": [{"count": 42}],
  "schema_chunks_used": 5,
  "model": "qwen3:2b"
}
```

### 4c. Ask without a department scope

Omitting `department` searches across all schema chunks:

```bash
curl -X POST http://localhost:4004/ask \
  -H 'Content-Type: application/json' \
  -H 'Authorization: <your-jwt-token>' \
  -d '{
    "question": "Which zones have the most unresolved issues across all departments?"
  }'
```

---

## Step 5 — Running services individually (for debugging)

If you want to run a service outside Docker during development:

```bash
# 1. Start infrastructure only
docker compose up -d ollama qdrant postgres

# 2. Set up and run the schema indexer
cd schemaIndexer
cp .env.example .env
# Edit .env: set OLLAMA_URL=http://localhost:11434 and QDRANT_URL=http://localhost:6333
pip install -r requirements.txt
python index.py       # one-shot indexing
# Or run as an API:
uvicorn main:app --host 0.0.0.0 --port 4005 --reload

# 3. Run the SLM service
cd ../slmService
cp .env.example .env
# Edit .env: set all URLs to localhost variants
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 4004 --reload
```

**Re-index the schema without restarting:**

```bash
curl -X POST http://localhost:4005/reindex
# Response: {"status": "ok", "chunks_indexed": 40}
```

**Trigger re-index via the admin service (requires admin JWT cookie):**

```bash
curl -b cookies.txt -X POST http://localhost:4001/vector/resync
# Response: {"status": "success", "message": "Schema re-indexing complete.", "chunks_indexed": 40}
```

---

## Step 6 — Production deployment on Kubernetes

This section covers deploying the SLM engine on a local Kubernetes cluster (e.g. k3s, k0s, or RKE2) as described in the NagarVault architecture.

### 6a. Ollama Deployment

Ollama runs as a Deployment with a PersistentVolumeClaim for model storage. On a GPU node, add a node selector and resource limit.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: nagar
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      # Uncomment for GPU node:
      # nodeSelector:
      #   accelerator: nvidia-gpu
      volumes:
        - name: ollama-storage
          persistentVolumeClaim:
            claimName: ollama-pvc
      containers:
        - name: ollama
          image: ollama/ollama:latest
          ports:
            - containerPort: 11434
          volumeMounts:
            - name: ollama-storage
              mountPath: /root/.ollama
          resources:
            requests:
              memory: "4Gi"
              cpu: "2"
            limits:
              memory: "8Gi"
              cpu: "4"
          # Uncomment for GPU:
          # resources:
          #   limits:
          #     nvidia.com/gpu: 1
          readinessProbe:
            httpGet:
              path: /api/tags
              port: 11434
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ollama-pvc
  namespace: nagar
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: nagar
spec:
  selector:
    app: ollama
  ports:
    - port: 11434
      targetPort: 11434
```

> **Important:** After Ollama starts, you must pull the models into the running pod. Run this once per cluster:
>
> ```bash
> kubectl exec -n nagar deployment/ollama -- ollama pull bge-m3
> kubectl exec -n nagar deployment/ollama -- ollama pull qwen3:2b
> ```

### 6b. Qdrant StatefulSet

Qdrant runs as a StatefulSet to ensure stable storage across restarts.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: qdrant
  namespace: nagar
spec:
  serviceName: qdrant
  replicas: 1
  selector:
    matchLabels:
      app: qdrant
  template:
    metadata:
      labels:
        app: qdrant
    spec:
      containers:
        - name: qdrant
          image: qdrant/qdrant:latest
          ports:
            - containerPort: 6333
            - containerPort: 6334
          volumeMounts:
            - name: qdrant-storage
              mountPath: /qdrant/storage
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
  volumeClaimTemplates:
    - metadata:
        name: qdrant-storage
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 5Gi
---
apiVersion: v1
kind: Service
metadata:
  name: qdrant
  namespace: nagar
spec:
  selector:
    app: qdrant
  ports:
    - name: http
      port: 6333
      targetPort: 6333
    - name: grpc
      port: 6334
      targetPort: 6334
```

### 6c. Schema Indexer as a Kubernetes Job

The schema indexer runs once per deployment. Use a Kubernetes Job so it completes and exits cleanly.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: schema-indexer
  namespace: nagar
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: schema-indexer
          image: your-registry/nagar-schema-indexer:latest
          command: ["python", "index.py"]
          env:
            - name: OLLAMA_URL
              value: "http://ollama.nagar.svc.cluster.local:11434"
            - name: QDRANT_URL
              value: "http://qdrant.nagar.svc.cluster.local:6333"
```

To re-index after schema changes, delete and re-apply the job:

```bash
kubectl delete job schema-indexer -n nagar
kubectl apply -f schema-indexer-job.yaml
```

Or use the admin service endpoint (see Step 5) to trigger re-indexing without any kubectl commands. The schema-indexer service also runs as a long-lived deployment alongside the job for HTTP-triggered re-indexing.

### 6d. SLM Service Deployment

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nagar-secrets
  namespace: nagar
type: Opaque
stringData:
  jwt-secret: "your-production-jwt-secret-minimum-32-chars"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: slm-service
  namespace: nagar
spec:
  replicas: 1
  selector:
    matchLabels:
      app: slm-service
  template:
    metadata:
      labels:
        app: slm-service
    spec:
      containers:
        - name: slm-service
          image: your-registry/nagar-slm-service:latest
          ports:
            - containerPort: 4004
          env:
            - name: OLLAMA_URL
              value: "http://ollama.nagar.svc.cluster.local:11434"
            - name: QDRANT_URL
              value: "http://qdrant.nagar.svc.cluster.local:6333"
            - name: QUERY_SERVICE_URL
              value: "http://query-service.nagar.svc.cluster.local:4003"
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: nagar-secrets
                  key: jwt-secret
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 4004
            initialDelaySeconds: 10
            periodSeconds: 15
---
apiVersion: v1
kind: Service
metadata:
  name: slm-service
  namespace: nagar
spec:
  selector:
    app: slm-service
  ports:
    - port: 4004
      targetPort: 4004
```

### 6e. Building and pushing images

Tag and push your images to your private registry before applying the manifests:

```bash
docker build -t your-registry/nagar-slm-service:latest ./slmService
docker build -t your-registry/nagar-schema-indexer:latest ./schemaIndexer
docker push your-registry/nagar-slm-service:latest
docker push your-registry/nagar-schema-indexer:latest
```

For a fully air-gapped cluster with no external registry, load images directly:

```bash
docker save your-registry/nagar-slm-service:latest | ssh k8s-node docker load
```

Or use `k3s ctr images import` / `crictl` depending on your container runtime.

---

## Troubleshooting

### `503 Ollama is unreachable`

The `slmService` cannot reach Ollama. Check:

```bash
docker compose logs ollama
# or in k8s:
kubectl logs -n nagar deployment/ollama
```

In Docker Compose, ensure `OLLAMA_URL=http://ollama:11434` (not `localhost`). If Ollama is running on the host and your service is in Docker, use `http://host.docker.internal:11434`.

### `503 Schema index is empty`

The Qdrant collection `nagar_schema` has no vectors. The schema indexer did not run successfully. Check its logs:

```bash
docker compose logs schema-indexer
```

Common causes:
- Ollama was not healthy when the indexer ran (retry with `docker compose restart schema-indexer`)
- `bge-m3` model was not pulled before the stack started

To manually trigger re-indexing:

```bash
curl -X POST http://localhost:4005/reindex
```

### Generated SQL is always blocked (`403`)

The `queryService` is rejecting the SQL. This has three causes:

1. **Wrong role in JWT** — the question involves a table that requires a specific role (e.g. `health_camp_records` requires `ROLE_HEALTH_OFFICER`). Check the JWT claims.
2. **PII column in SQL** — Qwen3 generated a query referencing `name`, `phone`, `email`, `address`, or `aadhaar`. Add more explicit schema context to `schema_docs.json` warning against those columns.
3. **Non-SELECT generated** — rare, but the model generated a non-SELECT statement. The system prompt forbids this, but if it happens, check the `[ask] generated_sql` log line in `slmService` container logs.

### SQL generation is very slow

On CPU-only hardware, Qwen3:2b takes 10–30 seconds per query. This is expected. Options:

- Add a GPU node and configure Ollama with `nvidia.com/gpu: 1` resource limit (see Step 6a). With a GPU, generation drops to under 2 seconds.
- Accept the latency if the deployment is internal-only and throughput requirements are low.

### `bge-m3` not found in Ollama

You forgot to pull the model before starting the indexer:

```bash
ollama pull bge-m3
ollama pull qwen3:2b
```

In a Kubernetes environment, run these inside the Ollama pod (see Step 6a init command).

### Qdrant dashboard shows 0 vectors after indexing

The indexer ran but could not reach Qdrant. Check the `QDRANT_URL` env var matches the actual Qdrant service name on your network. In Docker Compose this is `http://qdrant:6333`. In Kubernetes it is `http://qdrant.<namespace>.svc.cluster.local:6333`.

---

## Model choices

**BGE-M3** (BAAI/bge-m3) is a multilingual embedding model from the Beijing Academy of AI. It was chosen because:
- Strong performance on technical and schema-like text
- 1024-dimensional dense vectors with good semantic precision
- Runs efficiently on CPU (no GPU required for inference at indexing time)
- Multilingual support means it handles Marathi/Hindi place names and civic terminology gracefully

**Qwen3:2b** is Alibaba's third-generation instruction-tuned small language model. The 2B variant was chosen because:
- Smallest Qwen3 variant that performs reliably at code and SQL generation
- Fits in under 2 GB RAM at Q4_K_M quantization, keeping the deployment footprint minimal
- Supports `"think": false` to disable chain-of-thought output, giving clean, predictable SQL responses
- Good at following strict output-format instructions (return only SQL, no prose)

Both models are available via `ollama pull` with no additional licensing requirements for on-premises civic use.
