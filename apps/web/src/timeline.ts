import "./timeline.css";

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

export type TimelineHistoryLoader = (path: string) => Promise<TimelineHistoryResponse>;

const timelineLimit = 50;
const timelineWindows = Object.freeze({
  all: null,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
});

type TimelineWindow = keyof typeof timelineWindows;

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

function formatCoordinates(sample: TimelineSample): string {
  return `${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`;
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
          <p>Read-only history from your authenticated Location account. This view does not infer routes, stops, visits, or movement between samples.</p>
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
        <span>Timeline requests are owner-scoped by the authenticated server. Device and time selections are sent only as bounded history filters; at most ${timelineLimit} samples are returned.</span>
      </div>

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
        <div class="timeline-coordinates">${escapeHTML(formatCoordinates(sample))}</div>
        <dl class="timeline-facts">
          <div><dt>Accuracy</dt><dd>${sample.accuracy_m == null ? "—" : `±${Math.round(sample.accuracy_m)} m`}</dd></div>
          <div><dt>Received</dt><dd>${escapeHTML(formatTimestamp(sample.server_received_at))}</dd></div>
        </dl>
      </article>
    </li>`;
}

export function bindTimelineSurface(devices: TimelineDevice[], loadHistory: TimelineHistoryLoader): void {
  const deviceFilter = document.querySelector<HTMLSelectElement>("#timeline-device-filter");
  const timeFilter = document.querySelector<HTMLSelectElement>("#timeline-time-filter");
  const list = document.querySelector<HTMLOListElement>("#timeline-list");
  const status = document.querySelector<HTMLElement>("#timeline-filter-status");
  if (!deviceFilter || !timeFilter || !list || !status) return;

  const deviceNames = new Map(devices.map((entry) => [entry.device.id, entry.device.display_name]));
  let requestGeneration = 0;

  const applyFilters = async () => {
    const generation = ++requestGeneration;
    const selectedDevice = deviceFilter.value;
    const selectedWindow = timeFilter.value as TimelineWindow;
    const path = timelineHistoryPath(selectedDevice, selectedWindow);

    deviceFilter.disabled = true;
    timeFilter.disabled = true;
    status.textContent = "Loading owner-scoped history from the authenticated server…";
    try {
      const response = await loadHistory(path);
      if (generation !== requestGeneration) return;
      const samples = Array.isArray(response.locations) ? response.locations.slice(0, timelineLimit) : [];
      list.innerHTML = renderTimelineItems(samples, deviceNames);
      status.textContent = `Showing ${samples.length} server-filtered sample${samples.length === 1 ? "" : "s"}.`;
    } catch {
      if (generation !== requestGeneration) return;
      status.textContent = "The authenticated history request failed. The previous Timeline view has been preserved.";
    } finally {
      if (generation === requestGeneration) {
        deviceFilter.disabled = false;
        timeFilter.disabled = false;
      }
    }
  };

  deviceFilter.addEventListener("change", () => void applyFilters());
  timeFilter.addEventListener("change", () => void applyFilters());
}
