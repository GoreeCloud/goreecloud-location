# Timeline filter scope truth

Status: Development

The Timeline accuracy presentation now computes one explicit bounded scope projection for the currently loaded owner-scoped sample set.

The projection records loaded, visible, and locally hidden sample counts, whether a presentation filter is active, and whether full-loaded-view local exports are available. It fails closed on impossible count relationships and requires the unfiltered `All reported accuracy` state to expose the complete loaded sample set.

The rendered status now consumes this scope projection instead of reconstructing hidden-count and export-availability truth in multiple places. Filtered summaries remain derived only from already-rendered rows, and no additional history request is made.

## Privacy and authority boundary

This adds no route, trip, stop, dwell, speed, movement, geographic-meaning, collection, retention, deletion, or server-query authority. It describes only the bounded presentation scope already supplied to the browser.

This remains Development evidence and does not establish history completeness, Stable Glaze UI acceptance, or production acceptance.
