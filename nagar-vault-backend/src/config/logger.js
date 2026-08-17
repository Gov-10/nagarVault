import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "nagar-vault-ingestion",
    environment: env.NODE_ENV,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "MINIO_SECRET_KEY",
      "uploadUrl",
      "*.uploadUrl",
    ],
    censor: "[REDACTED]",
  },
});
