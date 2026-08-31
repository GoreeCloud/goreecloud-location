import "./timeline.css";
import { timelineHistoryGeoJSON } from "./timeline-geojson";
import { summarizeTimelineView } from "./timeline-summary";

export type TimelineDevice = {
  device: {
    id: string;
    display_name: string;
    device_class: string;
  };
};

export type TimelineSample = {
  id: string;
  device_id: string;
  captured_at: string;
  server_received_at: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  source: string;
};

export type TimelineHistoryResponse = {
  locations: TimelineSample[];
};

export type TimelineHistoryDeletionResponse = {
  deleted_count: number;
  more_may_remain: boolean;
};

export type TimelineHistoryLoader = (path: string) => Promise<TimelineHistoryResponse>;
export type TimelineHistoryDeleter = (path: string) => Promise<TimelineHistoryDeletionResponse>;

const timelineLimit = 50;
const timelineWindows = Object.freeze({
  all: null,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
});
const deletionWindows = Object.freeze({
  now: 0,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
});

type TimelineWindow = keyof typeof timelineWindows;
type DeletionWindow = keyof typeof deletionWindows;

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function timelineCoordinateText(sample: Pick<TimelineSample, "latitude" | "longitude">): string {
  if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) {
    throw new TypeError("Timeline coordinates must be finite.");
  }
  return `${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`;
}

function formatCoordinates(sample: TimelineSample): string {
  return timelineCoordinateText(sample);
}

