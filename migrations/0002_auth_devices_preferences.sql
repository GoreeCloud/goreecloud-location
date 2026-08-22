-- GoreeCloud Location migration 0002
--
-- Adds the first authenticated multi-user persistence boundary. User and device
-- bearer credentials are stored only as SHA-256 hashes of high-entropy opaque
-- tokens. Device credentials are constrained to the same owning user as their
-- device, and user preferences are one-to-one with their owner.

BEGIN;

CREATE TABLE user_access_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    label text NOT NULL CHECK (length(trim(label)) > 0),
    expires_at timestamptz,
    revoked_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX user_access_tokens_user_id_idx ON user_access_tokens(user_id);
CREATE INDEX user_access_tokens_active_hash_idx
    ON user_access_tokens(token_hash)
    WHERE revoked_at IS NULL;

CREATE TABLE device_credentials (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    device_id uuid NOT NULL,
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    label text NOT NULL CHECK (length(trim(label)) > 0),
    expires_at timestamptz,
    revoked_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT device_credentials_device_owner_fk
        FOREIGN KEY (user_id, device_id)
        REFERENCES devices(user_id, id)
        ON DELETE CASCADE,
    CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX device_credentials_user_id_idx ON device_credentials(user_id);
CREATE INDEX device_credentials_device_id_idx ON device_credentials(device_id);
CREATE INDEX device_credentials_active_hash_idx
    ON device_credentials(token_hash)
    WHERE revoked_at IS NULL;

CREATE TABLE user_preferences (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    time_zone text NOT NULL DEFAULT 'UTC' CHECK (length(trim(time_zone)) > 0),
    distance_unit text NOT NULL DEFAULT 'metric' CHECK (distance_unit IN ('metric', 'imperial')),
    tracking_paused boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO user_preferences(user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO schema_migrations(version)
VALUES ('0002_auth_devices_preferences')
ON CONFLICT (version) DO NOTHING;

COMMIT;
