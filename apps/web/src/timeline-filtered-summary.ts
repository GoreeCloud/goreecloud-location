export type TimelineFilteredSummarySample = {
  accuracy_m?: number;
};

export type TimelineFilteredSummary = {
  sampleCount: number;
  accuracySampleCount: number;
  bestAccuracyMeters: number | null;
  worstAccuracyMeters: number | null;
};

/**
 * Summarizes only the caller-supplied current presentation subset. It performs no
 * route, stop, speed, trip, or movement inference and does not request more history.
 */
export function summarizeTimelineFilteredView(
  samples: readonly TimelineFilteredSummarySample[],
): TimelineFilteredSummary {
  const reportedAccuracies = samples
    .map((sample) => sample.accuracy_m)
    .filter((accuracy): accuracy is number => (
      typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0
    ));

  if (reportedAccuracies.length === 0) {
    return {
      sampleCount: samples.length,
      accuracySampleCount: 0,
      bestAccuracyMeters: null,
      worstAccuracyMeters: null,
    };
  }

  return {
    sampleCount: samples.length,
    accuracySampleCount: reportedAccuracies.length,
    bestAccuracyMeters: Math.min(...reportedAccuracies),
    worstAccuracyMeters: Math.max(...reportedAccuracies),
  };
}

export function timelineFilteredSummaryStatus(summary: TimelineFilteredSummary): string {
  const sampleNoun = summary.sampleCount === 1 ? "sample" : "samples";
  if (summary.accuracySampleCount === 0) {
    return `${summary.sampleCount} visible ${sampleNoun}; no visible sample reports accuracy.`;
  }

  const accuracyNoun = summary.accuracySampleCount === 1 ? "sample reports" : "samples report";
  return `${summary.sampleCount} visible ${sampleNoun}; ${summary.accuracySampleCount} ${accuracyNoun} accuracy from ${summary.bestAccuracyMeters} m to ${summary.worstAccuracyMeters} m.`;
}
