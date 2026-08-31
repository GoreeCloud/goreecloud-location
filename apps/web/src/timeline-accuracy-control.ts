export type TimelineAccuracyThreshold = "all" | "25" | "100" | "500";

export const TIMELINE_ACCURACY_OPTIONS: ReadonlyArray<{
  value: TimelineAccuracyThreshold;
  label: string;
}> = Object.freeze([
  { value: "all", label: "All reported accuracy" },
  { value: "25", label: "Within 25 m" },
  { value: "100", label: "Within 100 m" },
  { value: "500", label: "Within 500 m" },
]);

export function normalizeTimelineAccuracyThreshold(value: string): TimelineAccuracyThreshold {
  return TIMELINE_ACCURACY_OPTIONS.some((option) => option.value === value)
    ? value as TimelineAccuracyThreshold
    : "all";
}

export function timelineAccuracyView<T extends { accuracy_m?: number }>(
  samples: readonly T[],
  threshold: TimelineAccuracyThreshold,
): T[] {
  if (!Array.isArray(samples)) return [];
  if (threshold === "all") return [...samples];
  const maximumAccuracyM = Number(threshold);
  return samples.filter((sample) =>
    Number.isFinite(sample.accuracy_m)
    && Number(sample.accuracy_m) >= 0
    && Number(sample.accuracy_m) <= maximumAccuracyM,
  );
}

export function timelineAccuracyStatus(threshold: TimelineAccuracyThreshold, visibleCount: number): string {
  const count = Number.isInteger(visibleCount) && visibleCount >= 0 ? visibleCount : 0;
  if (threshold === "all") {
    return `Showing ${count} loaded sample${count === 1 ? "" : "s"} at any reported accuracy.`;
  }
  return `Showing ${count} loaded sample${count === 1 ? "" : "s"} reported within ${threshold} m accuracy.`;
}
