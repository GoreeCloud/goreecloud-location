# Privacy Model

GoreeCloud Location treats precise location history as private personal data and applies privacy by default throughout collection, storage, sharing, visualization, export, deletion, and backup.

## Default state

- Location history is visible to its owner unless an explicit sharing policy grants access.
- Household or family membership does not automatically grant access to another person's history.
- Background collection must be visible and controllable on the client platform.
- Advertising identifiers, behavioral advertising, and sale of location data are prohibited.
- External analytics and telemetry are not assumed dependencies.

## User controls

The product direction includes:

- pause and resume tracking;
- precise or approximate sharing;
- live-only, history-only, or combined sharing;
- selected-device sharing;
- temporary sharing with expiration;
- immediate revocation;
- privacy zones and hidden places;
- per-device tracking controls;
- retention policies;
- date-range deletion;
- export before deletion;
- clear indicators for active sharing and background tracking.

These controls must be enforced by APIs and data access rules, not merely hidden or shown by the interface.

## Sharing

A sharing relationship is an explicit grant from one user to another approved user. A policy may constrain precision, data type, device scope, feature visibility, and time period. Expired or revoked access must fail closed.

The application must make it understandable who can currently see location information and what they can see.

## Collection minimization

Clients should collect only the fields required for approved Location functionality. Optional metadata such as battery state or activity should remain purpose-bound. Collection frequency should support adaptive, battery-aware modes rather than maximizing sample volume by default.

## Retention and deletion

Retention must be configurable and documented. Deletion semantics must distinguish user-visible derived records from authoritative raw location samples so the product does not claim data is deleted while an ordinary live copy remains accessible elsewhere.

Backup and recovery retention is governed separately and must be communicated accurately. Recovery copies must not become an undocumented permanent exception to deletion policy.

## Exports and portability

Users must be able to export their own information in open documented formats such as GPX, GeoJSON, and CSV where those formats can represent the relevant data. A GoreeCloud archival format may preserve richer relationships and provenance.

Sensitive full-history export should require appropriate authentication and must not leak other users' information through shared or administrative data paths.

## Maps and third parties

Stored geospatial data is authoritative; rendered map tiles are not. Mapping, geocoding, and routing providers must remain replaceable. A provider integration must not receive more location information than its function requires, and self-hosted alternatives should remain possible.

## Logs and monitoring

Health, metrics, traces, and ordinary logs must avoid precise coordinates and unnecessary personal/device identifiers. Operational observability should answer whether the system works without recreating a second uncontrolled location-history database in logs.
