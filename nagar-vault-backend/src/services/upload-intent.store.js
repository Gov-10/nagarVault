import { env } from "../config/env.js";

class UploadIntentStore {
  #items = new Map();
  #cleanupTimer;

  constructor() {
    this.#cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    this.#cleanupTimer.unref();
  }

  create(intent) {
    this.#items.set(intent.attachmentId, { ...intent });
    return this.get(intent.attachmentId);
  }

  get(attachmentId) {
    const item = this.#items.get(attachmentId);
    return item ? { ...item } : null;
  }

  update(attachmentId, patch) {
    const current = this.#items.get(attachmentId);
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.#items.set(attachmentId, updated);
    return { ...updated };
  }

  cleanup(now = Date.now()) {
    const ttlMilliseconds = env.UPLOAD_INTENT_TTL_SECONDS * 1000;
    for (const [id, item] of this.#items.entries()) {
      const createdAt = new Date(item.createdAt).getTime();
      if (now - createdAt > ttlMilliseconds) {
        this.#items.delete(id);
      }
    }
  }

  stop() {
    clearInterval(this.#cleanupTimer);
  }
}

export const uploadIntentStore = new UploadIntentStore();
