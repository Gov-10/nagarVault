export const TOPICS = {
  nmc: "nmc.complaints.raw.restricted.v1",
  traffic: "traffic.events.raw.v1",
  water: "water.sensors.raw.v1",
  health: "health.camps.raw.v1",
  transport: "ev.bus.telemetry.raw.v1",
};

export function topicForDepartment(department) {
  return TOPICS[department];
}
