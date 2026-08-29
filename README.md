# GoreeCloud Location

GoreeCloud Location is GoreeCloud's privacy-first, first-party location application and service for live tracking, location history, device state, and the staged path toward sharing, geofencing, trips, places, Find My recovery, and location analytics.

## Status

**Development — not production-ready.**

The repository currently contains a validated Development PostgreSQL/PostGIS runtime, authenticated multi-user/device foundations, native device-authenticated sample ingestion, owner-scoped history/live reads, a Glaze UI 2.0 web experience, server-enforced tracking pause/resume, an owner-scoped **read-only Timeline surface**, an owner-scoped **Find My device-state surface**, and an owner-scoped **Find My recovery-capability gate**.

Source/CI validation does not establish production deployment, production identity, geographic map delivery, background tracking acceptance, recovery command authority, anti-stalking acceptance, release, or Stable qualification.

## Governing principles

- Location data is private by default.
- Every accepted sample has an explicit owning user and source device.
- Administration does not automatically grant access to ordinary users' location histories.
- Sharing must be explicit, revocable, and independently scoped when implemented.
- Device credentials are distinct from interactive user sessions.
- Raw precise coordinates must not be written to ordinary application logs.
- Tracking pause and device revocation are server-enforced boundaries.
- No advertising, behavioral advertising, or sale of location data is permitted.
- Mapping, geocoding, and routing dependencies must remain replaceable.
- Data must remain exportable through documented accepted formats when portability features are implemented.
- Find My Stable qualification requires dedicated privacy, recovery, abuse-prevention, security, continuity, and anti-stalking acceptance.

## Current architecture

```text
Web / Android / future approved clients
          |
          v
     Location API v1
          |
   +------+------+----------------+
   |             |                |
Ingestion   History/Live    Find My capability state
   |             |                |
   +-------------+----------------+
                 |
          PostgreSQL + PostGIS
```

Current implementation direction:

- **Web:** TypeScript with Glaze UI 2.0 source targets.
- **API/services:** Go.
- **Android:** native Kotlin direction/current foundation where implemented.
- **Database:** PostgreSQL + PostGIS.
- **Maps:** replaceable MapLibre-compatible provider architecture; production geographic delivery is not yet accepted.
- **Deployment:** controlled self-hosted GoreeCloud infrastructure when production gates are satisfied.

## Current authenticated web experience

The Development web client can use an interim session-scoped user credential to access owner-scoped state. The credential is stored in browser `sessionStorage` and removed at sign-out. This is not the final production GoreeCloud Identity session design.

The Live experience supports authenticated identity, live/last-known device state, sample age, accuracy, optional battery information, stale/no-location states, manual refresh, periodic automatic refresh, and server-enforced tracking pause/resume.

The read-only Timeline reuses the same authenticated owner-scoped history API and renders at most 50 newest persisted samples. It provides an in-view enrolled-device filter and shows capture time, coordinates, accuracy, source, and server-received time. Timeline does not infer a route, visit, stay, trip, transport mode, geofence, or current connectivity state from historical samples.

The browser never supplies an authoritative user ID; the server derives ownership from the authenticated credential.

### Geographic map boundary

Coordinates are available from the native API and persisted in PostGIS, but the current web surface does not claim production geographic map delivery. Map tiles remain gated until the replaceable provider adapter and its privacy/security/operational acceptance are complete.

## Current Find My Development surface

Find My is a first-party GoreeCloud Location capability. The merged Development source includes an owner-scoped device discovery/state surface rather than only a planned navigation destination.

Current implemented presentation includes:

- owner-scoped device search/listing;
- responsive device state cards;
- explicit Live / Recent / Stale / Offline / Unavailable presentation;
- last-location age and accuracy when available;
- optional battery information;
- sanitized diagnostic state; and
- server-authoritative recovery capability state.

`GET /api/v1/find-my/recovery-capabilities` is authenticated through the existing user boundary and returns capability state only for the authenticated owner's enrolled devices. Lost Mode, Play Sound, and Mark Found are currently denied server-side. Active enrollments report `recovery_authority_unavailable`; revoked enrollments report `device_enrollment_revoked`. The web client keeps controls disabled if the capability response is missing or unavailable.

Current source does **not** establish Lost Mode execution, remote erase, nearby finding, offline finding, Find My Network, trusted-place recovery, anti-stalking runtime acceptance, or production recovery authority. `Offline` is a Development state derived from available sample/device recency, not proof of a real-time network connectivity probe.

## API boundary

The first-party API is versioned under `/api/v1/`. Ownership comes from authenticated user/device credentials, never request-supplied user identifiers.

Current Development endpoints include health/readiness, authenticated identity, owner-scoped device listing/enrollment/revocation, owner preferences/tracking pause, authenticated device identity, device-authenticated location ingestion, owner-scoped location history, owner-scoped live state, and owner-scoped Find My recovery capability state.

The ingestion path validates bounded sample data, derives ownership from the device credential, rejects user-session credentials for device ingestion, enforces idempotency, rechecks revocation, enforces tracking pause in the transaction, and stores location through the PostGIS ownership schema.

## Security, privacy, and platform systems

- **Privacy Shield / Privacy Center:** privacy, consent, minimization, retention/user control, sharing, and location-sensitive data governance.
- **Wardveil Security / Security Center:** applicable protection, trust, verification, anti-abuse, recovery-security, and response controls.
- **Everkeep / Continuity Center:** accepted export, backup, recovery, preservation, portability, and succession.
- **GoreeCloud Identity / Identity Center:** production user/device/account/session authority.
- **GoreeCloud Mesh / Mesh Center:** authenticated policy-controlled cross-service coordination.
- **Glaze UI / Design Center:** approved interface/design-system governance.

Passing source tests does not constitute production acceptance of these systems.

## Current limitations

Still incomplete or separately gated:

- production GoreeCloud Identity browser/device integration;
- production geographic map/geocoding/routing provider deployment;
- Android background collection and representative-device acceptance;
- encrypted offline queue/synchronization;
- general sharing/public links;
- Timeline retention/purge/export controls, route inference, trips, places, geofences, and insights;
- production Find My recovery commands and offline/nearby finding;
- anti-stalking runtime acceptance;
- full portability/backup/restore acceptance;
- production deployment, signed release, and Stable qualification.

## Documentation

- [USER-MANUAL.md](USER-MANUAL.md)
- [SPECIFICATIONS.md](SPECIFICATIONS.md)
- [docs/development-runtime.md](docs/development-runtime.md)
- [docs/authentication.md](docs/authentication.md)
- [docs/tracking.md](docs/tracking.md)
- [docs/live-web-experience.md](docs/live-web-experience.md)
- [docs/timeline-development-surface.md](docs/timeline-development-surface.md)
- [docs/find-my-development-surface.md](docs/find-my-development-surface.md)
- [docs/security.md](docs/security.md)
- [docs/privacy.md](docs/privacy.md)

## License

GNU Affero General Public License v3.0. See `LICENSE`.
