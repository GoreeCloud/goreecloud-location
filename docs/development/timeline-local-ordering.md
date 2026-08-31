# Timeline Local Presentation Ordering — Development

GoreeCloud Location now has a deterministic local ordering helper for the already owner-scoped, bounded Timeline sample view.

## Implemented in this slice

- Timeline samples can be locally ordered newest-first or oldest-first by valid `captured_at` timestamps.
- Invalid timestamps are retained after valid timestamps rather than being treated as newer or older history.
- Equal or invalid timestamps preserve their original relative order.
- The helper enforces a caller-supplied non-negative limit and defaults to the existing 50-sample presentation boundary.
- Timeline summary calculation now derives its bounded sample set through newest-first ordering rather than trusting upstream array order.

## Boundary

This is a local presentation and summary-correctness foundation. It does not change server ownership authorization, request filtering, retention, deletion, export authority, or infer routes/visits. A user-facing newest/oldest Timeline control remains a separate UI milestone.
