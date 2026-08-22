# Architecture

## Authority

GoreeCloud Location is an original GoreeCloud-owned application. Dawarich and Traccar may be used as transitional reference, compatibility, validation, or migration systems, but neither is the long-term architectural authority.

## Capability boundaries

The product presents one user experience while keeping major capabilities independently maintainable:

- **Ingestion** authenticates devices, validates samples, derives ownership from credentials, rejects malformed or duplicate input, and persists accepted raw samples.
- **Live state** derives current or most-recent authorized device locations without confusing stale information with current information.
- **History** queries immutable/raw samples and produces user-visible paths and chronology.
- **Places and visits** derive editable semantic records from location history without silently rewriting raw evidence.
- **Trips** group time ranges, movement, visits, and related user metadata.
- **Geofencing and events** evaluate spatial rules and emit authorized events.
- **Sharing** grants explicit, revocable, scoped access between users.
- **Imports and exports** preserve provenance, portability, restartability, and reconciliation evidence.

## Technology direction

| Domain | Initial technology | Reason |
| --- | --- | --- |
| Web | TypeScript | GoreeCloud primary interface language |
| API | Go | Long-running service, concurrency, simple deployment |
| Android | Kotlin | Native background-location and OS integration |
| Apple | Swift later | Native platform integration |
| Database | PostgreSQL + PostGIS | Relational ownership plus first-class spatial operations |
| API style | REST under `/api/v1/` | Stable explicit contract; real-time channels may supplement it |

Frameworks and map providers are implementation choices, not permanent product identities. Major dependencies should remain replaceable behind explicit interfaces.

## Ownership invariant

Every location sample must have both an owning user and source device. The database schema must prove that the referenced device belongs to the same user. Device ingestion credentials determine ownership; clients do not select an arbitrary authoritative `user_id`.

## Raw and derived data

Raw accepted location samples are append-oriented evidence. Visits, places, trips, summaries, and other inferred records are derived or user-editable views. Correcting a derived visit must not silently destroy the original raw sample history when preservation is required.

## Spatial model

PostGIS is the initial geospatial authority. Expected operations include spatial indexes, distance/radius queries, bounding boxes, clustering, geofence membership, heat-map inputs, route analysis, and future privacy transformations.

## Client architecture

The Android client will maintain a platform-compliant visible collection state, locally buffer samples when offline, and synchronize using device-scoped credentials. Background collection must use Android-supported permissions and foreground-service behavior rather than hidden or bypassed collection.

The web client is a consumer of first-party APIs. It must not connect directly to the database.

## Integration rule

GoreeCloud Photos, Notify, Monitor, Identity, Everkeep, Network, DNS, and other Suite components integrate through documented APIs and authorization boundaries. Direct cross-application database coupling is not the default architecture.

## Deployment boundary

The intended service address is `location.goreecloud.com`. Database and administrative backend ports must not be directly exposed to the public internet. Network access and application authentication are separate controls; private networking does not replace application authorization.
