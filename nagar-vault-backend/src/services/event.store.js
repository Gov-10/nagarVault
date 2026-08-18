import { redis } from "../clients/redis.client.js";

const KEY_PREFIX_BY_ID = "event:id:";
const KEY_PREFIX_BY_SOURCE = "event:src:";

function sourceKey(sourceSystem, sourceRecordId) {
  return `${KEY_PREFIX_BY_SOURCE}${sourceSystem}:${sourceRecordId}`;
}

export const eventStore = {
  async save(event) {
    const serialized = JSON.stringify(event);
    await redis.set(`${KEY_PREFIX_BY_ID}${event.eventId}`, serialized);
    await redis.set(sourceKey(event.sourceSystem, event.sourceRecordId), event.eventId);
    return this.getById(event.eventId);
  },

  async getById(eventId) {
    const raw = await redis.get(`${KEY_PREFIX_BY_ID}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  },

  async getBySource(sourceSystem, sourceRecordId) {
    const eventId = await redis.get(sourceKey(sourceSystem, sourceRecordId));
    return eventId ? this.getById(eventId) : null;
  },
};
