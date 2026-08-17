# NagarVault Common Ingestion Service

Node.js/Express backend for the NagarVault mock-data page. It implements the exact presigned upload contract used by `nagar-vault-ui/src/api/ingestion.js`.

## What it does

```text
JSON-only event:
Browser -> POST /api/v1/events -> API -> Kafka

Event with media:
Browser -> POST /api/v1/uploads/presign -> API
Browser -> PUT presigned URL -> MinIO
Browser -> POST /api/v1/events with object references -> API -> Kafka
```

The API never proxies image, audio, or video bytes. It validates upload intents, verifies that each object exists in MinIO, and publishes only durable `bucket`/`objectKey` references to Kafka.

> This is a local development/hackathon service. It intentionally has no login. Use synthetic data only.

## Services and ports

| Service | URL |
|---|---|
| Ingestion API | http://localhost:3000 |
| MinIO S3 API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |
| Kafka host listener | localhost:9092 |
| React frontend | http://localhost:5173 |

MinIO Console credentials:

```text
Username: minioadmin
Password: minioadmin
```

## Fastest setup: Docker Compose

Prerequisites: Docker Desktop with Docker Compose.

```bash
cd nagar-vault-backend
docker compose up --build
```

This starts MinIO, creates `raw-media` and `raw-sensitive-media`, applies browser CORS, starts a single-node Kafka broker, creates Kafka topics, and starts the API.

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

Remove all MinIO/Kafka development data:

```bash
docker compose down -v
```

## Run backend in VS Code, infrastructure in Docker

Start only infrastructure:

```bash
docker compose up -d minio minio-init kafka
```

Then run the API on the host:

```bash
cp .env.example .env
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

Test a JSON-only complaint:

```bash
curl -i http://localhost:3000/api/v1/events \
  -H 'Content-Type: application/json' \
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

Watch complaint events:

```bash
docker exec -it nagar-vault-kafka \
  /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic nmc.complaints.raw.restricted.v1 \
  --from-beginning
```

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

## Development limitation

Upload intents and accepted events are currently held in memory. Restarting the API clears them. This is suitable for mock-data injection. Replace `upload-intent.store.js` and `event.store.js` with PostgreSQL or Redis for production. Use an outbox table for reliable Kafka publication.

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
