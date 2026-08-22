# Development Runtime

GoreeCloud Location remains in the **Development** lifecycle. This runtime exists only to validate the native database, authentication, authorization, and API foundation. It is not a production deployment definition and does not authorize replacing Dawarich, Traccar, or any current GoreeCloud Location service.

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

Migration `0001_users_devices_locations` creates the initial `schema_migrations` ledger in the same transaction as the ownership-first user/device/location schema. Migration `0002_auth_devices_preferences` adds hashed user access tokens, device-scoped credentials, and owner-scoped preferences. The local migration runner skips a migration only when its exact filename-derived version is already recorded.

The database integration acceptance proves that:

- PostGIS is installed;
- migrations 0001 and 0002 are recorded;
- a valid user/device location sample can be stored;
- a location sample cannot claim another user's device;
- a device credential cannot claim another user's device;
- duplicate client sample IDs for one device are rejected; and
- a real PostGIS geography-distance operation behaves as expected.

Database integration fixtures execute inside a transaction that is rolled back.

## API health and readiness

`GET /healthz` proves that the HTTP process can answer a request.

`GET /readyz` now uses the application's authenticated PostgreSQL connection pool. Readiness requires a successful database ping and verifies that migration `0002_auth_devices_preferences` is recorded. A reachable TCP socket without successful database authentication and the required schema is no longer considered ready.

The readiness response never returns database hostnames, credentials, coordinates, user identifiers, device identifiers, or other private data.

## Authenticated runtime acceptance

CI also runs an API-level two-user acceptance scenario against the ephemeral PostGIS service. It uses the administrative bootstrap command to create two independent users, enrolls separate devices, and verifies:

- invalid user credentials fail authentication;
- each user identity resolves only from its own credential;
- each user sees only their own devices;
- a device credential resolves only its own owner and device;
- one user cannot revoke another user's device through direct object access;
- user preferences remain isolated between users; and
- revoking a device invalidates its device credential.

The CI database is disposable. Synthetic acceptance users and credentials are not production data, and credential values are not written to source or ordinary application logs.

## CI boundary

Pull-request CI validates three independent areas:

- Go API and admin-tool dependency verification, formatting, vetting, tests, and builds;
- a real pinned PostGIS runtime, migration execution, schema ownership constraints, geospatial behavior, schema-aware readiness, and authenticated two-user/device isolation acceptance; and
- the TypeScript web build.

Green CI proves the reviewed source candidate works in the CI development runtime. It does not prove backup/restore, target-host deployment, native tracking, public-network security, sharing, migration from incumbent location services, Android acceptance, or production acceptance.
