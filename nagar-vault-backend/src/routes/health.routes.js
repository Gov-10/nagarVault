import { Router } from "express";
import { checkMinioHealth } from "../clients/minio.client.js";
import { checkKafkaHealth } from "../clients/kafka.client.js";

export const healthRouter = Router();

healthRouter.get("/health", async (req, res) => {
  const [minioResult, kafkaResult] = await Promise.allSettled([
    checkMinioHealth(),
    checkKafkaHealth(),
  ]);

  const services = {
    api: "up",
    minio: minioResult.status === "fulfilled" ? minioResult.value : "down",
    kafka: kafkaResult.status === "fulfilled" ? kafkaResult.value : "down",
  };

  const healthy = services.minio === "up" && ["up", "disabled"].includes(services.kafka);
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "degraded",
    service: "nagar-vault-ingestion",
    timestamp: new Date().toISOString(),
    services,
    requestId: req.id,
  });
});
