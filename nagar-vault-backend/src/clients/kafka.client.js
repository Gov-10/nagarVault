import { Kafka, logLevel } from "kafkajs";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { TOPICS } from "../services/topic-router.js";

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.kafkaBrokers,
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 300,
    retries: 8,
  },
});

const producer = kafka.producer({ allowAutoTopicCreation: false });
const admin = kafka.admin();
let connected = false;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function connectKafka() {
  if (!env.KAFKA_ENABLED) {
    logger.warn("Kafka publishing is disabled by KAFKA_ENABLED=false");
    return;
  }

  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      await admin.connect();
      await admin.createTopics({
        waitForLeaders: true,
        topics: Object.values(TOPICS).map((topic) => ({
          topic,
          numPartitions: env.KAFKA_TOPIC_PARTITIONS,
          replicationFactor: 1,
        })),
      });
      await producer.connect();
      connected = true;
      logger.info({ brokers: env.kafkaBrokers, topics: Object.values(TOPICS) }, "Kafka connected");
      return;
    } catch (error) {
      lastError = error;
      logger.warn({ attempt, error: error.message }, "Kafka not ready; retrying");
      try {
        await admin.disconnect();
      } catch {
        // Ignore disconnect errors during startup retry.
      }
      await wait(Math.min(attempt * 1000, 5000));
    }
  }

  throw lastError;
}

export async function publishEvent(topic, event) {
  if (!env.KAFKA_ENABLED) {
    logger.info({ topic, eventId: event.eventId }, "Kafka disabled; event accepted without publishing");
    return;
  }

  await producer.send({
    topic,
    acks: -1,
    messages: [
      {
        key: event.eventId,
        value: JSON.stringify(event),
        headers: {
          "schema-version": event.schemaVersion,
          department: event.department,
          "event-type": event.eventType,
          "correlation-id": event.sourceRecordId,
        },
      },
    ],
  });
}

export async function checkKafkaHealth() {
  if (!env.KAFKA_ENABLED) return "disabled";
  if (!connected) throw new Error("Kafka is not connected");
  await admin.fetchTopicMetadata({ topics: Object.values(TOPICS) });
  return "up";
}

export async function disconnectKafka() {
  if (!env.KAFKA_ENABLED || !connected) return;
  connected = false;
  await Promise.allSettled([producer.disconnect(), admin.disconnect()]);
}
