const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const DEMO_MODE = !API_BASE_URL || import.meta.env.VITE_DEMO_MODE === "true";

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function safeObjectName(name) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function readJsonResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Request failed (${response.status})`);
  }
  return body;
}

function putFileWithProgress(file, target, onProgress, index) {
  return new Promise((resolve, reject) => {
    const uploadUrl = target.uploadUrl || target.presignedUrl || target.url;
    if (!uploadUrl) {
      reject(new Error(`Upload URL missing for ${file.name}`));
      return;
    }

    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);

    const headers = target.headers || {};
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    if (!Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
      request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    }

    request.upload.onprogress = (event) => {
      const progress = event.lengthComputable
        ? Math.round((event.loaded / event.total) * 100)
        : 0;
      onProgress?.(index, { status: "uploading", progress });
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(index, { status: "uploaded", progress: 100 });
        resolve({ etag: request.getResponseHeader("etag")?.replaceAll('"', "") || null });
      } else {
        reject(new Error(`MinIO upload failed for ${file.name} (${request.status})`));
      }
    };

    request.onerror = () => reject(new Error(`Network error while uploading ${file.name}`));
    request.onabort = () => reject(new Error(`Upload cancelled for ${file.name}`));
    request.send(file);
  });
}

async function simulatePresignedUpload(metadata, files, onProgress) {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "/");

  const attachments = await Promise.all(
    files.map(async (file, index) => {
      onProgress?.(index, { status: "signing", progress: 0 });
      await wait(180 + index * 70);
      onProgress?.(index, { status: "uploading", progress: 12 });

      for (const progress of [38, 67, 89, 100]) {
        await wait(110);
        onProgress?.(index, {
          status: progress === 100 ? "uploaded" : "uploading",
          progress,
        });
      }

      const attachmentId = crypto.randomUUID();
      const mediaType = file.type.split("/")[0] || "binary";
      return {
        attachmentId,
        originalName: file.name,
        contentType: file.type,
        size: file.size,
        mediaType,
        bucket: metadata.sensitivity === "restricted" ? "raw-sensitive-media" : "raw-media",
        objectKey: `${metadata.department}/${mediaType}/${today}/${metadata.sourceRecordId}/${attachmentId}-${safeObjectName(file.name)}`,
        etag: crypto.randomUUID().replaceAll("-", ""),
      };
    }),
  );

  await wait(300);
  return {
    status: "accepted",
    eventId: crypto.randomUUID(),
    acceptedAt: new Date().toISOString(),
    attachments,
    demo: true,
  };
}

/**
 * Presigned upload flow:
 * 1. Ask the API for short-lived PUT URLs.
 * 2. Upload each browser File directly to MinIO.
 * 3. Commit the event to the API using durable bucket/objectKey references only.
 */
export async function submitIngestion(metadata, files = [], onProgress) {
  if (DEMO_MODE) {
    return simulatePresignedUpload(metadata, files, onProgress);
  }

  let attachments = [];

  if (files.length > 0) {
    files.forEach((_, index) => onProgress?.(index, { status: "signing", progress: 0 }));

    const presignResponse = await fetch(`${API_BASE_URL}/api/v1/uploads/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department: metadata.department,
        eventType: metadata.eventType,
        sourceRecordId: metadata.sourceRecordId,
        sensitivity: metadata.sensitivity,
        files: files.map((file) => ({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        })),
      }),
    });

    const presignBody = await readJsonResponse(presignResponse);
    const targets = presignBody.uploads || presignBody.files || [];

    if (targets.length !== files.length) {
      throw new Error("The API did not return an upload URL for every attachment.");
    }

    attachments = await Promise.all(
      targets.map(async (target, index) => {
        const uploadResult = await putFileWithProgress(files[index], target, onProgress, index);
        return {
          attachmentId: target.attachmentId || target.uploadId || crypto.randomUUID(),
          originalName: files[index].name,
          contentType: files[index].type || "application/octet-stream",
          size: files[index].size,
          mediaType: files[index].type.split("/")[0] || "binary",
          bucket: target.bucket,
          objectKey: target.objectKey,
          etag: uploadResult.etag,
        };
      }),
    );
  }

  const eventResponse = await fetch(`${API_BASE_URL}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...metadata,
      attachments,
    }),
  });

  const eventBody = await readJsonResponse(eventResponse);
  return { ...eventBody, attachments: eventBody.attachments || attachments };
}

export const isDemoMode = DEMO_MODE;
