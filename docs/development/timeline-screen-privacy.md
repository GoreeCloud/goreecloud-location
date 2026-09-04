# Timeline screen privacy mode

## Status

Development slice. This document describes source behavior on the stacked `agent/timeline-screen-privacy` branch and does not claim production Privacy Shield, Glaze UI, browser, device, deployment, or Stable acceptance.

## Purpose

Timeline can display already-authorized precise coordinates for the currently loaded owner-scoped history view. Screen privacy provides an explicit local presentation control for situations where the user does not want those precise values visible on screen.

When enabled, screen privacy:

- replaces rendered precise coordinate text with a hidden-state label;
- disables the per-sample coordinate-copy action;
- pauses the local CSV and GeoJSON export buttons because those formats contain precise coordinates; and
- reapplies the same presentation state when the bounded Timeline list is locally reordered or replaced after an authenticated server filter request.

## Authority and data boundary

Screen privacy is a presentation control only. It does **not**:

- delete or redact stored Location history;
- remove already-authorized samples from browser memory;
- change collection, retention, deletion, sharing, export authority, or background tracking behavior;
- broaden or narrow server ownership authorization;
- issue an additional history, map-provider, geocoding, routing, or other network request; or
- infer routes, trips, visits, stops, dwell, places, speed, activity, or movement between samples.

Turning the mode off restores the precise coordinate presentation for the already-authorized loaded view. Screen privacy is not a substitute for Privacy Shield retention/deletion controls, operating-system screen protection, browser security, or production privacy acceptance.

## Export interaction

The current Timeline CSV and GeoJSON exports intentionally contain precise coordinates. While screen privacy is active, those coordinate-bearing local exports are paused rather than silently producing a different schema. Existing accuracy-filter export restrictions remain authoritative and are not bypassed when screen privacy is turned off.

## Glaze UI status

The authoritative GoreeCloud Glaze UI consumer baseline is GLAZE UI V1.1 / `1.1.0`. This slice uses the existing Location Timeline interaction surface but does not itself establish V1.1 rendered, accessibility, responsive, forced-colors, reduced-motion, Human Visual Excellence, or production acceptance.
