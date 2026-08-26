# GoreeCloud Location

Privacy-first, self-hosted location history, real-time tracking, geofencing, travel insights, device tracking, and family location sharing for GoreeCloud.

> **Release lifecycle:** Development
>
> GoreeCloud Location is not production-ready. The repository contains the native foundation, validated development PostgreSQL/PostGIS runtime, authenticated multi-user and device foundation, native device-authenticated tracking, owner-scoped history/live reads, and the first authenticated Glaze UI Live experience.

## Purpose

GoreeCloud Location is the first-party GoreeCloud application and service for private location history, live tracking, multi-user and family sharing, geofencing, trips, places, maps, device tracking, Find My, and location analytics.

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
- Tracking pause and device revocation must be enforced by the server, not only by clients.
- No advertising, behavioral advertising, or sale of location data is permitted.
- Mapping, geocoding, and routing dependencies must remain replaceable.
- Data must remain exportable in open, documented formats.
- Find My capabilities must be anti-stalking-aware and evidence-backed before Stable qualification.

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
- **Maps:** open, replaceable MapLibre-compatible provider architecture.
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
tests/integration/   Runtime database, authorization, and tracking acceptance
scripts/dev/         Controlled local-development helpers
docs/                Architecture, security, privacy, tracking, and development documentation
deploy/              Development deployment definitions and operational notes
```

Some directories begin as documented boundaries and gain implementation as their milestone starts.

## Development runtime

Milestone 0 established a development-only PostgreSQL/PostGIS runtime so migrations, ownership constraints, geospatial behavior, and API dependency readiness can be tested against a real database without implying production deployment. Milestone 1 added authenticated persistence and two-user authorization acceptance. Milestone 2 now exercises native sample ingestion and owner-scoped tracking reads against the same real PostGIS path and adds the first authenticated Live web experience over those contracts.

Start and validate the local database with:

```bash
./scripts/dev/database-up.sh
```

The script creates local protected configuration when needed, starts the digest-pinned development PostGIS container, applies unapplied migrations, and runs database integration acceptance. Stop it with `./scripts/dev/database-down.sh`.

See [docs/development-runtime.md](docs/development-runtime.md) for the development boundary, [docs/authentication.md](docs/authentication.md) for the user/device authentication model, [docs/tracking.md](docs/tracking.md) for the native tracking API and privacy boundary, and [docs/live-web-experience.md](docs/live-web-experience.md) for the current Glaze UI Live contract.

## Initial milestones

1. **Milestone 0 — Foundation:** repository structure, CI, API skeleton, schema, development PostGIS runtime, migration validation, documentation, security baseline.
2. **Milestone 1 — Users and devices:** authenticated user persistence, ownership isolation, device enrollment, device-scoped credentials, revocation, and user preferences.
3. **Milestone 2 — Native tracking:** device-authenticated ingestion, owner-scoped live/history API, and authenticated Live web experience; Android collector prototype, encrypted offline queue/synchronization, authenticated live-update transport, and geographic map-provider integration remain later Milestone 2 work.
4. **Milestone 3 — History:** timeline, paths, filtering, distance and playback foundations.
5. **Milestone 4+ — Places, sharing, geofencing, trips, insights, migration, portability, Find My expansion, and native cutover.**

## Current Live web experience

The TypeScript web application now provides a responsive Glaze UI shell over the authenticated native API. It supports session-scoped user credential entry, authenticated identity, live and last-known device state, sample age, accuracy, optional battery information, explicit stale/no-location states, manual refresh, 30-second automatic refresh, and server-enforced tracking pause/resume.

The interface does not accept a client-supplied user ID as authority. The server derives ownership from the authenticated user credential. The development credential is kept in browser `sessionStorage` and removed at sign-out; this remains an interim development UX until GoreeCloud Identity browser-session integration is implemented.

The Live map surface deliberately does not claim geographic mapping yet. Coordinates are already available from the native API, but map tiles remain disabled until the replaceable MapLibre-compatible provider adapter is implemented and reviewed. The stored PostGIS geospatial record remains authoritative.

## API boundary

The first-party API is versioned under `/api/v1/`. Client-supplied user identifiers are never trusted as ownership authority. User-scoped resources derive ownership from the authenticated user credential. Location ingestion derives both user and device ownership from the authenticated device credential and does not accept request-supplied ownership identifiers.

Current development endpoints include:

- `GET /healthz` — process liveness;
- `GET /readyz` — authenticated PostgreSQL connectivity plus required schema-migration readiness;
- `GET /api/v1/me` — authenticated user identity;
- `GET|POST /api/v1/devices` — owner-scoped device listing and enrollment;
- `DELETE /api/v1/devices/{deviceID}` — owner-scoped device and credential revocation;
- `GET|PUT /api/v1/preferences` — owner-scoped preferences and tracking-pause control;
- `GET /api/v1/device` — authenticated device identity;
- `POST /api/v1/locations` — device-authenticated native location ingestion;
- `GET /api/v1/locations` — owner-scoped location history with bounded filters; and
- `GET /api/v1/live` — owner-scoped most-recent location state for active devices.

The tracking API is intentionally narrow. It does not yet provide user-to-user sharing, public links, Android background collection, offline synchronization, route/timeline inference, places, trips, geofences, or a production tracking cutover.

## Native tracking boundary

A native sample requires a client-generated idempotency identifier, a capture timestamp, latitude, and longitude. Optional accuracy, altitude, speed, bearing, and battery information may be supplied within validated bounds.

The server:

- derives the owning user and source device from the device credential;
- rejects user-session credentials for device ingestion;
- rejects missing, malformed, impossible, or excessively future-dated samples;
- stores coordinates through the existing PostGIS `geography(Point, 4326)` ownership schema;
- treats a repeated `(device_id, client_sample_id)` with the same normalized payload as an idempotent retry;
- rejects the same idempotency identifier with a conflicting payload;
- rechecks device revocation inside the ingestion transaction;
- rechecks and locks the user's tracking-pause preference before persistence; and
- scopes history and live queries to the authenticated user on the server.

See [docs/tracking.md](docs/tracking.md) for the detailed contract and validation limits.

## Find My direction

Find My is a first-party GoreeCloud Location capability, not a disconnected service. Its planned native scope includes device finding, nearby finding, Lost Mode, protected remote recovery, offline finding, Find My Network, trusted places, theft-protection correlation, recovery contacts, and mandatory anti-stalking protections.

None of those capabilities are considered implemented merely because the Live web navigation exposes a planned Find My destination. Find My Stable qualification requires the dedicated Privacy Shield, Wardveil Security, Everkeep, recovery, cryptographic, abuse-prevention, and anti-stalking acceptance gates defined by the GoreeCloud Location project specification.

## Security and privacy

Location information is highly sensitive. Current development acceptance exercises independent user identities, owner-scoped device visibility, cross-user object-access rejection, owner-scoped preferences, device-specific credentials, credential invalidation after device revocation, native sample ownership, idempotency, user-separated history/live reads, tracking pause, malformed-sample rejection, and ordinary-log checks for tested bearer credentials and precise coordinates. Opaque credentials are persisted only as SHA-256 hashes; plaintext credentials are returned only at issuance.

Production approval still requires the complete GoreeCloud Location production-readiness gates, including secure transport, rate limiting, broader privacy and retention controls, sharing revocation, import/export behavior, backup and restore, monitoring, native-client acceptance, representative end-to-end security/privacy review, and Android background-tracking acceptance on supported devices.

See [docs/security.md](docs/security.md), [docs/privacy.md](docs/privacy.md), [docs/authentication.md](docs/authentication.md), [docs/tracking.md](docs/tracking.md), and [docs/live-web-experience.md](docs/live-web-experience.md).

## License

GoreeCloud Location is licensed under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE).
