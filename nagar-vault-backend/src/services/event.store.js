class EventStore {
  #byEventId = new Map();
  #eventIdBySource = new Map();

  sourceKey(sourceSystem, sourceRecordId) {
    return `${sourceSystem}:${sourceRecordId}`;
  }

  save(event) {
    this.#byEventId.set(event.eventId, structuredClone(event));
    this.#eventIdBySource.set(this.sourceKey(event.sourceSystem, event.sourceRecordId), event.eventId);
    return this.getById(event.eventId);
  }

  getById(eventId) {
    const event = this.#byEventId.get(eventId);
    return event ? structuredClone(event) : null;
  }

  getBySource(sourceSystem, sourceRecordId) {
    const eventId = this.#eventIdBySource.get(this.sourceKey(sourceSystem, sourceRecordId));
    return eventId ? this.getById(eventId) : null;
  }
}

export const eventStore = new EventStore();
