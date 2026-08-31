# Rendered Timeline ordering control — Development

The owner-scoped Timeline now renders an explicit **Newest first / Oldest first** presentation selector.

Authority boundary:

- Device and time filters continue to be the only Timeline controls that request bounded history from the authenticated Location API.
- The order selector operates only on the already-loaded snapshot of at most 50 owner-authorized samples.
- Changing order performs no additional history, map, geocoding, route, or network request.
- Summary calculation, coordinate-copy actions, and local CSV/GeoJSON exports consume the currently ordered bounded presentation.
- Ordering does not infer routes, trips, visits, stops, dwell, speed, transportation mode, or connectivity state.
- A failed server filter request preserves the previous loaded snapshot and its local presentation state.

Status: **Development**. Production Identity sessions, complete Glaze UI 2.1 rendered/accessibility acceptance, representative-device acceptance, retention/purge policy acceptance, production Privacy Shield/Wardveil/Everkeep acceptance, release, and Stable qualification remain separate gates.