function csvCell(value: string | number | undefined, protectSpreadsheetFormula = false): string {
  let text = value == null ? "" : String(value);
  if (protectSpreadsheetFormula && /^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function timelineHistoryCSV(
  samples: TimelineSample[],
  deviceNames: ReadonlyMap<string, string> = new Map(),
): string {
  const header = [
    "captured_at",
    "server_received_at",
    "device_id",
    "device_name",
    "latitude",
    "longitude",
    "accuracy_m",
    "source",
  ].join(",");
  const rows = samples.slice(0, timelineLimit).map((sample) => [
    csvCell(sample.captured_at, true),
    csvCell(sample.server_received_at, true),
    csvCell(sample.device_id, true),
    csvCell(deviceNames.get(sample.device_id) ?? "Enrolled device", true),
    csvCell(sample.latitude),
    csvCell(sample.longitude),
    csvCell(sample.accuracy_m),
    csvCell(sample.source, true),
  ].join(","));
  return [header, ...rows].join("\r\n");
}

export function timelineSampleMatchesWindow(capturedAt: string, window: TimelineWindow, now = Date.now()): boolean {
  const windowMs = timelineWindows[window];
  if (windowMs == null) return true;
  const captured = Date.parse(capturedAt);
  if (!Number.isFinite(captured)) return false;
  return captured <= now && captured >= now - windowMs;
}

export function timelineHistoryPath(deviceId: string, window: TimelineWindow, now = Date.now()): string {
  const params = new URLSearchParams({ limit: String(timelineLimit) });
  const normalizedDevice = deviceId.trim();
  if (normalizedDevice && normalizedDevice !== "all") params.set("device_id", normalizedDevice);

  const windowMs = timelineWindows[window];
  if (windowMs != null) {
    if (!Number.isFinite(now)) throw new TypeError("Timeline query time must be finite.");
    params.set("from", new Date(now - windowMs).toISOString());
    params.set("to", new Date(now + 1).toISOString());
  }
  return `/api/v1/locations?${params.toString()}`;
}

export function timelineHistoryDeletionPath(deviceId: string, window: DeletionWindow, now = Date.now()): string {
  if (!Number.isFinite(now)) throw new TypeError("Timeline deletion time must be finite.");
  const params = new URLSearchParams({
    before: new Date(now - deletionWindows[window]).toISOString(),
  });
  const normalizedDevice = deviceId.trim();
  if (normalizedDevice && normalizedDevice !== "all") params.set("device_id", normalizedDevice);
  return `/api/v1/locations?${params.toString()}`;
}

function renderTimelineSummary(samples: TimelineSample[]): string {
  const summary = summarizeTimelineView(samples, timelineLimit);
  const span = summary.earliestCapturedAt && summary.latestCapturedAt
    ? `${formatTimestamp(summary.earliestCapturedAt)} → ${formatTimestamp(summary.latestCapturedAt)}`
    : "No valid captured-time range";
  const accuracy = summary.bestAccuracyM == null ? "—" : `±${Math.round(summary.bestAccuracyM)} m`;
  return `
    <div><dt>Samples</dt><dd>${summary.sampleCount}</dd></div>
    <div><dt>Devices</dt><dd>${summary.deviceCount}</dd></div>
    <div class="timeline-summary-span"><dt>Captured span</dt><dd>${escapeHTML(span)}</dd></div>
    <div><dt>Best accuracy</dt><dd>${accuracy}</dd></div>`;
}

export function renderTimelineSurface(devices: TimelineDevice[], samples: TimelineSample[]): string {
  const boundedSamples = samples.slice(0, timelineLimit);
  const deviceNames = new Map(devices.map((entry) => [entry.device.id, entry.device.display_name]));
  const deviceOptions = devices
    .map((entry) => `<option value="${escapeHTML(entry.device.id)}">${escapeHTML(entry.device.display_name)}</option>`)
    .join("");

  return `
    <section class="timeline-section" id="timeline" aria-labelledby="timeline-title">
      <div class="timeline-heading">
        <div>
          <span class="eyebrow">Timeline</span>
          <h2 id="timeline-title">Recent persisted history</h2>
          <p>Owner-scoped history from your authenticated Location account. This view does not infer routes, stops, visits, or movement between samples.</p>
        </div>
        <div class="timeline-filters" aria-label="Timeline filters">
          <label class="timeline-filter" for="timeline-device-filter">
            <span>Device</span>
            <select id="timeline-device-filter">
              <option value="all">All devices</option>
              ${deviceOptions}
            </select>
          </label>
          <label class="timeline-filter" for="timeline-time-filter">
            <span>Time</span>
            <select id="timeline-time-filter">
              <option value="all">Latest 50</option>
              <option value="1h">Past hour</option>
              <option value="24h">Past 24 hours</option>
              <option value="7d">Past 7 days</option>
            </select>
          </label>
        </div>
      </div>

      <div class="timeline-privacy-note" role="note">
        <strong>Privacy boundary</strong>
        <span>Timeline requests are owner-scoped by the authenticated server. Device and time selections are sent only as bounded history filters; at most ${timelineLimit} samples are returned. The summary, coordinate-copy action, and CSV/GeoJSON exports operate only on the currently loaded bounded view and make no additional history request.</span>
      </div>

      <div class="timeline-history-control" aria-labelledby="timeline-history-control-title">
        <div>
          <strong id="timeline-history-control-title">History control</strong>
          <span>Export the current point samples locally in open formats, or delete one server-bounded batch of up to 500 samples. Exports do not infer paths or trips. The server re-checks account ownership and the optional device scope for deletion.</span>
        </div>
        <label class="timeline-filter" for="timeline-delete-window">
          <span>Delete samples older than</span>
          <select id="timeline-delete-window">
            <option value="7d">7 days</option>
            <option value="24h">24 hours</option>
            <option value="1h">1 hour</option>
            <option value="now">Now (all older history)</option>
          </select>
        </label>
        <div class="timeline-history-actions">
          <button id="timeline-export-current" class="timeline-export-button" type="button">Export CSV</button>
          <button id="timeline-export-geojson" class="timeline-export-button" type="button">Export GeoJSON</button>
          <button id="timeline-delete-history" class="timeline-delete-button" type="button">Delete one bounded batch</button>
        </div>
      </div>

      <dl class="timeline-summary" id="timeline-summary" aria-label="Current Timeline view summary">
        ${renderTimelineSummary(boundedSamples)}
      </dl>
      <p class="timeline-filter-status" id="timeline-filter-status" role="status">Showing ${boundedSamples.length} owner-scoped sample${boundedSamples.length === 1 ? "" : "s"}.</p>
      <ol class="timeline-list" id="timeline-list">
        ${renderTimelineItems(boundedSamples, deviceNames)}
      </ol>
    </section>`;
}

function renderTimelineItems(samples: TimelineSample[], deviceNames: Map<string, string>): string {
  if (samples.length === 0) {
    return `
      <li class="timeline-empty">
        <strong>No persisted history in this bounded view</strong>
        <span>Location samples appear here only when an enrolled device has reported matching history to your account.</span>
      </li>`;
  }
  return samples.map((sample) => renderTimelineItem(sample, deviceNames)).join("");
}

function renderTimelineItem(sample: TimelineSample, deviceNames: Map<string, string>): string {
  const deviceName = deviceNames.get(sample.device_id) ?? "Enrolled device";
  const coordinates = timelineCoordinateText(sample);
  return `
    <li class="timeline-item" data-timeline-device="${escapeHTML(sample.device_id)}" data-timeline-captured-at="${escapeHTML(sample.captured_at)}">
      <span class="timeline-marker" aria-hidden="true"></span>
      <article>
        <div class="timeline-item-topline">
          <div>
            <strong>${escapeHTML(deviceName)}</strong>
            <span>${escapeHTML(formatTimestamp(sample.captured_at))}</span>
          </div>
          <span class="timeline-source">${escapeHTML(sample.source)}</span>
        </div>
        <div class="timeline-coordinate-row">
          <div class="timeline-coordinates">${escapeHTML(coordinates)}</div>
          <button class="timeline-copy-coordinates" type="button" data-timeline-copy-coordinate="${escapeHTML(coordinates)}" aria-label="Copy coordinates for ${escapeHTML(deviceName)}">Copy coordinates</button>
        </div>
        <dl class="timeline-facts">
          <div><dt>Accuracy</dt><dd>${sample.accuracy_m == null ? "—" : `±${Math.round(sample.accuracy_m)} m`}</dd></div>
          <div><dt>Received</dt><dd>${escapeHTML(formatTimestamp(sample.server_received_at))}</dd></div>
        </dl>
      </article>
    </li>`;
}

export function bindTimelineSurface(
  devices: TimelineDevice[],
  loadHistory: TimelineHistoryLoader,
  deleteHistory?: TimelineHistoryDeleter,
  initialSamples: TimelineSample[] = [],
): void {
  const deviceFilter = document.querySelector<HTMLSelectElement>("#timeline-device-filter");
  const timeFilter = document.querySelector<HTMLSelectElement>("#timeline-time-filter");
  const deletionWindow = document.querySelector<HTMLSelectElement>("#timeline-delete-window");
  const deleteButton = document.querySelector<HTMLButtonElement>("#timeline-delete-history");
  const csvExportButton = document.querySelector<HTMLButtonElement>("#timeline-export-current");
  const geoJSONExportButton = document.querySelector<HTMLButtonElement>("#timeline-export-geojson");
  const summary = document.querySelector<HTMLDListElement>("#timeline-summary");
  const list = document.querySelector<HTMLOListElement>("#timeline-list");
  const status = document.querySelector<HTMLElement>("#timeline-filter-status");
  if (!deviceFilter || !timeFilter || !list || !status) return;

  const deviceNames = new Map(devices.map((entry) => [entry.device.id, entry.device.display_name]));
  let requestGeneration = 0;
  let currentSamples = initialSamples.slice(0, timelineLimit);

  const syncExportButtons = () => {
    const disabled = currentSamples.length === 0;
    if (csvExportButton) csvExportButton.disabled = disabled;
    if (geoJSONExportButton) geoJSONExportButton.disabled = disabled;
  };
  const syncSummary = () => {
    if (summary) summary.innerHTML = renderTimelineSummary(currentSamples);
  };
  syncExportButtons();
  syncSummary();

  const downloadLocalExport = (contents: string, mimeType: string, extension: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `goreecloud-location-timeline-${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  csvExportButton?.addEventListener("click", () => {
    if (currentSamples.length === 0) return;
    downloadLocalExport(`\uFEFF${timelineHistoryCSV(currentSamples, deviceNames)}`, "text/csv;charset=utf-8", "csv");
    status.textContent = `Exported ${currentSamples.length} currently loaded sample${currentSamples.length === 1 ? "" : "s"} as CSV locally. No additional history request was made.`;
  });

  geoJSONExportButton?.addEventListener("click", () => {
    if (currentSamples.length === 0) return;
    const geoJSON = timelineHistoryGeoJSON(currentSamples, deviceNames, timelineLimit);
    downloadLocalExport(`${JSON.stringify(geoJSON, null, 2)}\n`, "application/geo+json;charset=utf-8", "geojson");
    status.textContent = `Exported ${currentSamples.length} currently loaded point sample${currentSamples.length === 1 ? "" : "s"} as GeoJSON locally. No route or additional history was inferred or requested.`;
  });

  list.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const coordinates = target.dataset.timelineCopyCoordinate;
    if (!coordinates) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(coordinates);
      status.textContent = `Copied ${coordinates} from the currently loaded Timeline sample. No history request was made.`;
    } catch {
      status.textContent = "Clipboard access is unavailable. The current Timeline view was not changed.";
    }
  });

  const applyFilters = async (): Promise<number | null> => {
    const generation = ++requestGeneration;
    const selectedDevice = deviceFilter.value;
    const selectedWindow = timeFilter.value as TimelineWindow;
    const path = timelineHistoryPath(selectedDevice, selectedWindow);

    deviceFilter.disabled = true;
    timeFilter.disabled = true;
    if (deleteButton) deleteButton.disabled = true;
    if (csvExportButton) csvExportButton.disabled = true;
    if (geoJSONExportButton) geoJSONExportButton.disabled = true;
    status.textContent = "Loading owner-scoped history from the authenticated server…";
    try {
      const response = await loadHistory(path);
      if (generation !== requestGeneration) return null;
      const samples = Array.isArray(response.locations) ? response.locations.slice(0, timelineLimit) : [];
      currentSamples = samples;
      list.innerHTML = renderTimelineItems(samples, deviceNames);
      syncSummary();
      status.textContent = `Showing ${samples.length} server-filtered sample${samples.length === 1 ? "" : "s"}.`;
      return samples.length;
    } catch {
      if (generation !== requestGeneration) return null;
      status.textContent = "The authenticated history request failed. The previous Timeline view has been preserved.";
      return null;
    } finally {
      if (generation === requestGeneration) {
        deviceFilter.disabled = false;
        timeFilter.disabled = false;
        if (deleteButton) deleteButton.disabled = deleteHistory == null;
        syncExportButtons();
      }
    }
  };

  deviceFilter.addEventListener("change", () => void applyFilters());
  timeFilter.addEventListener("change", () => void applyFilters());

  if (!deleteHistory || !deletionWindow || !deleteButton) {
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.title = "History deletion is unavailable in this runtime.";
    }
    return;
  }

  deleteButton.addEventListener("click", async () => {
    const selectedDevice = deviceFilter.value;
    const selectedDeletionWindow = deletionWindow.value as DeletionWindow;
    const deviceLabel = selectedDevice === "all"
      ? "all of your enrolled devices"
      : deviceNames.get(selectedDevice) ?? "the selected enrolled device";
    const cutoffLabel = deletionWindow.selectedOptions[0]?.textContent ?? "the selected cutoff";
    const confirmed = window.confirm(
      `Delete up to 500 owner-scoped Location samples older than ${cutoffLabel} for ${deviceLabel}? This batch cannot be undone.`,
    );
    if (!confirmed) return;

    const path = timelineHistoryDeletionPath(selectedDevice, selectedDeletionWindow);
    deleteButton.disabled = true;
    deletionWindow.disabled = true;
    deviceFilter.disabled = true;
    timeFilter.disabled = true;
    if (csvExportButton) csvExportButton.disabled = true;
    if (geoJSONExportButton) geoJSONExportButton.disabled = true;
    status.textContent = "Deleting one bounded owner-scoped history batch…";
    try {
      const result = await deleteHistory(path);
      const visibleCount = await applyFilters();
      if (visibleCount == null) return;
      status.textContent = `Deleted ${result.deleted_count} sample${result.deleted_count === 1 ? "" : "s"}. ${result.more_may_remain ? "More matching history may remain; run another explicitly confirmed batch if desired. " : "No additional matching batch was indicated. "}Showing ${visibleCount} server-filtered sample${visibleCount === 1 ? "" : "s"}.`;
    } catch {
      status.textContent = "The authenticated history deletion request failed. No deletion success is being assumed.";
    } finally {
      deletionWindow.disabled = false;
      deviceFilter.disabled = false;
      timeFilter.disabled = false;
      deleteButton.disabled = false;
      syncExportButtons();
    }
  });
}