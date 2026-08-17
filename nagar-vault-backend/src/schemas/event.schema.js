import { z } from "zod";
import { env } from "../config/env.js";
import { allowedContentTypes } from "./presign.schema.js";

const attachmentSchema = z
  .object({
    attachmentId: z.string().uuid(),
    originalName: z.string().trim().min(1).max(255),
    contentType: z.enum(allowedContentTypes),
    size: z.number().int().positive().max(env.MAX_FILE_SIZE_BYTES),
    mediaType: z.enum(["image", "audio", "video"]),
    bucket: z.string().trim().min(3).max(63),
    objectKey: z.string().trim().min(1).max(1024),
    etag: z.string().nullable().optional(),
  })
  .strict();

export const eventRequestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    department: z.enum(["nmc", "traffic", "water", "health", "transport"]),
    eventType: z.string().trim().min(1).max(120),
    sourceSystem: z.string().trim().min(1).max(120),
    sourceRecordId: z.string().trim().min(1).max(120),
    occurredAt: z.string().datetime({ offset: true }),
    sensitivity: z.enum(["public", "internal", "restricted"]),
    location: z
      .object({
        wardId: z.string().trim().min(1).max(50),
      })
      .passthrough(),
    payload: z.record(z.string(), z.unknown()),
    attachments: z.array(attachmentSchema).max(env.MAX_FILES_PER_EVENT).default([]),
  })
  .strict();
