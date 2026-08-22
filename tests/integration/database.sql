\set ON_ERROR_STOP on

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        RAISE EXCEPTION 'PostGIS extension is not installed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM schema_migrations
        WHERE version = '0001_users_devices_locations'
    ) THEN
        RAISE EXCEPTION 'migration 0001 is not recorded';
    END IF;
END
$$;

BEGIN;

INSERT INTO users(id, display_name)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Integration User A'),
    ('00000000-0000-0000-0000-000000000002', 'Integration User B');

INSERT INTO devices(id, user_id, display_name, device_class)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Device A', 'phone'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Device B', 'phone');

INSERT INTO location_samples(
    id,
    user_id,
    device_id,
    client_sample_id,
    captured_at,
    position,
    accuracy_m,
    source
)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'sample-a-1',
    now(),
    ST_SetSRID(ST_MakePoint(-90.0715, 29.9511), 4326)::geography,
    5,
    'integration-test'
);

DO $$
BEGIN
    BEGIN
        INSERT INTO location_samples(
            id,
            user_id,
            device_id,
            client_sample_id,
            captured_at,
            position,
            source
        )
        VALUES (
            '20000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000001',
            'cross-owner-sample',
            now(),
            ST_SetSRID(ST_MakePoint(-90.0715, 29.9511), 4326)::geography,
            'integration-test'
        );
        RAISE EXCEPTION 'cross-user device ownership was incorrectly accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN
            NULL;
    END;
END
$$;

DO $$
BEGIN
    BEGIN
        INSERT INTO location_samples(
            id,
            user_id,
            device_id,
            client_sample_id,
            captured_at,
            position,
            source
        )
        VALUES (
            '20000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001',
            'sample-a-1',
            now(),
            ST_SetSRID(ST_MakePoint(-90.0715, 29.9511), 4326)::geography,
            'integration-test'
        );
        RAISE EXCEPTION 'duplicate device client sample was incorrectly accepted';
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;
END
$$;

DO $$
DECLARE
    nearby boolean;
BEGIN
    SELECT ST_DWithin(
        position,
        ST_SetSRID(ST_MakePoint(-90.0715, 29.9511), 4326)::geography,
        10
    )
    INTO nearby
    FROM location_samples
    WHERE id = '20000000-0000-0000-0000-000000000001';

    IF nearby IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'PostGIS geography query did not return the expected result';
    END IF;
END
$$;

ROLLBACK;
