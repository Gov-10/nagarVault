import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { presignRequestSchema } from "../schemas/presign.schema.js";
import { createUploadTargets, getUploadIntentForApi } from "../services/upload.service.js";

export const uploadRouter = Router();

uploadRouter.post(
  "/presign",
  asyncHandler(async (req, res) => {
    const request = presignRequestSchema.parse(req.body);
    const uploads = await createUploadTargets(request);

    req.log.info(
      {
        department: request.department,
        sourceRecordId: request.sourceRecordId,
        fileCount: request.files.length,
      },
      "Issued presigned upload URLs",
    );

    res.status(201).json({
      uploads,
      expiresInSeconds: uploads.length
        ? Math.max(0, Math.floor((new Date(uploads[0].expiresAt).getTime() - Date.now()) / 1000))
        : 0,
    });
  }),
);

uploadRouter.get(
  "/:attachmentId",
  asyncHandler(async (req, res) => {
    const intent = await getUploadIntentForApi(req.params.attachmentId);
    if (!intent) {
      return res.status(404).json({
        error: "UPLOAD_INTENT_NOT_FOUND",
        message: "No upload intent exists for that attachment ID",
        requestId: req.id,
      });
    }
    return res.json(intent);
  }),
);
