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
        <label class="timeline-filter" for="timeline-device-filter">
          <span>Device</span>
          <select id="timeline-device-filter">
            <option value="all">All devices</option>
            ${deviceOptions}
          </select>
        </label>
      </div>

      <div class="timeline-privacy-note" role="note">
        <strong>Privacy boundary</strong>
        <span>Showing at most ${timelineLimit} owner-scoped samples returned by the existing authenticated history API. Filtering happens only in this loaded view.</span>
      </div>

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
    <li class="timeline-item" data-timeline-device="${escapeHTML(sample.device_id)}">
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
  const filter = document.querySelector<HTMLSelectElement>("#timeline-device-filter");
  const list = document.querySelector<HTMLOListElement>("#timeline-list");
  if (!filter || !list) return;

  filter.addEventListener("change", () => {
    const selected = filter.value;
    for (const item of list.querySelectorAll<HTMLElement>("[data-timeline-device]")) {
      item.hidden = selected !== "all" && item.dataset.timelineDevice !== selected;
    }
  });
}
