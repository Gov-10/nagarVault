import test from "node:test";
import assert from "node:assert/strict";
import { buildObjectKey, sanitizeSegment } from "../src/services/object-key.service.js";
import { topicForDepartment } from "../src/services/topic-router.js";

test("sanitizes user controlled key segments", () => {
  assert.equal(sanitizeSegment("../../NMC Record 01"), "nmc-record-01");
});

test("builds a server-controlled object key using MIME extension", () => {
  const key = buildObjectKey({
    department: "nmc",
    sourceRecordId: "NMC-2026-000123",
    contentType: "image/jpeg",
    fileName: "../../Water Logging.PDF",
    attachmentId: "11111111-1111-4111-8111-111111111111",
    now: new Date("2026-08-17T10:00:00.000Z"),
  });

  assert.equal(
    key,
    "nmc/image/2026/08/17/nmc-2026-000123/11111111-1111-4111-8111-111111111111-water-logging.jpg",
  );
});

test("routes departments to backend-controlled Kafka topics", () => {
  assert.equal(topicForDepartment("water"), "water.sensors.raw.v1");
  assert.equal(topicForDepartment("transport"), "ev.bus.telemetry.raw.v1");
});
