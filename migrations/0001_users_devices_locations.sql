-- GoreeCloud Location migration 0001
--
-- Establishes the minimum ownership boundary required before any location
-- ingestion work begins. Every accepted location sample is explicitly owned by
-- one user and one device, and the composite foreign key proves that the device
-- belongs to that same user.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    id uuid PRIMARY KEY,
    display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
    device_class text NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, id)
);

CREATE INDEX devices_user_id_idx ON devices(user_id);

CREATE TABLE location_samples (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id uuid NOT NULL,
    client_sample_id text NOT NULL CHECK (length(trim(client_sample_id)) > 0),
    captured_at timestamptz NOT NULL,
    server_received_at timestamptz NOT NULL DEFAULT now(),
    position geography(Point, 4326) NOT NULL,
    accuracy_m double precision CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
    altitude_m double precision,
    speed_mps double precision CHECK (speed_mps IS NULL OR speed_mps >= 0),
    bearing_deg double precision CHECK (
        bearing_deg IS NULL OR (bearing_deg >= 0 AND bearing_deg < 360)
    ),
    battery_percent smallint CHECK (
        battery_percent IS NULL OR (battery_percent >= 0 AND battery_percent <= 100)
    ),
    source text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT location_samples_device_owner_fk
        FOREIGN KEY (user_id, device_id)
        REFERENCES devices(user_id, id)
        ON DELETE CASCADE,
    CONSTRAINT location_samples_device_client_sample_unique
        UNIQUE (device_id, client_sample_id)
);

CREATE INDEX location_samples_user_captured_at_idx
    ON location_samples(user_id, captured_at DESC);

CREATE INDEX location_samples_device_captured_at_idx
    ON location_samples(device_id, captured_at DESC);

CREATE INDEX location_samples_position_gist_idx
    ON location_samples USING GIST(position);

INSERT INTO schema_migrations(version)
VALUES ('0001_users_devices_locations')
ON CONFLICT (version) DO NOTHING;

COMMIT;
