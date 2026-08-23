# Native Tracking

GoreeCloud Location treats location data as sensitive user-owned data. This document defines the initial Milestone 2 development contract for native location ingestion and owner-scoped history/live reads.

This is a **Development** source boundary. It does not authorize production tracking, Android background collection, a public tracking endpoint, infrastructure cutover, or Stable promotion.

## Authority model

The server is the authorization authority for location ownership.

- Interactive user credentials use the `loc_usr_` credential family and may read only resources owned by the authenticated user.
- Device credentials use the `loc_dev_` credential family and are the only credentials accepted for native sample ingestion.
- The ingestion payload does not accept `user_id` or `device_id` as ownership authority.
- The authenticated device credential resolves both the owning user and source device.
- A revoked device or credential cannot continue ingesting.
- Tracking pause is a server-enforced persistence control rather than a client-only preference.

Network access such as NetBird does not replace application authentication or authorization.

## POST `/api/v1/locations`

The endpoint accepts one JSON location sample from an authenticated device.

Required fields:

- `client_sample_id` — device-generated idempotency identifier, non-empty after trimming, at most 128 bytes, with control characters rejected.
- `captured_at` — RFC 3339 timestamp accepted by Go's JSON time decoder; normalized to UTC and PostgreSQL microsecond precision.
- `latitude` — finite number from -90 through 90.
- `longitude` — finite number from -180 through 180.

Optional fields:

- `accuracy_m` — finite, 0 through 1,000,000 metres.
- `altitude_m` — finite number.
- `speed_mps` — finite, 0 through 1,000 metres per second.
- `bearing_deg` — finite, greater than or equal to 0 and less than 360 degrees.
- `battery_percent` — integer from 0 through 100.

A capture timestamp more than five minutes in the future is rejected. Unknown JSON fields are rejected by the common API decoder.

Example shape:

```json
{
  "client_sample_id": "device-sample-000001",
  "captured_at": "2026-08-22T23:00:00Z",
  "latitude": 29.9511,
  "longitude": -90.0715,
  "accuracy_m": 5.0,
  "speed_mps": 1.4,
  "bearing_deg": 90,
  "battery_percent": 82
}
```

The example coordinates are illustrative test data. Applications must not copy sample coordinates into ordinary logs.

### Persistence behavior

The server persists the sample through the existing `location_samples` ownership schema using PostGIS `geography(Point, 4326)`. The source is assigned server-side as `native-device`.

Immediately before persistence the API transactionally rechecks:

1. that the authenticated device still belongs to the authenticated owner and has not been revoked; and
2. that the owner's `tracking_paused` preference is false.

These checks close the ordinary race where authentication succeeds and a device is revoked or tracking is paused before the write is committed.

### Idempotency

The database enforces uniqueness for `(device_id, client_sample_id)`.

- First accepted sample: HTTP `201`, `duplicate: false`.
- Identical normalized retry: HTTP `200`, `duplicate: true`, with the previously stored location ID.
- Reuse of the same client sample ID with a conflicting payload: HTTP `409` with `sample_conflict`.

The client sample identifier therefore acts as an idempotency key within one device, not as a globally trusted record ID.

### Tracking pause

When the authenticated owner's preferences have `tracking_paused: true`, native ingestion returns HTTP `409` with `tracking_paused`. The client must treat this as an instruction not to persist or retry ordinary tracking samples until the user resumes tracking.

### Revocation

Revoked device credentials fail authentication and cannot ingest. Revoking a device also revokes its device credentials under the established Milestone 1 device-management transaction.

## GET `/api/v1/locations`

This endpoint requires an authenticated user credential and returns only samples whose `user_id` is the authenticated user.

Supported query parameters:

- `from` — optional RFC 3339/RFC 3339 Nano lower bound, inclusive.
- `to` — optional RFC 3339/RFC 3339 Nano upper bound, exclusive.
- `device_id` — optional device filter; it does not bypass the authenticated-user predicate.
- `limit` — optional integer from 1 through 500; default 100.

If both timestamps are present, `from` must be earlier than `to`. Invalid filters return HTTP `400` with `invalid_query`.

Passing another user's device ID does not expose whether that device exists; the owner-scoped query returns no matching location rows.

The initial endpoint orders samples newest-first. Pagination beyond the bounded `limit` is later history work and must be designed without weakening ownership isolation.

## GET `/api/v1/live`

This endpoint requires an authenticated user credential. It returns each non-revoked device owned by that user and, when available, that device's newest stored sample.

The query applies the authenticated user's owner predicate before the response is assembled. It does not expose other users' devices or samples.

This is the first live-data API primitive, not the completed Live product experience. Staleness presentation, map rendering, streaming updates, sharing, approximate precision, and live-map interaction remain later work.

## Logging and observability

Ordinary request logs must not contain:

- bearer credentials;
- latitude or longitude values;
- private route payloads; or
- copies of user location history.

The Milestone 2 integration acceptance checks the API log for the test users' issued bearer credentials and tested precise coordinates. Operational events should remain at the level of route, operation, dependency health, status, and non-sensitive diagnostic context.

Future observability must preserve this boundary when metrics, tracing, ingestion error reporting, and monitoring are added.

## Acceptance coverage

The current tracking integration acceptance uses a real PostgreSQL/PostGIS service and verifies:

- two independent users and devices;
- rejection of user-session credentials for device ingestion;
- successful device-authenticated ingestion for each owner;
- PostGIS-backed sample persistence;
- idempotent retry behavior;
- conflicting retry rejection;
- malformed and missing-coordinate rejection;
- owner-only history reads;
- cross-user device-filter isolation;
- owner-only live reads;
- bounded history-query validation;
- server-enforced tracking pause;
- device revocation preventing further ingestion; and
- absence of tested credentials and precise coordinates from ordinary API logs.

These tests are development acceptance for this source slice. They are not production acceptance.

## Not yet implemented by this slice

The following remain outside this first Milestone 2 tracking boundary:

- native Android background collection;
- foreground-service and permission-state UX;
- encrypted offline sample queue;
- delayed/retry synchronization from the Android client;
- adaptive/battery-aware collection profiles;
- initial Glaze UI live map;
- authenticated streaming updates;
- user-to-user sharing and precision controls;
- geofences and location events;
- places, visits, trips, and timeline inference;
- retention/deletion workflows;
- imports, exports, and recovery proof; and
- production deployment or native cutover.

Those capabilities require their own implementation and acceptance gates before GoreeCloud Location can replace the transitional Dawarich or Traccar roles.
