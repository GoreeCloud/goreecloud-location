# Current Timeline View Summary — Development

The Development Timeline now summarizes only the currently loaded bounded history snapshot (maximum 50 samples). The summary reports sample count, distinct device count, captured-time span from valid timestamps, and the best reported non-negative accuracy.

The summary is computed locally from the same `currentSamples` already used by the Timeline list and current-view exports. It makes no additional history request, preserves the previous summary when a filtered server read fails, and refreshes after successful filter/deletion reloads.

The summary does not infer routes, trips, visits, stops, distance, speed, connectivity, or movement between samples.

This slice does not add production mapping, analytics profiling, bulk history retrieval, cloud export, new Location authority, or Stable qualification.
