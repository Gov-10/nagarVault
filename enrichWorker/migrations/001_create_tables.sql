-- NagarVault department tables + audit log
-- Run once against PostgreSQL before starting the enrichWorker.
-- Safe to re-run: all statements use IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- NMC citizen complaints
CREATE TABLE IF NOT EXISTS nmc_complaints (
    complaint_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL,
    ward_id         TEXT NOT NULL,
    category        TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'open',
    source_record_id TEXT NOT NULL,
    source_system   TEXT NOT NULL,
    sensitivity     TEXT NOT NULL DEFAULT 'restricted',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nmc_complaints_ward_id ON nmc_complaints (ward_id);
CREATE INDEX IF NOT EXISTS idx_nmc_complaints_status  ON nmc_complaints (status);
CREATE INDEX IF NOT EXISTS idx_nmc_complaints_created ON nmc_complaints (created_at DESC);

-- Traffic events (congestion, accidents)
CREATE TABLE IF NOT EXISTS traffic_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_record_id    TEXT NOT NULL,
    ward_id             TEXT NOT NULL,
    junction            TEXT,
    severity            TEXT NOT NULL DEFAULT 'low',
    event_type          TEXT NOT NULL,
    average_speed_kmph  INTEGER,
    vehicle_count       INTEGER,
    camera_id           TEXT,
    rain_detected       BOOLEAN NOT NULL DEFAULT FALSE,
    occurred_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_events_ward_id    ON traffic_events (ward_id);
CREATE INDEX IF NOT EXISTS idx_traffic_events_severity   ON traffic_events (severity);
CREATE INDEX IF NOT EXISTS idx_traffic_events_occurred   ON traffic_events (occurred_at DESC);

-- Water network sensor readings
CREATE TABLE IF NOT EXISTS water_sensor_readings (
    reading_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_record_id TEXT NOT NULL,
    sensor_id       TEXT NOT NULL,
    asset_name      TEXT,
    ward_id         TEXT NOT NULL,
    pressure_bar    NUMERIC(6, 2),
    flow_lpm        NUMERIC(8, 2),
    level_cm        NUMERIC(8, 2),
    status          TEXT NOT NULL DEFAULT 'normal',
    alert_raised    BOOLEAN NOT NULL DEFAULT FALSE,
    event_type      TEXT NOT NULL,
    occurred_at     TIMESTAMPTZ NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_water_sensor_readings_sensor_id  ON water_sensor_readings (sensor_id);
CREATE INDEX IF NOT EXISTS idx_water_sensor_readings_ward_id    ON water_sensor_readings (ward_id);
CREATE INDEX IF NOT EXISTS idx_water_sensor_readings_occurred   ON water_sensor_readings (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_water_sensor_readings_alert      ON water_sensor_readings (alert_raised) WHERE alert_raised = TRUE;

-- Health camp records (restricted to ROLE_HEALTH_OFFICER)
CREATE TABLE IF NOT EXISTS health_camp_records (
    record_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_record_id    TEXT NOT NULL,
    facility_name       TEXT NOT NULL,
    ward_id             TEXT NOT NULL,
    services            TEXT[],
    capacity            INTEGER,
    registered_patients INTEGER,
    waiting_patients    INTEGER,
    average_wait_minutes INTEGER,
    camp_status         TEXT NOT NULL DEFAULT 'active',
    event_type          TEXT NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_camp_records_ward_id ON health_camp_records (ward_id);
CREATE INDEX IF NOT EXISTS idx_health_camp_records_status  ON health_camp_records (camp_status);
CREATE INDEX IF NOT EXISTS idx_health_camp_records_occurred ON health_camp_records (occurred_at DESC);

-- EV bus telemetry
CREATE TABLE IF NOT EXISTS ev_bus_telemetry (
    telemetry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_record_id    TEXT NOT NULL,
    bus_id              TEXT NOT NULL,
    route_id            TEXT,
    ward_id             TEXT NOT NULL,
    speed_kmph          INTEGER,
    battery_soc         INTEGER,
    passenger_count     INTEGER,
    bus_status          TEXT NOT NULL DEFAULT 'in-service',
    event_type          TEXT NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ev_bus_telemetry_bus_id   ON ev_bus_telemetry (bus_id);
CREATE INDEX IF NOT EXISTS idx_ev_bus_telemetry_ward_id  ON ev_bus_telemetry (ward_id);
CREATE INDEX IF NOT EXISTS idx_ev_bus_telemetry_occurred ON ev_bus_telemetry (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ev_bus_telemetry_status   ON ev_bus_telemetry (bus_status);

-- Query audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    role            TEXT NOT NULL,
    sql_query       TEXT NOT NULL,
    status          TEXT NOT NULL,
    block_reason    TEXT,
    row_count       INTEGER,
    ip_address      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_username  ON audit_logs (username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status    ON audit_logs (status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
