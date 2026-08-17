import { z } from "zod";
import { env } from "../config/env.js";

export const allowedContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const presignRequestSchema = z
  .object({
    department: z.enum(["nmc", "traffic", "water", "health", "transport"]),
    eventType: z.string().trim().min(1).max(120),
    sourceRecordId: z.string().trim().min(1).max(120),
    sensitivity: z.enum(["public", "internal", "restricted"]),
    files: z
      .array(
        z
          .object({
            fileName: z.string().trim().min(1).max(255),
            contentType: z.enum(allowedContentTypes),
            size: z.number().int().positive().max(env.MAX_FILE_SIZE_BYTES),
          })
          .strict(),
      )
      .min(1)
      .max(env.MAX_FILES_PER_EVENT),
  })
  .strict();
