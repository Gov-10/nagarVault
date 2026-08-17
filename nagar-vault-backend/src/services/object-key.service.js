import crypto from "node:crypto";

const extensionsByContentType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export function sanitizeSegment(value, maxLength = 100) {
  const safe = String(value)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, maxLength);

  return safe || "unknown";
}

export function baseNameWithoutExtension(fileName) {
  const lastPart = String(fileName).split(/[\\/]/).pop() || "file";
  const withoutExtension = lastPart.replace(/\.[^.]+$/, "");
  return sanitizeSegment(withoutExtension, 70);
}

export function buildObjectKey({ department, sourceRecordId, contentType, fileName, attachmentId, now = new Date() }) {
  const mediaType = contentType.split("/")[0];
  const datePath = now.toISOString().slice(0, 10).replaceAll("-", "/");
  const extension = extensionsByContentType[contentType] || ".bin";
  const randomPart = attachmentId || crypto.randomUUID();

  return [
    sanitizeSegment(department, 30),
    sanitizeSegment(mediaType, 20),
    datePath,
    sanitizeSegment(sourceRecordId, 100),
    `${randomPart}-${baseNameWithoutExtension(fileName)}${extension}`,
  ].join("/");
}
