# Find My Development Surface

## Purpose

This slice begins GoreeCloud Location's first-party Find My product experience using only the authenticated owner's existing `/api/v1/live` device/location response.

## Implemented states

The web client presents `Live`, `Recent`, `Stale`, `Offline`, and `Unavailable` states from bounded sample recency and enrollment state. `Offline` means no location sample has arrived for more than 24 hours; it is explicitly not a network-connectivity probe.

Search is limited to non-secret enrolled-device presentation metadata and computed state. Last-known coordinates, reported accuracy, battery percentage, and sample recency remain visible only inside the authenticated owner-scoped application surface.

## Map boundary

The first surface uses a local world-coordinate projection for authorized last-known positions. No external map tiles, geocoding, routing, analytics, fonts, icons, or third-party browser requests are introduced. A replaceable MapLibre-compatible provider remains a later reviewed integration.

## Recovery boundary

Lost Mode, Play Sound, and Mark Found are represented only as disabled capability states. This slice does not create device-command authority, remote control, destructive operations, anti-theft enforcement, family visibility, or production recovery activation. Those capabilities require explicit authentication, authorization, abuse-prevention, device acknowledgement, and evidence-backed state-machine contracts before enablement.

## Glaze UI boundary

The Find My surface targets current Stable Glaze UI `1.5.0`, pinned to Stable promotion revision `2e1618397f6ebcdd254a76bfdd7e98846f2c5aa3`. It includes practical targets, visible focus, responsive Mobile/Desktop composition, reduced-motion handling, increased-contrast treatment, forced-colors fallbacks, and Solid/Raised content hierarchy. Glaze Motion remains Experimental and is not required by this slice.

## Privacy boundary

Precise coordinates and device identifiers must not enter ordinary logs, analytics, crash evidence, notification text, public URLs, or unauthenticated content. This source change adds no logging path for location data.

## Acceptance boundary

Source/type/build CI is required before integration. Representative authenticated browser acceptance remains required for responsive layout, keyboard-only use, screen-reader semantics, state accuracy, search behavior, dark/light/system presentation, stale/offline distinctions, and confirmation that recovery controls cannot dispatch commands.

Lifecycle remains Development; this slice does not activate production Find My or Stable qualification.
