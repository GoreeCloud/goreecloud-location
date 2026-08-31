# GoreeCloud Location User Manual

## Current availability

GoreeCloud Location is in **Development** and is not production-ready. The current repository includes an authenticated Development web experience, native API/service foundations, a validated Development PostgreSQL/PostGIS runtime, device-authenticated location ingestion, owner-scoped live/history reads, tracking pause/resume, owner-scoped Timeline filtering/history controls/local exports, an owner-scoped Find My device-state surface, and a server-authoritative Find My recovery-capability gate.

## Sign in to a Development environment

The current web client uses an interim Development credential flow rather than production GoreeCloud Identity browser sessions. In an approved Development environment, enter the user credential issued by that environment. The credential is kept in browser `sessionStorage` and removed when you sign out.

Do not treat this Development flow as the final production authentication experience.

## Live view

The Live experience shows authenticated owner-scoped device state from the Location API. Depending on available samples, the interface can show:

- live or last-known state;
- sample age;
- reported accuracy;
- optional battery information;
- explicit stale or no-location states;
- manual refresh; and
- periodic automatic refresh.

The browser does not supply an authoritative user ID. Ownership is derived by the server from the authenticated credential.

### Map status

The current Live source does not yet claim production geographic map delivery. Stored PostGIS coordinates remain authoritative, but map tiles remain gated until the replaceable MapLibre-compatible provider path is implemented and accepted.

## Pause or resume tracking

The current Development web experience can request tracking pause/resume through the authenticated user preference boundary. The server enforces tracking pause during ingestion; the client control alone is not the authority.

A revoked device credential or server-side pause state must prevent new accepted samples even if a client continues trying to upload them.

## Timeline and location history

The Timeline is an owner-scoped view of history for the authenticated user. It shows at most 50 samples for each request and can display capture time, coordinates, accuracy, source, and server-received time.

The current filters are:

- **All devices** or one enrolled device;
- **Latest 50**;
- **Past hour**;
- **Past 24 hours**; and
- **Past 7 days**.

Selecting a device or time window sends bounded filters to the authenticated Location history API. The server applies the owner scope and accepts only the existing bounded `device_id`, `from`, `to`, and `limit` contract. The client is not treating an already loaded 50-row list as the complete account history. If a filtered request fails, the existing Timeline remains visible and the failure is reported instead of being presented as an empty history.

Timeline samples are discrete history records. The current interface does **not** infer routes, visits, stops, trips, transport modes, geofences, or current network connectivity from those records.

History remains private to the authenticated owner unless and until an explicit sharing feature is implemented and accepted. Current source does not establish public links or general user-to-user sharing.

### Delete older history

The **History control** section can request deletion of samples older than a selected cutoff for all enrolled devices or the currently selected device.

- Every deletion batch requires an explicit browser confirmation.
- One request deletes at most the server-authorized bounded batch of 500 matching samples.
- The browser does not automatically repeat the deletion when more history may remain.
- The server re-checks authenticated ownership, device scope, and cutoff; the browser is not deletion authority.
- After a successful batch, the Timeline is refreshed through the normal authenticated history read.

If more matching history may remain, the interface says so and requires another separately confirmed batch.

### Export the current bounded view

The Timeline can export the samples already loaded in the browser without issuing another history request.

**CSV** exports the current ≤50-sample view with capture/server times, device identifiers/names, coordinates, optional accuracy, and source. Text cells are hardened against common spreadsheet-formula prefixes before download.

**GeoJSON** exports the same current samples as a `FeatureCollection` of independent `Point` features. Coordinates are `[longitude, latitude]`; properties include the device, capture/server times, optional accuracy, and source.

GeoJSON export intentionally does **not** connect points into a route, infer movement, invent visits/stops/trips, or request additional samples. Both export formats are local browser downloads of data that is already present in the current authenticated Timeline view.

These Development exports are portability aids for the bounded view, not a complete account-history export or a claim of finished Everkeep export/backup integration.

## Find My device state

The current Find My Development surface lists/searches devices owned by the authenticated user and presents bounded recovery-oriented device state such as:

- Live, Recent, Stale, Offline, or Unavailable presentation based on available state/recency;
- last-location age;
- accuracy when present;
- optional battery information; and
- sanitized diagnostic state.

These labels are Development presentation states. In particular, **Offline** is not proof of a real-time network-connectivity check; it is derived from the available device/sample state contract.

### Recovery actions

The Find My client asks the authenticated Location API for owner-scoped recovery capability state. Lost Mode, Play Sound, and Mark Found remain disabled unless a future server contract explicitly authorizes them.

Current server behavior denies all three actions. Active enrollments report `recovery_authority_unavailable`; revoked enrollments report `device_enrollment_revoked`. If the capability response cannot be loaded, the client also keeps recovery controls disabled.

This means the current interface has an authoritative **deny** contract, not recovery command authority. The repository still does **not** establish Lost Mode execution, remote erase, nearby finding, offline finding, Find My Network participation, anti-stalking runtime acceptance, or other production recovery authority.

## Device enrollment and revocation

Development APIs support owner-scoped device enrollment/listing and device credential revocation. Device ingestion uses a device-specific credential and does not accept request-supplied ownership identity as authority.

Opaque device credentials are stored only as hashes by the current service; plaintext credential material is returned only at issuance.

## Privacy and security expectations

Location data is highly sensitive.

- Precise coordinates must not be written to ordinary application logs.
- Sharing must be explicit, revocable, and scope-controlled when implemented.
- Privacy Shield governs privacy, consent, minimization, retention/user-control boundaries, and future sharing controls.
- Wardveil Security governs applicable protection, trust, verification, anti-abuse, and response requirements.
- GoreeCloud Identity governs production user/device/session authority.
- Everkeep governs accepted export, backup, recovery, preservation, portability, and succession behavior.
- GoreeCloud Mesh governs authenticated cross-service coordination.
- Glaze UI governs the approved interface/design-system contract.

## Current limitations

The Development source does not establish production GoreeCloud Identity integration, production mapping/geocoding/routing, Android background collection acceptance, offline synchronization, sharing, places/trips/geofences, complete-account export/import or retention-policy management, production Find My recovery commands, offline finding, anti-stalking acceptance, production deployment, signed release, or Stable qualification.

Refer to `README.md`, `SPECIFICATIONS.md`, and the `docs/` directory for detailed architecture and acceptance boundaries.
