# Security Baseline

GoreeCloud Location handles highly sensitive precise location data. Security and data protection take priority over convenience, speed of delivery, and feature completeness.

## Required controls

- Authenticate every non-public application API.
- Authorize every user-owned resource on the server.
- Keep interactive user sessions separate from device-ingestion credentials.
- Scope each device credential to one device and its established owner.
- Store credential verifiers rather than reusable plaintext credentials where the selected scheme permits it.
- Support credential revocation without rotating unrelated users or devices.
- Validate coordinates, timestamps, accuracy, request size, identifiers, and supported data types before persistence.
- Apply rate limits and abuse controls appropriate to authentication and ingestion endpoints.
- Use parameterized database operations and least-privilege database roles.
- Protect browser sessions against fixation, cross-site request forgery, insecure cookie handling, and unsafe cross-origin behavior.
- Use secure transport for remote application traffic.
- Audit privileged administrative, sharing, credential, import/export, and destructive actions.

## Multi-user isolation

A normal user must not gain another user's private location information through guessed identifiers, URLs, request bodies, search, exports, caches, background jobs, object references, timing differences, or client-controlled state.

Service administration and data ownership are distinct privileges. Administrative operation of the server does not by itself authorize ordinary browsing of users' location histories.

## Location-specific logging rule

Ordinary application and infrastructure logs must not contain precise latitude/longitude pairs, complete routes, private place names, location exports, reusable credentials, tokens, private keys, or authentication secrets.

Use opaque record identifiers and bounded diagnostic metadata whenever possible. Security investigation that genuinely requires sensitive evidence must use a separately controlled process and storage boundary.

## Device ingestion rule

A device-authenticated ingestion request must never become authoritative merely because its body contains a `user_id`. The server derives the owning user from the authenticated device identity and validates the persisted user/device relationship.

Client sample identifiers are used for idempotency and deduplication; they do not grant authorization.

## Secrets

No live password, database credential, API key, device token, private key, signing key, OAuth secret, or equivalent reusable secret belongs in Git history, ordinary documentation, fixtures, screenshots, examples, or CI logs.

`.env.example` may document variable names and safe non-secret defaults only.

## Production gates

Before a production or Release Candidate cutover, security acceptance must cover at least:

- cross-user direct-object access attempts;
- search, export, background-job, cache, and error-path isolation;
- credential creation, expiration/revocation, and lost-device handling;
- input validation and malformed location payloads;
- session and browser security controls;
- dependency and vulnerability review;
- backup/restore confidentiality and authorization;
- privacy-preserving logging and monitoring;
- representative Android collection and synchronization behavior;
- rollback or disable capability.

A successful build, merged pull request, running container, or accessible health endpoint is not production acceptance.

## Reporting vulnerabilities

Do not open a public issue containing an exploitable vulnerability, credential, private location record, or other sensitive evidence. Use an approved private security-reporting path once repository security reporting is configured.
