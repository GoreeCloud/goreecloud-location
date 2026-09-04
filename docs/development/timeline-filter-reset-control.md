# Timeline accuracy filter reset control

## Status

Development slice. This document describes the repository implementation on the stacked `agent/timeline-filter-reset-control` branch and does not claim production acceptance.

## Purpose

The Timeline accuracy presentation filter can temporarily hide already-loaded bounded samples. This slice adds a visible **Clear accuracy filter** action while a non-default accuracy threshold is active.

Clearing the filter:

- returns the presentation threshold to `all`;
- restores every sample already present in the loaded bounded Timeline view;
- restores the ordinary full-loaded-view summary;
- restores the existing full-loaded-view CSV and GeoJSON export controls; and
- returns keyboard focus to the accuracy selector.

## Authority boundary

The reset action is presentation-only. It does not:

- request additional history;
- change collection, retention, deletion, or sharing behavior;
- infer visits, routes, trips, or places;
- alter source samples; or
- grant filtered-export authority.

GoreeCloud Location remains the authority for location history. Privacy Shield requirements remain applicable to collection, retention, sharing, deletion, and background location behavior.

## Glaze UI status

The current GoreeCloud Glaze UI repository identifies **GLAZE UI V1.1 (`1.1.0`)** as the required consumer target. This slice uses existing Location interaction primitives but does not claim V1.1 rendered, accessibility, form-factor, or production acceptance by itself.
