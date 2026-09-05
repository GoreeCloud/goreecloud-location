# GoreeCloud Location — Features

## Implemented in Development source

- Authenticated user identity and device enrollment/revocation.
- Device-scoped tracking credentials.
- PostgreSQL/PostGIS geospatial persistence.
- Device-authenticated location ingestion with idempotency and bounded validation.
- Owner-scoped live and history reads.
- Tracking pause/resume enforced by the service.
- Responsive Live web experience with last-known state, age, accuracy, battery, stale/no-location states, and refresh.
- Owner-scoped Timeline view with device and bounded time-window filters and a maximum 50-sample browser view.
- Explicitly confirmed Timeline history deletion using one server-bounded batch of up to 500 matching owner-scoped samples; the browser never auto-repeats deletion.
- Local CSV export of only the currently loaded bounded Timeline view with spreadsheet-formula hardening and no export-time history request.
- Local GeoJSON export of that same bounded view as independent Point features; no route, trip, stop, or movement inference is added by the client.
- Development Find My device surface with search, Live/Recent/Stale/Offline/Unavailable presentation, diagnostics, and recovery-action gating.
- Presentation-only Timeline screen privacy mode that hides precise coordinate text, disables per-sample coordinate copy, and pauses coordinate-bearing CSV/GeoJSON export while active without mutating stored history.
- Repository-local GLAZE UI V1.1 web presentation layer using neutral-first Deep Teal + Soft Amber atmosphere, 48px minimum interactive controls, explicit focus treatment, Light/Dark/Deep Dark structure, and Reduced Transparency/Reduced Motion/forced-colors fallbacks.
- Native Android collection/retry foundations.

## Development boundaries

- The GLAZE UI V1.1 layer is presentation-only. It does not change location collection, history, sharing, Find My, authorization, retention, deletion, or Privacy Shield/Wardveil/Everkeep/Identity/Mesh authority.
- Deep Dark styling exists as an explicit presentation mode but a user-facing appearance preference has not yet been accepted.
- Source styling does not establish exact-revision rendered, accessibility, responsive/form-factor, or Human Visual Excellence acceptance.

## Planned / incomplete

- Production GoreeCloud Identity browser sessions.
- Replaceable geographic map tiles/provider integration and rendered map acceptance.
- Multi-user/family sharing and revocation workflows.
- Places, trips, timeline playback, geofences, and insights.
- Offline Find My Network, nearby finding, trusted places, recovery contacts, and theft-protection correlation.
- Complete anti-stalking and abuse-prevention protections.
- Broader open-format import, retention policy management, backup/restore, and production monitoring.
- Exact-revision GLAZE UI V1.1 rendered/native accessibility, 200% text, RTL/localization, Reduced Transparency, Reduced Motion, contrast/high-contrast, form-factor, performance, and production acceptance across supported clients.
