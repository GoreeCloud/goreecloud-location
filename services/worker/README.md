# Background Worker

This directory is reserved for GoreeCloud Location background processing that should not run inside latency-sensitive API request paths.

Expected responsibilities include visit inference, trip reconstruction, derived statistics, import processing, export assembly, geofence/event evaluation where asynchronous processing is appropriate, data-quality reconciliation, and other bounded jobs.

The worker must preserve the same user-ownership and authorization model as the API. Background execution is not a privileged bypass around multi-user isolation.

Raw precise coordinates must not be emitted to ordinary worker logs. Jobs should use opaque identifiers and bounded diagnostics unless a separately controlled security or recovery process explicitly requires sensitive evidence.

Implementation is deferred until a milestone introduces the first required asynchronous workflow.
