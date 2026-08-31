import "./timeline-accuracy-presentation.css";
import {
  TIMELINE_ACCURACY_OPTIONS,
  normalizeTimelineAccuracyThreshold,
  timelineAccuracyStatus,
  timelineAccuracyView,
  type TimelineAccuracyThreshold,
} from "./timeline-accuracy-control";
import {
  summarizeTimelineFilteredView,
  timelineFilteredSummaryStatus,
  type TimelineFilteredSummary,
} from "./timeline-filtered-summary";

type AccuracyRow = {
  element: HTMLLIElement;
  accuracy_m?: number;
};

const app = document.querySelector<HTMLElement>("#app");
let activeList: HTMLOListElement | null = null;
let activeListObserver: MutationObserver | null = null;
let currentThreshold: TimelineAccuracyThreshold = "all";

function readRenderedAccuracy(item: HTMLLIElement): number | undefined {
  const facts = Array.from(item.querySelectorAll<HTMLElement>(".timeline-facts > div"));
  const accuracyFact = facts.find((fact) => fact.querySelector("dt")?.textContent?.trim() === "Accuracy");
  const value = accuracyFact?.querySelector("dd")?.textContent ?? "";
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*m/i);
  if (!match) return undefined;
  const accuracy = Number(match[1]);
  return Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined;
}

function summaryValue(value: number | null): string {
  return value == null ? "—" : `±${Math.round(value)} m`;
}

function renderFilteredSummary(summary: TimelineFilteredSummary): string {
  return `
    <div><dt>Visible samples</dt><dd>${summary.sampleCount}</dd></div>
    <div><dt>Accuracy reported</dt><dd>${summary.accuracySampleCount}</dd></div>
    <div><dt>Best accuracy</dt><dd>${summaryValue(summary.bestAccuracyMeters)}</dd></div>
    <div><dt>Worst accuracy</dt><dd>${summaryValue(summary.worstAccuracyMeters)}</dd></div>`;
}

function bindTimelineAccuracyPresentation(): void {
  const timeline = document.querySelector<HTMLElement>("#timeline");
  const filters = timeline?.querySelector<HTMLElement>(".timeline-filters");
  const list = timeline?.querySelector<HTMLOListElement>("#timeline-list");
  const summary = timeline?.querySelector<HTMLDListElement>("#timeline-summary");
  const status = timeline?.querySelector<HTMLElement>("#timeline-filter-status");
  const csvExport = timeline?.querySelector<HTMLButtonElement>("#timeline-export-current");
  const geoJSONExport = timeline?.querySelector<HTMLButtonElement>("#timeline-export-geojson");
  if (!timeline || !filters || !list || !summary || !status || !csvExport || !geoJSONExport) return;

  if (activeList !== list) {
    activeListObserver?.disconnect();
    activeList = list;
    activeListObserver = null;
  }

  let control = timeline.querySelector<HTMLLabelElement>("#timeline-accuracy-presentation-control");
  let select = timeline.querySelector<HTMLSelectElement>("#timeline-accuracy-presentation-filter");
  if (!control || !select) {
    control = document.createElement("label");
    control.id = "timeline-accuracy-presentation-control";
    control.className = "timeline-filter timeline-accuracy-presentation-control";
    control.htmlFor = "timeline-accuracy-presentation-filter";

    const label = document.createElement("span");
    label.textContent = "Accuracy";
    select = document.createElement("select");
    select.id = "timeline-accuracy-presentation-filter";
    for (const option of TIMELINE_ACCURACY_OPTIONS) {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      select.append(element);
    }
    select.value = currentThreshold;
    control.append(label, select);
    filters.append(control);
  }

  let filteredSummary = timeline.querySelector<HTMLDListElement>("#timeline-filtered-summary");
  if (!filteredSummary) {
    filteredSummary = document.createElement("dl");
    filteredSummary.id = "timeline-filtered-summary";
    filteredSummary.className = "timeline-summary timeline-filtered-summary";
    filteredSummary.setAttribute("aria-label", "Visible accuracy-filtered Timeline summary");
    filteredSummary.hidden = true;
    summary.insertAdjacentElement("afterend", filteredSummary);
  }

  const applyPresentation = () => {
    const items = Array.from(list.querySelectorAll<HTMLLIElement>(".timeline-item"));
    const rows: AccuracyRow[] = items.map((element) => ({
      element,
      accuracy_m: readRenderedAccuracy(element),
    }));
    const visibleRows = timelineAccuracyView(rows, currentThreshold);
    const visibleElements = new Set(visibleRows.map((row) => row.element));
    for (const row of rows) row.element.hidden = !visibleElements.has(row.element);

    const filtered = currentThreshold !== "all";
    summary.hidden = filtered;
    filteredSummary.hidden = !filtered;
    if (filtered) {
      const visibleSummary = summarizeTimelineFilteredView(visibleRows);
      filteredSummary.innerHTML = renderFilteredSummary(visibleSummary);
      filteredSummary.setAttribute("aria-description", timelineFilteredSummaryStatus(visibleSummary));
    } else {
      filteredSummary.replaceChildren();
      filteredSummary.removeAttribute("aria-description");
    }

    csvExport.setAttribute("aria-disabled", String(filtered));
    geoJSONExport.setAttribute("aria-disabled", String(filtered));
    const exportTitle = filtered
      ? "Select All reported accuracy before exporting the full loaded Timeline view."
      : "";
    csvExport.title = exportTitle;
    geoJSONExport.title = exportTitle;

    const baseStatus = timelineAccuracyStatus(currentThreshold, visibleRows.length);
    const summaryStatus = filtered
      ? ` ${timelineFilteredSummaryStatus(summarizeTimelineFilteredView(visibleRows))}`
      : "";
    status.textContent = filtered
      ? `${baseStatus}${summaryStatus} ${items.length - visibleRows.length} loaded sample${items.length - visibleRows.length === 1 ? " is" : "s are"} hidden from the list. Local exports are paused while this presentation filter is active. No additional history request was made.`
      : `${baseStatus} Accuracy presentation is local and makes no additional history request.`;
  };

  const blockFilteredExport = (event: Event) => {
    if (currentThreshold === "all") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    status.textContent = "Filtered export is intentionally unavailable in this Development slice. Select All reported accuracy to export the full loaded bounded view; no additional history request was made.";
  };

  if (!select.dataset.timelineAccuracyBound) {
    select.dataset.timelineAccuracyBound = "true";
    select.addEventListener("change", () => {
      currentThreshold = normalizeTimelineAccuracyThreshold(select?.value ?? "all");
      applyPresentation();
    });
    csvExport.addEventListener("click", blockFilteredExport, { capture: true });
    geoJSONExport.addEventListener("click", blockFilteredExport, { capture: true });
  }

  if (!activeListObserver) {
    activeListObserver = new MutationObserver(() => applyPresentation());
    activeListObserver.observe(list, { childList: true });
  }
  applyPresentation();
}

if (app) {
  const appObserver = new MutationObserver(() => bindTimelineAccuracyPresentation());
  appObserver.observe(app, { childList: true });
  bindTimelineAccuracyPresentation();
}
