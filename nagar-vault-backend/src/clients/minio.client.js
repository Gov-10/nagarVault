import * as Minio from "minio";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

function createClient({ endPoint, port, useSSL }) {
  const client = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
    region: env.MINIO_REGION,
  });
  client.setAppInfo("nagar-vault-ingestion", "1.0.0");
  return client;
}

export const minioClient = createClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
});

const publicUrl = new URL(env.MINIO_PUBLIC_URL);
export const minioPresignClient = createClient({
  endPoint: publicUrl.hostname,
  port: Number(publicUrl.port || (publicUrl.protocol === "https:" ? 443 : 80)),
  useSSL: publicUrl.protocol === "https:",
});

export async function ensureMinioBuckets() {
  const buckets = [env.MINIO_RAW_BUCKET, env.MINIO_SENSITIVE_BUCKET];

  for (const bucket of buckets) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket, env.MINIO_REGION);
      logger.info({ bucket }, "Created MinIO bucket");
    }
  }
}

export async function createPresignedPutUrl(bucket, objectKey) {
  return minioPresignClient.presignedPutObject(
    bucket,
    objectKey,
    env.PRESIGNED_URL_EXPIRY_SECONDS,
  );
}

export async function statMinioObject(bucket, objectKey) {
  return minioClient.statObject(bucket, objectKey);
}

export async function checkMinioHealth() {
  await minioClient.listBuckets();
  return "up";
}
