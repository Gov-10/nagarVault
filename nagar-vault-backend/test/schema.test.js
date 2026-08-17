import test from "node:test";
import assert from "node:assert/strict";
import { presignRequestSchema } from "../src/schemas/presign.schema.js";
import { eventRequestSchema } from "../src/schemas/event.schema.js";

test("accepts the frontend presign request shape", () => {
  const request = presignRequestSchema.parse({
    department: "nmc",
    eventType: "nmc.complaint.created",
    sourceRecordId: "NMC-2026-100001",
    sensitivity: "restricted",
    files: [{ fileName: "waterlogging.jpg", contentType: "image/jpeg", size: 2048 }],
  });
  assert.equal(request.files.length, 1);
});

test("accepts a JSON-only frontend event", () => {
  const event = eventRequestSchema.parse({
    schemaVersion: "1.0",
    department: "water",
    eventType: "water.sensor.reading",
    sourceSystem: "mock-water-scada",
    sourceRecordId: "WTR-2026-100001",
    occurredAt: "2026-08-17T10:00:00.000Z",
    sensitivity: "internal",
    location: { wardId: "ZONE-2" },
    payload: { sensorId: "WTR-SENSOR-089", pressureBar: 3.2 },
    attachments: [],
  });
  assert.deepEqual(event.attachments, []);
});
