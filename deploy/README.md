# Deployment

GoreeCloud Location is not yet authorized for production deployment.

The intended production model remains a self-hosted web/API/worker stack using PostgreSQL with PostGIS, approved GoreeCloud HTTPS publication, private connectivity where required, monitoring, notification integration, and Everkeep-aligned backup/recovery.

## Development runtime now available

`compose.development.yml` is a **development-only** PostGIS runtime. It exists to validate database migrations, ownership constraints, geospatial operations, authenticated persistence, user/device isolation, and API readiness during the Foundation and Users-and-Devices milestones. It is not the future production stack and must not be used as evidence of a production cutover.

The development database:

- uses `postgis/postgis:17-3.5` pinned to exact manifest digest `sha256:83e9999dc3ad8390c210e76130c3a16365ef4f957bb55200d22b7937cfbcb321`;
- binds PostgreSQL to loopback by default;
- obtains its local password from a Docker secret file rather than a committed environment value;
- stores mutable database state in a named development volume; and
- exposes a PostgreSQL health check used only for development/runtime validation.

The committed `.env.example` is sanitized. Active `.env` files and `.secrets/` content remain outside Git history. Application readiness uses authenticated PostgreSQL access and required-schema verification; the database container health check is only one lower-level dependency signal.

See `docs/development-runtime.md` and `docs/authentication.md` for the supported development workflow and credential boundary.

## Production boundary

A production Compose stack remains intentionally deferred until database credentials, application container builds, authenticated database readiness, migration forward/recovery behavior, persistent storage ownership, image pinning, backup/restore, observability, release identity, and rollback expectations are designed and validated together.

Future production definitions must:

- keep PostgreSQL and administrative ports off direct public exposure;
- use secrets outside ordinary revision history;
- pin third-party container dependencies according to GoreeCloud policy;
- provide health/readiness checks that do not expose private user information;
- separate network access from application authentication and authorization;
- document persistent volumes, ownership, backup, restore, and migration behavior;
- define a credible rollback or known-good path before production cutover;
- preserve the transitional Dawarich/Traccar services until native migration and acceptance gates support retirement.
