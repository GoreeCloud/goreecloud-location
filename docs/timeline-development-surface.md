# GoreeCloud Location Timeline development surface

GoreeCloud Location's first Timeline surface is intentionally read-only and reuses the existing authenticated `GET /api/v1/locations` history authority.

## Current behavior

- The browser requests at most 50 recent persisted samples for the authenticated user.
- The server remains authoritative for ownership and ordering; the client does not submit a user identifier.
- Samples are rendered newest-first with device, capture time, coordinates, accuracy, provider source, and server-received time.
- The user may filter the already-loaded bounded result by enrolled device.
- Filtering does not trigger a broader history fetch or send additional location metadata.

## Privacy and interpretation boundary

The Timeline does **not** infer or claim:

- a traveled route between samples;
- visits, stays, dwell time, or frequently visited places;
- trips or transportation mode;
- geofences;
- current connectivity from historical samples;
- background collection beyond the existing native tracking contract.

A persisted location sample means only that the authenticated Location service stored that sample for the user's enrolled device.

## Retention boundary

This development surface does not introduce a new retention policy or deletion authority. Retention, purge, export, backup, and recovery controls must be implemented and accepted separately through the applicable Privacy Shield and Everkeep contracts before broader Timeline history is represented as a complete user-controlled history product.

## Acceptance boundary

This milestone is a Development web projection over existing owner-scoped API authority. It does not establish production deployment, complete Glaze UI rendered/accessibility acceptance, map-route visualization, representative physical-device acceptance, production Privacy Shield/Wardveil/Everkeep acceptance, release, or Stable qualification.
