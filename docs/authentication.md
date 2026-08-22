# Authentication and Device Enrollment

GoreeCloud Location remains in the **Development** lifecycle. This document describes the Milestone 1 authentication boundary and does not authorize production deployment, public exposure, or replacement of existing location services.

## User access

Human/API user access currently uses high-entropy opaque bearer tokens with the `loc_usr_` prefix. The plaintext token is returned only when it is issued. The database stores a SHA-256 hash of the complete opaque token, plus its owner, label, lifecycle timestamps, and revocation state.

The current development bootstrap path is the local administrative CLI:

```bash
go run ./cmd/location-admin create-user --display-name "Example User"
```

The command requires authenticated database configuration through the same approved environment/secret boundary as the API. It creates one user, default preferences, and one initial access token in a single transaction. There is intentionally no unauthenticated HTTP registration endpoint in this milestone.

User bearer credentials are accepted only by user-scoped endpoints. The API derives the owning user from the credential lookup and never trusts a client-supplied user identifier as authorization authority.

## Device enrollment

An authenticated user enrolls a device through `POST /api/v1/devices`. Enrollment creates:

- one device owned by the authenticated user; and
- one independent `loc_dev_` device credential whose plaintext value is returned once.

Each device credential is stored only as a SHA-256 hash and is constrained by a composite database foreign key to the same user that owns the device. Compromise or revocation of one device credential does not require replacing every user or device credential.

Device credentials authenticate only device-scoped endpoints. Milestone 2 location ingestion will derive both user and device ownership from the authenticated device credential instead of trusting identifiers supplied in a location payload.

## Revocation and isolation

`DELETE /api/v1/devices/{deviceID}` is owner-scoped. The query includes both the device identifier and the authenticated user identifier. Cross-user attempts are returned as not found so the endpoint does not disclose whether another user's device exists.

Revoking a device also revokes its active device credentials in the same transaction. A revoked device credential must fail authentication immediately.

Current integration acceptance creates two independent users and proves that each user can see only their own device list and preferences, that one user cannot revoke the other user's device, that a device credential resolves only its own device and owner, and that revocation invalidates that credential.

## Preferences

Milestone 1 persists owner-scoped preferences for:

- time zone;
- metric or imperial distance units; and
- tracking pause state.

Preference reads and writes derive ownership from the authenticated user token. The initial tracking-pause preference is groundwork for the native tracking client and does not itself collect or suppress location data until Milestone 2 implements ingestion.

## Readiness

`GET /readyz` now uses the authenticated PostgreSQL connection pool and verifies that migration `0002_auth_devices_preferences` is present. This replaces the Milestone 0 socket-only readiness check.

Readiness does not expose database credentials, usernames, hostnames, user identifiers, device identifiers, coordinates, or private location data.

## Security boundary

This milestone intentionally does not add passwords, public sign-up, recovery codes, SSO, location ingestion, sharing, administrator impersonation, or location-history reads. Future GoreeCloud Identity integration may replace or supplement user bearer-token authentication, but user isolation and device credential boundaries remain application responsibilities.

Reusable bearer tokens must not be committed to Git, placed in ordinary documentation, or written to application logs. Operator-issued user credentials should be transferred and stored through an approved secret-management path.
