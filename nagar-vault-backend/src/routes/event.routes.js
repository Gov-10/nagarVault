import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { eventRequestSchema } from "../schemas/event.schema.js";
import { acceptEvent } from "../services/event.service.js";
import { eventStore } from "../services/event.store.js";

export const eventRouter = Router();

eventRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const request = eventRequestSchema.parse(req.body);
    const result = await acceptEvent(request);

    req.log.info(
      {
        eventId: result.event.eventId,
        sourceRecordId: result.event.sourceRecordId,
        topic: result.topic,
        attachmentCount: result.event.attachments.length,
        duplicate: result.duplicate,
      },
      result.duplicate ? "Duplicate event returned" : "Event accepted",
    );

    res.status(result.duplicate ? 200 : 202).json({
      status: result.duplicate ? "duplicate" : "accepted",
      eventId: result.event.eventId,
      topic: result.topic,
      acceptedAt: result.event.receivedAt,
      attachments: result.event.attachments,
    });
  }),
);

eventRouter.get("/:eventId", (req, res) => {
  const event = eventStore.getById(req.params.eventId);
  if (!event) {
    return res.status(404).json({
      error: "EVENT_NOT_FOUND",
      message: "No event exists for that ID in the local event store",
      requestId: req.id,
    });
  }
  return res.json(event);
});
