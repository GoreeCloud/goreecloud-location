# Live Web Experience

## Status

Development-only Milestone 2 source. This document does not establish a release, deployment, production acceptance, or Stable qualification.

## Purpose

The first native GoreeCloud Location web experience consumes the existing authenticated Location API and provides a Glaze UI shell for current-device state without weakening the established ownership boundary.

The current implemented surface includes:

- session-scoped user credential entry;
- authenticated user identity display through `GET /api/v1/me`;
- authenticated preferences through `GET /api/v1/preferences`;
- server-enforced tracking pause/resume through `PUT /api/v1/preferences`;
- owner-scoped enrolled-device live/last-known state through `GET /api/v1/live`;
- explicit differentiation between Live, Recent, Last known, and No location yet states;
- location accuracy, optional battery state, source, coordinate, and sample-age presentation when supplied by the native API;
- responsive Glaze UI navigation foundation for Live, Timeline, Places, Trips, Find My, and Sharing; and
- automatic live-state refresh every 30 seconds while the page remains active.

## Authentication and privacy boundary

The browser does not submit a user ID to establish authority. The existing bearer credential is sent to the API and the server derives the authenticated user identity from that credential.

The development client stores the entered user credential in `sessionStorage`, not persistent local storage. Signing out removes it. This is an interim development authentication UX and does not replace future GoreeCloud Identity integration, stronger browser session management, or production credential issuance.

The web application must not log or persist precise coordinates or bearer credentials as ordinary analytics or telemetry.

## Tracking pause

The pause/resume control updates the existing user preference contract. Pausing is not merely a visual switch: the native ingestion API already verifies the preference inside the write transaction and rejects new location ingestion while tracking is paused.

## Map boundary

The current Live screen deliberately does not render third-party map tiles.

The native API already supplies authoritative coordinates, but a geographic map must remain behind an open, replaceable MapLibre-compatible provider adapter. Until that provider contract is implemented and reviewed, the UI displays a clearly labeled private map foundation rather than implying that geographic mapping is complete.

The stored geospatial records remain authoritative. Rendered map tiles must never become the authoritative Location record.

## Staleness presentation

The UI derives a presentation-only state from `captured_at`:

- Live: sample age up to five minutes;
- Recent: more than five minutes and up to one hour;
- Last known: more than one hour;
- No location yet: the enrolled device has no accepted native sample.

These labels do not alter or overwrite server data. Future Location Confidence work will replace simple age presentation with the richer source, uncertainty, confidence, connectivity, and observation-state model defined by the platform specification.

## Deliberately not implemented by this slice

This source does not implement or claim:

- MapLibre tile/provider integration;
- Timeline or historical review UI;
- places, visits, trips, or geofences;
- location sharing;
- Find My device recovery;
- Lost Mode, remote lock, or secure erase;
- nearby Bluetooth/UWB finding;
- offline finding or Find My Network;
- anti-stalking detection;
- native Android background collection;
- authenticated push/SSE/WebSocket live updates;
- GoreeCloud Identity browser SSO;
- production deployment or production tracking.

## Next development slices

The next Milestone 2 work should prioritize the native Android collector and its permission/foreground-service/offline-queue boundary, followed by authenticated live-update transport and the replaceable map adapter. Find My development remains gated by the dedicated device-finding, recovery, privacy, Wardveil Security, and anti-stalking requirements in the project specification.
