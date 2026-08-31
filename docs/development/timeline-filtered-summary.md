# Filtered Timeline summary model

Status: Development

This slice adds a pure summary model for the caller-supplied currently visible Timeline subset.

It reports visible sample count, the number of visible samples with a valid non-negative reported accuracy, and the best/worst reported accuracy values when available. Invalid, missing, negative, and non-finite accuracy values are excluded from the accuracy range without removing their samples from the visible sample count.

## Privacy and inference boundary

The model performs no additional history request and makes no route, stop, speed, trip, dwell, activity, or movement inference. It receives only the already-bounded samples supplied by its caller and does not expand owner scope, retention scope, date range, or server-side authority.

This keeps a future filtered-summary UI honest: it can describe exactly what is visibly loaded without reviving the full-view summary while a presentation filter is active.

## Next composition step

The rendered Timeline accuracy presentation can use this summary to replace the current hidden full-view summary with a distinct Glaze UI "visible view" summary, while full-view CSV and GeoJSON export remain separately gated until filtered export semantics are explicitly implemented.
