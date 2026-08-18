import crypto from "node:crypto";
import { publishEvent } from "../clients/kafka.client.js";
import { eventStore } from "./event.store.js";
import { markAttachmentsCommitted, verifyUploadedAttachments } from "./upload.service.js";
import { topicForDepartment } from "./topic-router.js";

export async function acceptEvent(request) {
  const existing = await eventStore.getBySource(request.sourceSystem, request.sourceRecordId);
  if (existing) {
    return { duplicate: true, topic: topicForDepartment(existing.department), event: existing };
  }

  const verifiedAttachments = await verifyUploadedAttachments(request);
  const eventId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  const topic = topicForDepartment(request.department);

  const event = { ...request, eventId, receivedAt, attachments: verifiedAttachments };
  await publishEvent(topic, event);
  await eventStore.save(event);
  await markAttachmentsCommitted(verifiedAttachments, eventId);

  return { duplicate: false, topic, event };
}
