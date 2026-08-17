import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:5173"),

  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: booleanFromEnv.default(false),
  MINIO_ACCESS_KEY: z.string().min(3).default("minioadmin"),
  MINIO_SECRET_KEY: z.string().min(8).default("minioadmin"),
  MINIO_REGION: z.string().default("us-east-1"),
  MINIO_PUBLIC_URL: z.string().url().default("http://localhost:9000"),
  MINIO_RAW_BUCKET: z.string().min(3).default("raw-media"),
  MINIO_SENSITIVE_BUCKET: z.string().min(3).default("raw-sensitive-media"),
  PRESIGNED_URL_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(524288000),
  MAX_FILES_PER_EVENT: z.coerce.number().int().min(1).max(20).default(8),
  UPLOAD_INTENT_TTL_SECONDS: z.coerce.number().int().min(300).default(3600),

  KAFKA_ENABLED: booleanFromEnv.default(true),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("nagar-vault-ingestion"),
  KAFKA_TOPIC_PARTITIONS: z.coerce.number().int().min(1).default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  frontendOrigins: parsed.data.FRONTEND_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(",")
    .map((broker) => broker.trim())
    .filter(Boolean),
};
