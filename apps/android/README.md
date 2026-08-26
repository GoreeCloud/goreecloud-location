# GoreeCloud Location for Android

The Android client is a native Kotlin application because reliable foreground location collection, permissions, battery behavior, process recovery, protected local buffering, and other device-specific requirements are central to GoreeCloud Location.

## Current development slice

The first Milestone 2 Android collector foundation now provides:

- a native Android application module built without Google Play Services or AndroidX dependencies;
- explicit foreground location permission handling;
- a user-visible start/stop tracking control;
- a required foreground service with a persistent system notification;
- native `LocationManager` GPS/network collection;
- 15-second / 10-meter development sampling thresholds;
- process-memory-only observation state for the current foundation; and
- no coordinate logging, no durable plaintext queue, and no server upload yet.

This is intentionally a collection foundation, not a finished tracking client. The app does not yet enroll itself with the GoreeCloud Location API, store a device credential, synchronize samples, recover after reboot, implement adaptive battery profiles, or expose production-ready diagnostics.

## Next Android slices

- explicit API-backed device enrollment;
- protected device-credential storage using Android platform-backed key material;
- encrypted local offline queueing;
- idempotent synchronization to `POST /api/v1/locations`;
- network-change retry behavior;
- adaptive and battery-aware collection profiles;
- permission and collection-health diagnostics;
- boot/process recovery where Android permits it;
- server tracking-pause awareness; and
- later Find My participation and anti-stalking capabilities only after their dedicated security/privacy contracts are implemented.

## Privacy and safety boundary

The Android client will not implement covert tracking, hide required operating-system indicators, bypass Android permission controls, silently enroll a device, write precise coordinates to ordinary logs, or persist unprotected location history. Loss or compromise of one device must remain containable through device-level credential revocation.

Precise samples in this first slice exist only in process memory and are discarded when the collector service stops or the process ends. Durable storage remains disabled until the encrypted queue design is implemented and reviewed.

## Build

The project currently targets Android API 36 and uses Android Gradle Plugin 9.3.1 with Gradle 9.5 / JDK 17 compatibility. From `apps/android`:

```bash
gradle :app:assembleDebug
```

GoreeCloud Location remains **Development**. A successful debug build does not constitute a release, production collection approval, or Stable qualification.
