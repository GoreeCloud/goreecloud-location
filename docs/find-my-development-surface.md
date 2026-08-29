# Find My Development Surface

## Purpose

This slice advances GoreeCloud Location's first-party Find My product experience using authenticated owner-scoped live/device state plus an authoritative server-side recovery-capability gate.

## Implemented states

The web client presents `Live`, `Recent`, `Stale`, `Offline`, and `Unavailable` states from bounded sample recency and enrollment state. `Offline` means no location sample has arrived for more than 24 hours; it is explicitly not a network-connectivity probe.

Search is limited to non-secret enrolled-device presentation metadata and computed state. Last-known coordinates, reported accuracy, battery percentage, and sample recency remain visible only inside the authenticated owner-scoped application surface.

## Map boundary

The current surface uses a local world-coordinate projection for authorized last-known positions. No external map tiles, geocoding, routing, analytics, fonts, icons, or third-party browser requests are introduced. A replaceable MapLibre-compatible provider remains a later reviewed integration.

## Recovery capability authority

The Location API now exposes `GET /api/v1/find-my/recovery-capabilities` through the existing authenticated user boundary. The server derives the owner from the user credential and returns capability state only for that owner's enrolled devices.

Current recovery capabilities are deliberately fail-closed:

- `lost_mode.available = false`;
- `play_sound.available = false`; and
- `mark_found.available = false`.

Active enrollments return `recovery_authority_unavailable`. Revoked enrollments return `device_enrollment_revoked`. The web UI consumes this response and keeps every recovery control disabled. Failure to load the capability response also leaves the controls disabled.

This contract does not create device-command authority, remote control, destructive operations, anti-theft enforcement, family visibility, or production recovery activation. A later command implementation must separately add explicit authentication, authorization, anti-abuse policy, device acknowledgement, idempotency/replay protection, evidence-backed state transitions, Wardveil/Privacy Shield requirements, and recovery acceptance before any action can become available.

## Glaze UI boundary

The Find My source now targets the repository's current Glaze UI `2.0.0` contract. The stale 1.5 marker from the original Find My slice has been removed. Source/build acceptance does not by itself establish complete Glaze UI native/browser conformance or Stable acceptance.

## Privacy boundary

Precise coordinates and device identifiers must not enter ordinary logs, analytics, crash evidence, notification text, public URLs, or unauthenticated content. The recovery capability response contains owner-scoped device presentation metadata and categorical capability state; it does not expose location coordinates or device credentials.

## Acceptance boundary

Source/type/build CI plus authenticated PostgreSQL integration acceptance are required before integration. The integration gate must prove user isolation, fail-closed action state, and revoked-device denial semantics. Representative authenticated browser acceptance remains required for responsive layout, keyboard-only use, screen-reader semantics, state accuracy, search behavior, dark/light/system presentation, stale/offline distinctions, and confirmation that recovery controls cannot dispatch commands.

Lifecycle remains Development; this slice does not activate production Find My, production recovery authority, or Stable qualification.
