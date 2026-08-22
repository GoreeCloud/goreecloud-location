# GoreeCloud Location for Android

The Android client is planned as a native Kotlin application because reliable background location collection, foreground services, permissions, battery behavior, boot recovery, local buffering, and other device-specific requirements are central to GoreeCloud Location.

Milestone 0 reserves this repository boundary without presenting an unfinished collector as usable software.

## Planned responsibilities

- explicit device enrollment;
- platform-compliant location permission flows;
- visible foreground-service behavior when Android requires it;
- user-visible tracking state and pause/resume controls;
- adaptive and battery-aware sample intervals;
- encrypted local buffering using platform-backed key material where appropriate;
- offline queueing and idempotent synchronization;
- network-change and process-recovery behavior;
- diagnostic visibility for permissions and collection health;
- distinct device-scoped credentials;
- sharing-state visibility where relevant to the user.

## Privacy and safety boundary

The Android client will not implement covert tracking, hide required operating-system indicators, bypass Android permission controls, or silently enroll a device. Loss or compromise of one device must be containable through device-level credential revocation.

The production implementation will begin in the native-tracking milestone after the server-side ownership, enrollment, credential, and ingestion contracts are reviewed and testable.
