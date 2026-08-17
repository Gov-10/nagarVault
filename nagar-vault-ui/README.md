# NagarVault — Mock Data Injector

A small internal React utility for sending synthetic civic events to the NagarVault ingestion API. It is intentionally a simple developer/testing page rather than a judge-facing dashboard. Optional media uses **presigned PUT URLs**, so files move directly from the browser to MinIO without passing through Express.

## Included

- Ready-made dummy presets for NMC, traffic, water, health, and EV bus events
- Editable common fields and raw JSON payload
- Optional image/audio/video attachments
- Presigned URL request, direct MinIO upload, and per-file progress
- Compact request route and JSON preview
- API response viewer
- Standalone demo adapter when no backend URL is configured

## Run locally

```bash
npm install
npm run dev
```

## Connect the Express backend

Copy `.env.example` to `.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_DEMO_MODE=false
```

If `VITE_API_BASE_URL` is omitted, the app simulates the full presigned upload flow in demo mode.

## Presigned upload contract

### 1. Request upload URLs

```http
POST /api/v1/uploads/presign
Content-Type: application/json
```

Request:

```json
{
  "department": "nmc",
  "eventType": "nmc.complaint.created",
  "sourceRecordId": "NMC-2026-000128",
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
      "attachmentId": "5b824605-9ea1-44ca-89ad-e6d96b8ae661",
      "uploadUrl": "http://localhost:9000/raw-sensitive-media/...?X-Amz-Signature=...",
      "bucket": "raw-sensitive-media",
      "objectKey": "nmc/image/2026/08/17/NMC-2026-000128/5b824605-waterlogging.jpg",
      "expiresAt": "2026-08-17T14:05:00+05:30",
      "headers": {
        "Content-Type": "image/jpeg"
      }
    }
  ]
}
```

The browser uploads each file directly:

```http
PUT {uploadUrl}
Content-Type: image/jpeg
Body: raw file bytes
```

### 2. Commit the event

After all uploads succeed:

```http
POST /api/v1/events
Content-Type: application/json
```

The final event includes only durable object references, never the expiring URL:

```json
{
  "schemaVersion": "1.0",
  "department": "nmc",
  "eventType": "nmc.complaint.created",
  "sourceRecordId": "NMC-2026-000128",
  "payload": {},
  "attachments": [
    {
      "attachmentId": "5b824605-9ea1-44ca-89ad-e6d96b8ae661",
      "originalName": "waterlogging.jpg",
      "contentType": "image/jpeg",
      "size": 182440,
      "mediaType": "image",
      "bucket": "raw-sensitive-media",
      "objectKey": "nmc/image/2026/08/17/NMC-2026-000128/5b824605-waterlogging.jpg",
      "etag": "..."
    }
  ]
}
```

JSON-only records skip the presign and MinIO steps and go directly to `POST /api/v1/events` with `attachments: []`.

## Important MinIO requirements

- The API must sign a URL reachable by the user's browser, such as `http://localhost:9000`; never return a Docker-only host such as `http://minio:9000`.
- MinIO CORS must allow `PUT` from the frontend origin, normally `http://localhost:5173`.
- Sign the exact `Content-Type` the browser will send.
- Use a short expiry such as five minutes.
- Scope every URL to one generated object key.
- Do not store the presigned URL in Kafka or PostgreSQL; store only `bucket` and `objectKey`.

## Build

```bash
npm run build
```
