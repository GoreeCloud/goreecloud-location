# Development Runtime

GoreeCloud Location remains in the **Development** lifecycle. This runtime exists only to validate the native database and API foundation. It is not a production deployment definition and does not authorize replacing Dawarich, Traccar, or any current GoreeCloud Location service.

## Development PostGIS

The development database uses PostgreSQL 17 with PostGIS 3.5 through the `postgis/postgis:17-3.5` image pinned to the exact manifest digest:

```text
sha256:83e9999dc3ad8390c210e76130c3a16365ef4f957bb55200d22b7937cfbcb321
```

The digest is intentionally stored in the Compose file and CI workflow so recreating the development environment does not silently move to different image content. Production image selection remains a separate future approval.

The database publishes only to loopback by default. It is not intended for LAN or public exposure.

## Local secret handling

The active `.env` and `.secrets/` directory are local-only protected configuration and are ignored by Git. The committed `.env.example` contains only the variable structure and a file-based secret path.

Run:

```bash
./scripts/dev/database-up.sh
```

The script:

1. creates a restrictive local `.env` from `.env.example` when needed;
2. creates a random local development database secret without printing it;
3. validates the resolved Compose configuration;
4. starts only the development PostGIS service;
5. waits for PostgreSQL readiness;
6. applies unapplied SQL migrations; and
7. runs the database integration acceptance SQL.

Stop the database without deleting its named development volume:

```bash
./scripts/dev/database-down.sh
```

## Migration behavior

Migration `0001_users_devices_locations` creates the initial `schema_migrations` ledger in the same transaction as the ownership-first user/device/location schema. The local migration runner skips a migration only when its exact filename-derived version is already recorded.

The initial integration test proves that:

- PostGIS is installed;
- migration 0001 is recorded;
- a valid user/device location sample can be stored;
- a location sample cannot claim another user's device;
- duplicate client sample IDs for one device are rejected; and
- a real PostGIS geography-distance operation behaves as expected.

All integration fixtures execute inside a transaction that is rolled back.

## API health and readiness

`GET /healthz` proves that the HTTP process can answer a request.

`GET /readyz` additionally requires the configured database TCP endpoint to be reachable. During Milestone 0 this is intentionally a dependency-connectivity check rather than a full authenticated SQL/schema check. CI separately performs real PostgreSQL/PostGIS migration and behavior validation. A later persistence milestone will replace the socket-only readiness dependency with the application's authenticated database pool and schema-aware readiness behavior.

The readiness response never returns database hostnames, credentials, coordinates, user identifiers, or other private data.

## CI boundary

Pull-request CI now validates three independent areas:

- Go API formatting, vetting, tests, and build;
- a real pinned PostGIS runtime, migration execution, ownership constraints, geospatial behavior, and API readiness against the running database; and
- the TypeScript web build.

Green CI proves the reviewed source candidate works in the CI development runtime. It does not prove backup/restore, target-host deployment, native tracking, multi-user application authorization, or production acceptance.
