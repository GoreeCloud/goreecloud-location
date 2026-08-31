# Timeline Copy Coordinates — Development

The GoreeCloud Location Timeline now lets the user copy the coordinates of an already-loaded sample directly from its Timeline card.

## Behavior

- Coordinates are formatted from the current sample as latitude/longitude to five decimal places.
- The copy button is rendered only from the currently loaded bounded Timeline view.
- Clipboard writing occurs locally in the browser.
- Copying does not issue another history request, mutate history, infer a route, or widen the current device/time scope.
- Clipboard unavailability fails visibly without changing the Timeline state.

## Boundary

Development only. No route reconstruction, reverse geocoding, map-provider request, server clipboard service, background export, or Stable qualification is added.
