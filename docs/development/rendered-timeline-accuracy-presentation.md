# Rendered Timeline accuracy presentation — Development

GoreeCloud Location now renders a local **Accuracy** presentation control for the already-loaded Timeline list.

Behavior and authority boundary:

- The available presentation thresholds are All reported accuracy, Within 25 m, Within 100 m, and Within 500 m.
- The control reads only the accuracy values already rendered from the current owner-scoped bounded Timeline snapshot. It performs no API request and does not change server device/time filters.
- When a finite threshold is active, samples without a usable reported accuracy value are hidden rather than being assumed to satisfy the threshold.
- The filter is reapplied after the accepted Timeline controller locally reorders the list or replaces it with a newly authenticated server-filtered snapshot.
- The current threshold survives the dashboard's periodic full-surface refresh within the running page session.
- While a finite accuracy filter is active, the full-view summary is hidden and CSV/GeoJSON export activation is intercepted. This avoids presenting the full loaded snapshot as though it were an export or summary of only the visually filtered rows. Selecting All reported accuracy restores those existing full-view surfaces.
- Coordinate-copy remains available only on currently visible rows and uses the existing rendered sample coordinate action.
- Accuracy is treated only as the device-reported sample accuracy field. This control does not infer confidence beyond that field and does not infer routes, trips, visits, stops, dwell, speed, transportation mode, connectivity, or geographic meaning.
- No geocoding, map-provider, tile, route, history, retention, or collection request is introduced.

The implementation is intentionally isolated from the accepted Timeline history controller. It does not alter authenticated history paths, history deletion, server ownership checks, or the current local ordering contract.

Status: **Development**. Complete current Stable Glaze UI rendered/accessibility acceptance, representative-device/browser acceptance, production GoreeCloud Identity/Privacy Shield/Wardveil/Everkeep acceptance, deployment, signed release, and Stable qualification remain separate gates.
