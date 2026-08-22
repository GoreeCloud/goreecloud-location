# GoreeCloud Location

Privacy-first, self-hosted location history, real-time tracking, geofencing, travel insights, device tracking, and family location sharing for GoreeCloud.

> **Release lifecycle:** Development
>
> GoreeCloud Location is not production-ready. The repository currently contains the native project foundation and early API/schema/runtime work.

## Purpose

GoreeCloud Location is the first-party GoreeCloud application and service for private location history, live tracking, multi-user and family sharing, geofencing, trips, places, maps, device tracking, and location analytics.

The product combines two capability domains behind one user experience:

- **Live tracking:** where an approved user or device is now.
- **Location history:** where an approved user or device has been over time.

Dawarich, Google Timeline, and Traccar are capability references. They are not intended to remain permanent architectural authorities for the native product.

## Governing principles

- Location data is private by default.
- Every location sample has an explicit owning user and source device.
- Application administration does not automatically grant access to ordinary users' location histories.
- Sharing is explicit, revocable, scoped, and independently controllable for live and historical data.
- Device credentials are distinct from interactive user sessions.
- Raw precise coordinates must not be written to ordinary application logs.
- No advertising, behavioral advertising, or sale of location data is permitted.
- Mapping, geocoding, and routing dependencies must remain replaceable.
- Data must remain exportable in open, documented formats.

## Planned architecture

```text
Web / Android / future iOS
          |
          v
     Location API v1
          |
   +------+------+----------------+
   |             |                |
Ingestion   History/Trips   Geofence/Events
   |             |                |
   +-------------+----------------+
                 |
          PostgreSQL + PostGIS
```

The primary implementation direction is:

- **Web:** TypeScript using Glaze UI conventions.
- **API and long-running services:** Go.
- **Android:** native Kotlin.
- **Database:** PostgreSQL with PostGIS.
- **Deployment:** self-hosted GoreeCloud infrastructure with approved HTTPS/private-access controls.

## Repository layout

```text
.github/             CI and repository automation
apps/web/            GoreeCloud Location web client
apps/android/        Native Android client
assets/brand/        Official application icon, logo, and artwork
services/api/        Versioned HTTP API and ingestion service
services/worker/     Background processing and derived-data jobs
migrations/          Authoritative SQL schema migrations
tests/integration/   Runtime database acceptance checks
scripts/dev/         Controlled local-development helpers
docs/                Architecture, security, privacy, and development documentation
deploy/              Development deployment definitions and operational notes
```

Some directories begin as documented boundaries and will gain implementation as their milestone starts.

## Development runtime

Milestone 0 includes a development-only PostgreSQL/PostGIS runtime so migrations, ownership constraints, geospatial behavior, and API dependency readiness can be tested against a real database without implying production deployment.

Start and validate the local database with:

```bash
./scripts/dev/database-up.sh
```

The script creates local protected configuration when needed, starts the digest-pinned development PostGIS container, applies unapplied migrations, and runs database integration acceptance. Stop it with `./scripts/dev/database-down.sh`.

See [docs/development-runtime.md](docs/development-runtime.md) for the exact development boundary, secret handling, image pin, migration behavior, and CI acceptance scope.

## Initial milestones

1. **Milestone 0 — Foundation:** repository structure, CI, API skeleton, schema, development PostGIS runtime, migration validation, documentation, security baseline.
2. **Milestone 1 — Users and devices:** authentication, ownership isolation, device enrollment, device-scoped credentials.
3. **Milestone 2 — Native tracking:** ingestion, Android collector prototype, offline queue, live map.
4. **Milestone 3 — History:** timeline, paths, filtering, distance and playback foundations.
5. **Milestone 4+ — Places, sharing, geofencing, trips, insights, migration, portability, and native cutover.**

## API boundary

The first-party API is versioned under `/api/v1/`. Client-supplied user identifiers must never be trusted as ownership authority for device-ingested location samples; ownership is derived from the authenticated device credential.

Initial service endpoints include health and readiness surfaces only. `/healthz` reports process liveness. `/readyz` currently verifies that the configured database endpoint is reachable; CI separately performs authenticated PostgreSQL/PostGIS migration and behavior validation. User, device, location, sharing, and geospatial APIs will be introduced through reviewed milestones.

## Security and privacy

Location information is highly sensitive. Before production approval, GoreeCloud Location must demonstrate server-side multi-user isolation, safe authorization failure, credential revocation, secure transport, least privilege, data-retention controls, export/deletion behavior, backup and restore, monitoring, and representative end-to-end privacy/security acceptance.

See [docs/security.md](docs/security.md) and [docs/privacy.md](docs/privacy.md).

## License

GoreeCloud Location is licensed under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE).
