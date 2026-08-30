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
              <option value="all">Loaded history</option>
              <option value="1h">Past hour</option>
              <option value="24h">Past 24 hours</option>
              <option value="7d">Past 7 days</option>
            </select>
          </label>
        </div>
      </div>

      <div class="timeline-privacy-note" role="note">
        <strong>Privacy boundary</strong>
        <span>Showing at most ${timelineLimit} owner-scoped samples returned by the existing authenticated history API. Device and time filtering happen only in this loaded view.</span>
      </div>

      <p class="timeline-filter-status" id="timeline-filter-status" role="status">Showing ${boundedSamples.length} loaded sample${boundedSamples.length === 1 ? "" : "s"}.</p>
      <ol class="timeline-list" id="timeline-list">
        ${boundedSamples.length ? boundedSamples.map((sample) => renderTimelineItem(sample, deviceNames)).join("") : `
          <li class="timeline-empty">
            <strong>No persisted history yet</strong>
            <span>Location samples will appear here only after an enrolled device reports them to your account.</span>
          </li>`}
      </ol>
    </section>`;
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

export function bindTimelineSurface(): void {
  const deviceFilter = document.querySelector<HTMLSelectElement>("#timeline-device-filter");
  const timeFilter = document.querySelector<HTMLSelectElement>("#timeline-time-filter");
  const list = document.querySelector<HTMLOListElement>("#timeline-list");
  const status = document.querySelector<HTMLElement>("#timeline-filter-status");
  if (!deviceFilter || !timeFilter || !list || !status) return;

  const applyFilters = () => {
    const selectedDevice = deviceFilter.value;
    const selectedWindow = timeFilter.value as TimelineWindow;
    const now = Date.now();
    let visible = 0;

    for (const item of list.querySelectorAll<HTMLElement>("[data-timeline-device][data-timeline-captured-at]")) {
      const deviceMatches = selectedDevice === "all" || item.dataset.timelineDevice === selectedDevice;
      const timeMatches = timelineSampleMatchesWindow(item.dataset.timelineCapturedAt ?? "", selectedWindow, now);
      item.hidden = !(deviceMatches && timeMatches);
      if (!item.hidden) visible += 1;
    }

    status.textContent = `Showing ${visible} loaded sample${visible === 1 ? "" : "s"} after local filters.`;
  };

  deviceFilter.addEventListener("change", applyFilters);
  timeFilter.addEventListener("change", applyFilters);
}
