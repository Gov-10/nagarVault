import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { AppError } from "./utils/errors.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { eventRouter } from "./routes/event.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  pinoHttp({
    logger,
    genReqId(req, res) {
      const existing = req.headers["x-request-id"];
      const id = typeof existing === "string" ? existing : crypto.randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new AppError(403, "CORS_ORIGIN_DENIED", `Origin ${origin} is not allowed`),
      );
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 3600,
  }),
);
app.use(express.json({ limit: "2mb", strict: true }));

app.get("/", (req, res) => {
  res.json({
    service: "NagarVault Common Ingestion Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      presign: "POST /api/v1/uploads/presign",
      uploadStatus: "GET /api/v1/uploads/:attachmentId",
      createEvent: "POST /api/v1/events",
      getEvent: "GET /api/v1/events/:eventId",
    },
  });
});

app.use(healthRouter);
app.use("/api/v1/uploads", uploadRouter);
app.use("/api/v1/events", eventRouter);

app.use(notFoundHandler);
app.use(errorHandler);
