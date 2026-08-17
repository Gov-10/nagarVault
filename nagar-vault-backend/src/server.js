import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { ensureMinioBuckets } from "./clients/minio.client.js";
import { connectKafka, disconnectKafka } from "./clients/kafka.client.js";
import { uploadIntentStore } from "./services/upload-intent.store.js";

let server;
let shuttingDown = false;

async function start() {
  logger.info(
    {
      port: env.PORT,
      minioEndpoint: `${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
      minioPublicUrl: env.MINIO_PUBLIC_URL,
      kafkaBrokers: env.kafkaBrokers,
      kafkaEnabled: env.KAFKA_ENABLED,
    },
    "Starting NagarVault ingestion service",
  );

  await ensureMinioBuckets();
  await connectKafka();

  server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT }, "NagarVault ingestion API is ready");
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  uploadIntentStore.stop();

  const forceTimer = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectKafka();
  clearTimeout(forceTimer);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => {
  logger.error({ err: error }, "Unhandled promise rejection");
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  process.exit(1);
});

start().catch((error) => {
  logger.fatal({ err: error }, "Failed to start ingestion service");
  process.exit(1);
});
