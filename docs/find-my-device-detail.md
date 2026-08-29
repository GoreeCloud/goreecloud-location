# Owner-scoped Find My device detail

## Development capability

`GET /api/v1/find-my/devices/{deviceID}` provides one authenticated owner's authoritative Find My read model for a single enrolled device.

The response combines:

- enrolled device identity and class;
- revocation state;
- the latest persisted location sample when one exists; and
- the current server-authoritative recovery capability gate.

The endpoint derives ownership from the authenticated user principal and constrains the requested device to that user. A device belonging to another user returns the same not-found boundary as an unknown identifier, preventing the route from becoming a cross-user enrollment or location-existence oracle.

## Recovery boundary

This endpoint does not add recovery command authority. Lost Mode, Play Sound, and Mark Found remain denied by the same server-side capability contract used by the recovery-capability list:

- active enrollment: `recovery_authority_unavailable`;
- revoked enrollment: `device_enrollment_revoked`.

Revoked devices remain visible to their owner through this detail read so the client can present authoritative enrollment/recovery state, while their device credential remains unusable for authenticated device operations.

## Location boundary

`last_location` is the newest persisted sample already authorized to the same owner. It does not claim real-time reachability, nearby finding, offline network participation, or current device connectivity. If no sample exists, the field is `null`.

## Explicit limitations

This Development read model does not implement Lost Mode execution, Play Sound execution, Mark Found execution, remote erase, offline finding, Find My Network, precision/nearby finding, anti-stalking runtime acceptance, production Identity integration, production recovery authority, deployment, release, or Stable qualification.
