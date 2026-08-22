# Deployment

GoreeCloud Location is not yet authorized for production deployment.

The intended deployment model is a self-hosted web/API/worker stack using PostgreSQL with PostGIS, approved GoreeCloud HTTPS publication, private connectivity where required, monitoring, notification integration, and Everkeep-aligned backup/recovery.

Milestone 0 intentionally does not commit a production-looking Compose stack before database credentials, container build definitions, health dependencies, migrations, image pinning, backup behavior, and rollback expectations are implemented and validated together.

When deployment definitions are introduced, they must:

- keep PostgreSQL and administrative ports off direct public exposure;
- use secrets outside ordinary revision history;
- pin third-party container dependencies according to GoreeCloud policy;
- provide health/readiness checks that do not expose private user information;
- separate network access from application authentication and authorization;
- document persistent volumes, ownership, backup, restore, and migration behavior;
- define a credible rollback or known-good path before production cutover;
- preserve the transitional Dawarich/Traccar services until native migration and acceptance gates support retirement.
