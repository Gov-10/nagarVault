# NagarVault Common Ingestion Service

Node.js/Express backend for the NagarVault ingestion pipeline. It handles presigned MinIO upload URLs and Kafka event publishing, backed by Redis for durable deduplication.

## What it does

```text
JSON-only event:
Browser -> POST /api/v1/events -> API -> Kafka

Event with media:
Browser -> POST /api/v1/uploads/presign -> API
Browser -> PUT presigned URL -> MinIO
Browser -> POST /api/v1/events with object references -> API -> Kafka
```

The API never proxies image, audio, or video bytes. It validates upload intents, verifies that each object exists in MinIO (size + ETag check), and publishes only durable `bucket`/`objectKey` references to Kafka.

## Authentication

All `/api/v1/*` routes require a valid JWT. Include it as:
- `Authorization: Bearer <token>` header, **or**
- `session_token` cookie (set by the auth service on login)

Unauthenticated requests receive `HTTP 401`.

To get a token, log in via the auth service:

```bash
curl -c cookies.txt -X POST http://localhost:4000/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "user_id": "admin-001", "password": "<your-password>"}'
```

If no admin user exists yet, seed one first:

```bash
cd authService

# Make sure DATABASE_URL is set in your .env
python seed_admin.py --username admin --password <your-strong-password> --user-id admin-001
```

## Services and ports

| Service | URL |
|---|---|
| Ingestion API | http://localhost:3000 |
| MinIO S3 API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |
| React frontend | http://localhost:5173 |

MinIO credentials are set via your root `.env` file (`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`).

## Fastest setup: Docker Compose

Prerequisites: Docker Desktop with Docker Compose, and a root `.env` file at the repository root (see the main README for setup).

```bash
# From the repo root
docker compose up --build
```

This starts MinIO, Redis, Kafka, creates topics and buckets, and starts the ingestion API.

Check:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{
  "status": "healthy",
  "services": {
    "api": "up",
    "minio": "up",
    "kafka": "up"
  }
}
```

Stop services:

```bash
docker compose down
```

Remove all MinIO/Kafka/Redis development data:

```bash
docker compose down -v
```

## Run backend in VS Code, infrastructure in Docker

Start only infrastructure:

```bash
docker compose up -d minio minio-init kafka redis
```

Then run the API on the host:

```bash
cd nagar-vault-backend
cp .env.example .env   # fill in JWT_SECRET, MinIO creds, Redis URL
npm install
npm run dev
```

## Connect the React frontend

Create `nagar-vault-ui/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_DEMO_MODE=false
```

Restart Vite after changing environment variables:

```bash
cd nagar-vault-ui
npm run dev
```

## API contract

### Request presigned PUT URLs

```http
POST /api/v1/uploads/presign
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "department": "nmc",
  "eventType": "nmc.complaint.created",
  "sourceRecordId": "NMC-2026-000125",
  "sensitivity": "restricted",
  "files": [
    {
      "fileName": "waterlogging.jpg",
      "contentType": "image/jpeg",
      "size": 182440
    }
  ]
}
```

Response:

```json
{
  "uploads": [
    {
      "attachmentId": "generated-uuid",
      "uploadUrl": "http://localhost:9000/raw-sensitive-media/...?X-Amz-Signature=...",
      "bucket": "raw-sensitive-media",
      "objectKey": "nmc/image/2026/08/17/nmc-2026-000125/generated-uuid-waterlogging.jpg",
      "expiresAt": "2026-08-17T14:05:00.000Z",
      "headers": {
        "Content-Type": "image/jpeg"
      }
    }
  ],
  "expiresInSeconds": 300
}
```

The frontend then performs:

```http
PUT {uploadUrl}
Content-Type: image/jpeg
Body: raw file bytes
```

The PUT goes directly to MinIO. The exact `Content-Type` returned by the API must be sent by the frontend.

### Commit event

```http
POST /api/v1/events
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "schemaVersion": "1.0",
  "department": "nmc",
  "eventType": "nmc.complaint.created",
  "sourceSystem": "mock-citizen-app",
  "sourceRecordId": "NMC-2026-000125",
  "occurredAt": "2026-08-17T14:32:00+05:30",
  "sensitivity": "restricted",
  "location": {
    "wardId": "ZONE-5"
  },
  "payload": {
    "category": "waterlogging",
    "description": "Synthetic complaint"
  },
  "attachments": [
    {
      "attachmentId": "uuid-returned-by-presign",
      "originalName": "waterlogging.jpg",
      "contentType": "image/jpeg",
      "size": 182440,
      "mediaType": "image",
      "bucket": "raw-sensitive-media",
      "objectKey": "key-returned-by-presign",
      "etag": "etag-returned-by-minio"
    }
  ]
}
```

The backend checks the upload intent, calls MinIO `statObject`, checks size and ETag, replaces attachment data with server-controlled values, and then publishes the event.

### JSON-only event

Use the same `/api/v1/events` endpoint with:

```json
{
  "attachments": []
}
```

See `examples/complaint-no-files.json` and `examples/requests.http`.

Test a JSON-only complaint (replace `<token>` with your JWT):

```bash
curl -i http://localhost:3000/api/v1/events \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  --data-binary @examples/complaint-no-files.json
```

## Kafka topics

The backend selects topics; the frontend cannot choose one.

```text
nmc.complaints.raw.restricted.v1
traffic.events.raw.v1
water.sensors.raw.v1
health.camps.raw.v1
ev.bus.telemetry.raw.v1
```

Watch complaint events (run from inside the stack — Kafka port is not exposed to the host in production):

```bash
docker exec -it nagar-vault-kafka \
  /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic nmc.complaints.raw.restricted.v1 \
  --from-beginning
