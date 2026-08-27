# Android Retention and Recovery Boundary

The encrypted location-sample queue is intentionally bounded. The current Development contract retains at most 1,000 pending encrypted samples and removes samples older than seven days when retention enforcement runs.

Retention operates only on the app-private encrypted queue. It does not create a plaintext fallback, location-history export, analytics record, or alternate durable store.

Malformed queue entries are quarantined as `.corrupt` files rather than interpreted as valid coordinates. Precise coordinates, bearer credentials, and private route history must not enter ordinary logs or diagnostics.

Retry scheduling, connectivity restoration, bounded backoff, single-flight synchronization, battery-aware collection profiles, and user-visible retention diagnostics remain additional issue #9 work. This source slice establishes the bounded durable-retention primitive only and does not claim full Android recovery acceptance.
