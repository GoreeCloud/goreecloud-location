# Owner-scoped Find My device detail

## Development capability

`GET /api/v1/find-my/devices/{deviceID}` provides one authenticated owner's authoritative Find My read model for a single enrolled device.

The response combines:

- enrolled device identity and class;
- revocation state;
- the latest persisted location sample when one exists; and
- the current server-authoritative recovery capability gate.

The endpoint derives ownership from the authenticated user principal and constrains the requested device to that user. A device belonging to another user returns the same not-found boundary as an unknown identifier, preventing the route from becoming a cross-user enrollment or location-existence oracle.

## Web detail surface

The Development Find My web surface exposes an explicit `View authoritative detail` control for each owner-scoped device card. Opening it performs fresh authenticated reads rather than treating the dashboard list as recovery or history authority.

The detail dialog presents:

- enrolled/revoked device state;
- latest persisted coordinates and capture time;
- server-received time when present;
- accuracy, battery, altitude, speed, and source when present;
- up to 10 newest persisted location samples for the selected device; and
- the exact recovery capability reasons returned by the server.

The bounded history reuses the existing authenticated owner-scoped `GET /api/v1/locations` endpoint with `device_id=<selected device>` and `limit=10`. No parallel history authority or new location-storage path is introduced. The client also filters the returned samples against the selected device identity before rendering them.

The history list shows persisted capture/server-received timestamps, coordinates, accuracy when present, and source. It deliberately does not interpolate a route, infer motion between samples, or present the records as proof of current connectivity.

The dialog is read-only. All Lost Mode, Play Sound, and Mark Found controls remain disabled in the client. Even if a future or malformed response reports a capability as available, this Development UI has no command-execution path and does not convert that state into an enabled action.

## Recovery boundary

This endpoint and its UI do not add recovery command authority. Lost Mode, Play Sound, and Mark Found remain denied by the same server-side capability contract used by the recovery-capability list:

- active enrollment: `recovery_authority_unavailable`;
- revoked enrollment: `device_enrollment_revoked`.

Revoked devices remain visible to their owner through this detail read so the client can present authoritative enrollment/recovery state, while their device credential remains unusable for authenticated device operations.

## Location boundary

`last_location` is the newest persisted sample already authorized to the same owner. The bounded history is likewise existing persisted owner-authorized state. Neither surface claims real-time reachability, route reconstruction, nearby finding, offline network participation, or current device connectivity. If no sample exists, `last_location` is `null` and the history surface presents an empty state.

## Explicit limitations

This Development read model and UI do not implement a general Timeline product, route reconstruction, geofencing, Lost Mode execution, Play Sound execution, Mark Found execution, remote erase, offline finding, Find My Network, precision/nearby finding, anti-stalking runtime acceptance, production Identity integration, production recovery authority, deployment, release, or Stable qualification.