```

To access Kafka from the host during development, start the stack with the dev overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Then connect to `localhost:29092`.

## MinIO setup

`minio-init` creates:

```text
raw-media
raw-sensitive-media
```

It applies `minio/cors.xml`, allowing the React origin `http://localhost:5173` to issue browser `PUT` requests and read the `ETag` response header.

Open http://localhost:9001 to inspect uploaded files.

For another frontend origin, update both:

```text
docker-compose.yml -> MINIO_API_CORS_ALLOW_ORIGIN
minio/cors.xml      -> AllowedOrigin
```

Then recreate the setup:

```bash
docker compose down
docker compose up --build
```

## Validation and safety included

- Server-generated bucket and object key
- Allowed MIME list
- Maximum file count and claimed size
- Five-minute upload URL
- Upload-intent ownership checks
- MinIO existence, size, and ETag verification
- Server-controlled Kafka topic routing
- Duplicate detection using `sourceSystem + sourceRecordId`
- CORS allowlists for Express and MinIO
- Request IDs and structured logs
- Graceful Kafka shutdown

## Persistence

Upload intents and accepted events are stored in Redis (key prefix `upload-intent:` and `event:id:` / `event:src:`). Redis provides automatic TTL-based expiry for upload intents and consistent deduplication across restarts and replicas. The Redis service is started automatically by Docker Compose.

## Troubleshooting

### Frontend says Demo adapter

Set and restart Vite:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_DEMO_MODE=false
```

### PUT is blocked by CORS

Verify the frontend is exactly `http://localhost:5173`, then check:

```bash
docker compose logs minio-init
```

### Presigned URL contains `minio:9000`

The browser cannot resolve Docker's internal hostname. Ensure:

```env
MINIO_PUBLIC_URL=http://localhost:9000
```

### SignatureDoesNotMatch

The browser must send the same `Content-Type` returned in `uploads[].headers` and must not modify the signed URL.

### Event returns OBJECT_NOT_UPLOADED

The final `/events` request was sent before the MinIO PUT completed, or the PUT failed. Check the browser Network panel.

## Tests

```bash
npm test
npm run check
```
