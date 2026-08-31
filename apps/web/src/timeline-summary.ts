import type { TimelineSample } from "./timeline";

export type TimelineViewSummary = {
  sampleCount: number;
  deviceCount: number;
  earliestCapturedAt: string | null;
  latestCapturedAt: string | null;
  bestAccuracyM: number | null;
};

export function summarizeTimelineView(samples: TimelineSample[], limit = 50): TimelineViewSummary {
  const bounded = samples.slice(0, Math.max(0, limit));
  const devices = new Set<string>();
  let earliest: { value: string; timestamp: number } | null = null;
  let latest: { value: string; timestamp: number } | null = null;
  let bestAccuracyM: number | null = null;

  for (const sample of bounded) {
    devices.add(sample.device_id);
    const captured = Date.parse(sample.captured_at);
    if (Number.isFinite(captured)) {
      if (earliest == null || captured < earliest.timestamp) earliest = { value: sample.captured_at, timestamp: captured };
      if (latest == null || captured > latest.timestamp) latest = { value: sample.captured_at, timestamp: captured };
    }
    if (Number.isFinite(sample.accuracy_m) && (sample.accuracy_m ?? -1) >= 0) {
      const accuracy = sample.accuracy_m as number;
      if (bestAccuracyM == null || accuracy < bestAccuracyM) bestAccuracyM = accuracy;
    }
  }

  return {
    sampleCount: bounded.length,
    deviceCount: devices.size,
    earliestCapturedAt: earliest?.value ?? null,
    latestCapturedAt: latest?.value ?? null,
    bestAccuracyM,
  };
}
