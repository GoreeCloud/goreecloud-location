import type { TimelineSample } from "./timeline";
import {
  orderTimelinePresentation,
  type TimelinePresentationOrder,
} from "./timeline-summary";

export type TimelineOrderOption = Readonly<{
  value: TimelinePresentationOrder;
  label: string;
}>;

export const TIMELINE_ORDER_OPTIONS: readonly TimelineOrderOption[] = Object.freeze([
  Object.freeze({ value: "newest", label: "Newest first" }),
  Object.freeze({ value: "oldest", label: "Oldest first" }),
]);

export function normalizeTimelinePresentationOrder(value: unknown): TimelinePresentationOrder {
  return value === "oldest" ? "oldest" : "newest";
}

export function timelineOrderedView(
  samples: TimelineSample[],
  order: unknown,
  limit = 50,
): TimelineSample[] {
  return orderTimelinePresentation(samples, normalizeTimelinePresentationOrder(order), limit);
}

export function timelineOrderStatus(order: unknown, sampleCount: number): string {
  const normalizedOrder = normalizeTimelinePresentationOrder(order);
  const count = Math.max(0, Math.trunc(Number.isFinite(sampleCount) ? sampleCount : 0));
  return `Showing ${count} owner-scoped sample${count === 1 ? "" : "s"}, ${normalizedOrder === "oldest" ? "oldest" : "newest"} first.`;
}
