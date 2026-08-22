# GoreeCloud Location

Privacy-first, self-hosted location history, real-time tracking, geofencing, travel insights, device tracking, and family location sharing for GoreeCloud.

> **Release lifecycle:** Development
>
> GoreeCloud Location is not production-ready. The repository contains the native foundation, validated development PostGIS runtime, and the Milestone 1 authenticated user/device foundation.

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
services/api/        Versioned HTTP API and administrative tooling
services/worker/     Background processing and derived-data jobs
migrations/          Authoritative SQL schema migrations
tests/integration/   Runtime database and authorization acceptance checks
scripts/dev/         Controlled local-development helpers
docs/                Architecture, security, privacy, and development documentation
deploy/              Development deployment definitions and operational notes
```

Some directories begin as documented boundaries and will gain implementation as their milestone starts.

## Development runtime

Milestone 0 established a development-only PostgreSQL/PostGIS runtime so migrations, ownership constraints, geospatial behavior, and API dependency readiness can be tested against a real database without implying production deployment. Milestone 1 uses that runtime for authenticated persistence and two-user authorization acceptance.

Start and validate the local database with:

```bash
./scripts/dev/database-up.sh
```

The script creates local protected configuration when needed, starts the digest-pinned development PostGIS container, applies unapplied migrations, and runs database integration acceptance. Stop it with `./scripts/dev/database-down.sh`.

See [docs/development-runtime.md](docs/development-runtime.md) for the development boundary and [docs/authentication.md](docs/authentication.md) for the current user/device authentication model.

## Initial milestones

1. **Milestone 0 — Foundation:** repository structure, CI, API skeleton, schema, development PostGIS runtime, migration validation, documentation, security baseline.
2. **Milestone 1 — Users and devices:** authenticated user persistence, ownership isolation, device enrollment, device-scoped credentials, revocation, and user preferences.
3. **Milestone 2 — Native tracking:** ingestion, Android collector prototype, offline queue, live map.
4. **Milestone 3 — History:** timeline, paths, filtering, distance and playback foundations.
5. **Milestone 4+ — Places, sharing, geofencing, trips, insights, migration, portability, and native cutover.**

## API boundary

The first-party API is versioned under `/api/v1/`. Client-supplied user identifiers are never trusted as ownership authority. User-scoped resources derive ownership from the authenticated user credential, and future device-ingested location samples will derive both user and device ownership from the authenticated device credential.

Current development endpoints include:

- `GET /healthz` — process liveness;
- `GET /readyz` — authenticated PostgreSQL connectivity plus required schema-migration readiness;
- `GET /api/v1/me` — authenticated user identity;
- `GET|POST /api/v1/devices` — owner-scoped device listing and enrollment;
- `DELETE /api/v1/devices/{deviceID}` — owner-scoped device and credential revocation;
- `GET|PUT /api/v1/preferences` — owner-scoped preferences; and
- `GET /api/v1/device` — authenticated device identity.

Location ingestion intentionally remains unavailable until Milestone 2 implements its validation, authorization, idempotency, and tracking-policy boundary.

## Security and privacy

Location information is highly sensitive. Current Milestone 1 acceptance exercises independent user identities, owner-scoped device visibility, cross-user object-access rejection, owner-scoped preferences, device-specific credentials, and credential invalidation after device revocation. Opaque credentials are persisted only as SHA-256 hashes; plaintext credentials are returned only at issuance.

Production approval still requires the complete GoreeCloud Location production-readiness gates, including broader multi-user isolation, secure transport, rate limiting, data-retention controls, sharing revocation, import/export behavior, backup and restore, monitoring, native-client acceptance, and representative end-to-end privacy/security review.

See [docs/security.md](docs/security.md), [docs/privacy.md](docs/privacy.md), and [docs/authentication.md](docs/authentication.md).

## License

GoreeCloud Location is licensed under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE).
