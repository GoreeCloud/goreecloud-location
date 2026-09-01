import type { TimelineAccuracyThreshold } from "./timeline-accuracy-control";

export type TimelineFilterScope = {
  loadedSampleCount: number;
  visibleSampleCount: number;
  hiddenSampleCount: number;
  filtered: boolean;
  fullLoadedViewExportsAvailable: boolean;
};

/**
 * Describes only the already-loaded bounded Timeline presentation scope.
 * It performs no history request and grants no retention, export, or inference authority.
 */
export function timelineFilterScope(
  loadedSampleCount: number,
  visibleSampleCount: number,
  threshold: TimelineAccuracyThreshold,
): TimelineFilterScope {
  if (!Number.isInteger(loadedSampleCount) || loadedSampleCount < 0) {
    throw new RangeError("loaded sample count must be a non-negative integer");
  }
  if (!Number.isInteger(visibleSampleCount) || visibleSampleCount < 0 || visibleSampleCount > loadedSampleCount) {
    throw new RangeError("visible sample count must be within the loaded sample count");
  }

  const filtered = threshold !== "all";
  if (!filtered && visibleSampleCount !== loadedSampleCount) {
    throw new RangeError("unfiltered presentation must expose the complete loaded sample set");
  }

  return {
    loadedSampleCount,
    visibleSampleCount,
    hiddenSampleCount: loadedSampleCount - visibleSampleCount,
    filtered,
    fullLoadedViewExportsAvailable: !filtered,
  };
}

export function timelineFilterScopeStatus(scope: TimelineFilterScope): string {
  if (!scope.filtered) {
    return `${scope.loadedSampleCount} loaded sample${scope.loadedSampleCount === 1 ? "" : "s"}; the complete loaded bounded view is visible.`;
  }
  return `${scope.visibleSampleCount} of ${scope.loadedSampleCount} loaded samples are visible; ${scope.hiddenSampleCount} are hidden by the local presentation filter.`;
}
