# Rendered filtered Timeline summary

Status: Development

This slice composes the validated `timeline-filtered-summary.ts` model with the browser-local Timeline accuracy presentation filter.

When a finite accuracy threshold is active, the full loaded-view summary is hidden and a distinct visible-view summary reports visible sample count, visible samples with accuracy, and best/worst reported accuracy. When `All reported accuracy` is selected, the canonical full loaded-view summary returns.

## Authority and privacy boundary

- The accuracy filter and visible summary are presentation-only.
- No additional Timeline history request is made.
- The visible summary is derived only from the already-rendered bounded Timeline rows.
- Full-view CSV and GeoJSON export remain paused while a presentation filter is active rather than silently exporting a different scope.
- The visible summary never claims to represent history outside the current loaded view.

This is Development evidence only and is not a production or Stable acceptance claim.
