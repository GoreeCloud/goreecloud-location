# GoreeCloud Location — Repository Specifications

Status: Development  
Canonical project record: `GoreeCloud/Projects/Project Specification — Location`  
Repository: `GoreeCloud/goreecloud-location`

## Product boundary

GoreeCloud Location is the first-party GoreeCloud location platform for owner-scoped location history, live device tracking, Find My, sharing, places, geofencing, trips, and related recovery workflows. It is a native GoreeCloud application/service, not a permanent fork of another location product.

## Current implemented foundation

- Go HTTP service with authenticated user and device boundaries.
- PostgreSQL/PostGIS persistence and tested multi-user ownership isolation.
- Device enrollment, revocation, device-scoped credentials, and tracking pause enforcement.
- Device-authenticated location ingestion with idempotency and validation.
- Owner-scoped live and historical location reads.
- TypeScript web Live surface and Development Find My device/recovery-state surface.
- Native Android collector/retry foundations present in the repository.

## Required platform integration

Applicable surfaces must integrate the current approved GoreeCloud platform systems, including GoreeCloud Identity, Privacy Shield, Wardveil Security, Everkeep, GoreeCloud Mesh, and Glaze UI. The current UI design target is Glaze UI 2.0.0 Stable or newer. Rendered conformance is an acceptance gate and is not implied by source labels alone.

## Privacy and security requirements

- Precise location is private by default.
- Authorization must derive ownership from authenticated identity/device state, never request-supplied user IDs.
- Tracking pause and device revocation are server-enforced.
- Raw precise coordinates must not be written to ordinary application logs.
- Sharing must be explicit, scoped, revocable, and separately controllable for live/history access.
- Find My recovery and offline-finding features require anti-stalking, abuse-prevention, cryptographic, Privacy Shield, Wardveil, and Everkeep acceptance before Stable promotion.

## Current acceptance boundary

The repository remains Development. Passing source/build/database tests does not establish production deployment, rendered browser acceptance, production Identity integration, anti-stalking acceptance, geographic map-provider deployment, sharing acceptance, or production readiness.

## Next engineering priorities

1. Complete rendered Glaze UI 2.0 acceptance for Live/Find My surfaces.
2. Complete browser-session integration with GoreeCloud Identity.
3. Add replaceable geographic map-provider integration without weakening privacy boundaries.
4. Continue native Android collection/offline synchronization acceptance.
5. Implement sharing, retention, export, recovery, anti-stalking, and production security gates.