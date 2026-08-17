import crypto from "node:crypto";
import { env } from "../config/env.js";
import { createPresignedPutUrl, statMinioObject } from "../clients/minio.client.js";
import { buildObjectKey } from "./object-key.service.js";
import { uploadIntentStore } from "./upload-intent.store.js";
import { AppError, assert } from "../utils/errors.js";

function bucketForSensitivity(sensitivity) {
  return sensitivity === "restricted"
    ? env.MINIO_SENSITIVE_BUCKET
    : env.MINIO_RAW_BUCKET;
}

export async function createUploadTargets(request) {
  const bucket = bucketForSensitivity(request.sensitivity);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + env.PRESIGNED_URL_EXPIRY_SECONDS * 1000,
  ).toISOString();

  return Promise.all(
    request.files.map(async (file) => {
      const attachmentId = crypto.randomUUID();
      const objectKey = buildObjectKey({
        department: request.department,
        sourceRecordId: request.sourceRecordId,
        contentType: file.contentType,
        fileName: file.fileName,
        attachmentId,
        now,
      });

      const uploadUrl = await createPresignedPutUrl(bucket, objectKey);

      uploadIntentStore.create({
        attachmentId,
        department: request.department,
        eventType: request.eventType,
        sourceRecordId: request.sourceRecordId,
        sensitivity: request.sensitivity,
        bucket,
        objectKey,
        originalName: file.fileName,
        expectedContentType: file.contentType,
        expectedSize: file.size,
        status: "URL_ISSUED",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        presignedUrlExpiresAt: expiresAt,
      });

      return {
        attachmentId,
        uploadUrl,
        bucket,
        objectKey,
        expiresAt,
        headers: {
          "Content-Type": file.contentType,
        },
      };
    }),
  );
}

export function getUploadIntentForApi(attachmentId) {
  const intent = uploadIntentStore.get(attachmentId);
  if (!intent) return null;
  return {
    attachmentId: intent.attachmentId,
    sourceRecordId: intent.sourceRecordId,
    bucket: intent.bucket,
    objectKey: intent.objectKey,
    status: intent.status,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
  };
}

async function verifyOneAttachment(event, attachment) {
  const intent = uploadIntentStore.get(attachment.attachmentId);

  assert(
    intent,
    400,
    "UNKNOWN_UPLOAD_INTENT",
    `No upload intent exists for attachment ${attachment.attachmentId}`,
  );

  assert(
    intent.status !== "COMMITTED",
    409,
    "UPLOAD_ALREADY_COMMITTED",
    `Attachment ${attachment.attachmentId} has already been committed`,
  );

  const matchesIntent =
    intent.department === event.department &&
    intent.eventType === event.eventType &&
    intent.sourceRecordId === event.sourceRecordId &&
    intent.sensitivity === event.sensitivity &&
    intent.bucket === attachment.bucket &&
    intent.objectKey === attachment.objectKey &&
    intent.expectedContentType === attachment.contentType &&
    intent.expectedSize === attachment.size;

  assert(
    matchesIntent,
    400,
    "UPLOAD_INTENT_MISMATCH",
    `Attachment ${attachment.attachmentId} does not match the upload permission issued by the server`,
  );

  let stat;
  try {
    stat = await statMinioObject(intent.bucket, intent.objectKey);
  } catch (error) {
    throw new AppError(
      409,
      "OBJECT_NOT_UPLOADED",
      `MinIO object for ${attachment.originalName} was not found. Complete the PUT upload before committing the event.`,
      { minioCode: error.code },
    );
  }

  assert(
    Number(stat.size) === intent.expectedSize,
    400,
    "OBJECT_SIZE_MISMATCH",
    `Uploaded size for ${attachment.originalName} does not match the presign request`,
    { expected: intent.expectedSize, actual: Number(stat.size) },
  );

  const actualEtag = stat.etag?.replaceAll('"', "") || attachment.etag || null;
  if (attachment.etag && actualEtag) {
    assert(
      attachment.etag.replaceAll('"', "") === actualEtag,
      400,
      "OBJECT_ETAG_MISMATCH",
      `ETag for ${attachment.originalName} does not match the MinIO object`,
    );
  }

  uploadIntentStore.update(intent.attachmentId, {
    status: "VERIFIED",
    verifiedAt: new Date().toISOString(),
    etag: actualEtag,
  });

  return {
    attachmentId: intent.attachmentId,
    originalName: intent.originalName,
    contentType: intent.expectedContentType,
    size: intent.expectedSize,
    mediaType: intent.expectedContentType.split("/")[0],
    bucket: intent.bucket,
    objectKey: intent.objectKey,
    etag: actualEtag,
  };
}

export async function verifyUploadedAttachments(event) {
  return Promise.all(
    event.attachments.map((attachment) => verifyOneAttachment(event, attachment)),
  );
}

export function markAttachmentsCommitted(attachments, eventId) {
  for (const attachment of attachments) {
    uploadIntentStore.update(attachment.attachmentId, {
      status: "COMMITTED",
      eventId,
      committedAt: new Date().toISOString(),
    });
  }
}
