import { redis } from "../clients/redis.client.js";
import { env } from "../config/env.js";

const KEY_PREFIX = "upload-intent:";

export const uploadIntentStore = {
  async create(intent) {
    const key = `${KEY_PREFIX}${intent.attachmentId}`;
    await redis.set(key, JSON.stringify(intent), "EX", env.UPLOAD_INTENT_TTL_SECONDS);
    return this.get(intent.attachmentId);
  },

  async get(attachmentId) {
    const raw = await redis.get(`${KEY_PREFIX}${attachmentId}`);
    return raw ? JSON.parse(raw) : null;
  },

  async update(attachmentId, patch) {
    const current = await this.get(attachmentId);
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    // Preserve remaining TTL; fall back to full TTL if key has no expiry
    const ttl = await redis.ttl(`${KEY_PREFIX}${attachmentId}`);
    const effectiveTtl = ttl > 0 ? ttl : env.UPLOAD_INTENT_TTL_SECONDS;
    await redis.set(`${KEY_PREFIX}${attachmentId}`, JSON.stringify(updated), "EX", effectiveTtl);
    return updated;
  },

  // No-op: Redis connection lifecycle is managed by redis.client.js
  stop() {},
};
