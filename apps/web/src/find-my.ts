export type FindMyDevice = {
  id: string;
  display_name: string;
  device_class: string;
  revoked_at?: string;
};

export type FindMyLocationSample = {
  captured_at: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  battery_percent?: number;
  source: string;
};

export type FindMyLiveDevice = {
  device: FindMyDevice;
  location: FindMyLocationSample | null;
};

type FindMyState = {
  label: "Live" | "Recent" | "Stale" | "Offline" | "Unavailable";
  className: "good" | "warn" | "stale" | "offline" | "muted";
  detail: string;
};

const GLAZE_VERSION = "1.5.0";
const GLAZE_SOURCE_REVISION = "2e1618397f6ebcdd254a76bfdd7e98846f2c5aa3";

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatRelativeTime(value: string, now = Date.now()): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown age";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function findMyState(entry: FindMyLiveDevice, now = Date.now()): FindMyState {
  if (entry.device.revoked_at) {
    return {
      label: "Unavailable",
      className: "muted",
      detail: "Enrollment is revoked; recovery commands are unavailable.",
    };
  }
  if (!entry.location) {
    return {
      label: "Unavailable",
      className: "muted",
      detail: "No authorized location sample is available yet.",
    };
  }

  const timestamp = Date.parse(entry.location.captured_at);
  if (!Number.isFinite(timestamp)) {
    return {
      label: "Unavailable",
      className: "muted",
      detail: "The latest sample timestamp is invalid.",
    };
  }

  const ageMs = Math.max(0, now - timestamp);
  if (ageMs <= 5 * 60_000) {
    return { label: "Live", className: "good", detail: "A sample arrived within the last five minutes." };
  }
  if (ageMs <= 60 * 60_000) {
    return { label: "Recent", className: "warn", detail: "The latest sample is less than one hour old." };
  }
  if (ageMs <= 24 * 60 * 60_000) {
    return { label: "Stale", className: "stale", detail: "The latest sample is more than one hour old." };
  }
  return {
    label: "Offline",
    className: "offline",
    detail: "No sample has arrived in the last 24 hours; this is a recency state, not a connectivity probe.",
  };
}

function mapPosition(sample: FindMyLocationSample): { x: number; y: number } {
  const x = Math.min(98, Math.max(2, ((sample.longitude + 180) / 360) * 100));
  const y = Math.min(96, Math.max(4, ((90 - sample.latitude) / 180) * 100));
  return { x, y };
}

function renderMapPin(entry: FindMyLiveDevice, index: number): string {
  if (!entry.location || entry.device.revoked_at) return "";
  const position = mapPosition(entry.location);
  const state = findMyState(entry);
  const label = `${entry.device.display_name}: ${state.label}, ${formatRelativeTime(entry.location.captured_at)}`;
  return `<button class="find-map-pin ${state.className}" type="button" style="--pin-x:${position.x.toFixed(2)}%;--pin-y:${position.y.toFixed(2)}%" aria-label="${escapeHTML(label)}" data-find-pin="${index}"><span aria-hidden="true">⌖</span></button>`;
}

function renderDevice(entry: FindMyLiveDevice, index: number): string {
  const state = findMyState(entry);
  const sample = entry.location;
  const searchable = `${entry.device.display_name} ${entry.device.device_class} ${state.label}`.toLowerCase();
  const coordinates = sample
    ? `${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`
    : "No location available";
  const recency = sample ? formatRelativeTime(sample.captured_at) : "Never reported";
  const accuracy = sample?.accuracy_m == null ? "Not reported" : `±${Math.round(sample.accuracy_m)} m`;
  const battery = sample?.battery_percent == null ? "Not reported" : `${sample.battery_percent}%`;

  return `
    <article class="find-device-card" data-find-device="${index}" data-find-search="${escapeHTML(searchable)}">
      <header class="find-device-heading">
        <div>
          <span class="eyebrow">${escapeHTML(entry.device.device_class)}</span>
          <h3>${escapeHTML(entry.device.display_name)}</h3>
        </div>
        <span class="state-pill ${state.className}">${state.label}</span>
      </header>
      <p class="find-state-detail">${escapeHTML(state.detail)}</p>
      <dl class="find-device-facts">
        <div><dt>Last known</dt><dd>${escapeHTML(recency)}</dd></div>
        <div><dt>Coordinates</dt><dd>${escapeHTML(coordinates)}</dd></div>
        <div><dt>Accuracy</dt><dd>${escapeHTML(accuracy)}</dd></div>
        <div><dt>Battery</dt><dd>${escapeHTML(battery)}</dd></div>
      </dl>
      <div class="recovery-panel" aria-label="Recovery capability state">
        <div><strong>Recovery state</strong><span>Not armed in this Development slice.</span></div>
        <div class="recovery-actions">
          <button type="button" disabled aria-disabled="true">Lost Mode</button>
          <button type="button" disabled aria-disabled="true">Play sound</button>
          <button type="button" disabled aria-disabled="true">Mark found</button>
        </div>
        <p>Commands remain disabled until device command authority, authentication, anti-abuse controls, and evidence-backed recovery contracts are implemented.</p>
      </div>
    </article>`;
}

export function renderFindMySurface(entries: FindMyLiveDevice[]): string {
  const withLocation = entries.filter((entry) => entry.location && !entry.device.revoked_at);
  const stateCounts = entries.reduce<Record<string, number>>((counts, entry) => {
    const label = findMyState(entry).label;
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});

  return `
    <section class="find-my-section" id="find-my" aria-labelledby="find-my-title" data-glaze-version="${GLAZE_VERSION}" data-glaze-source-revision="${GLAZE_SOURCE_REVISION}">
      <div class="find-my-heading">
        <div><span class="eyebrow">Find My</span><h2 id="find-my-title">Find an enrolled device.</h2></div>
        <label class="find-search"><span class="sr-only">Search enrolled devices</span><input id="find-device-search" type="search" placeholder="Search devices" autocomplete="off" /></label>
      </div>
      <p class="find-my-intro">This Development surface uses only your authenticated owner-scoped location data. Status is derived from sample recency and never claims a live connectivity probe.</p>

      <div class="find-summary" aria-label="Device finding summary">
        ${["Live", "Recent", "Stale", "Offline", "Unavailable"].map((label) => `<div><strong>${stateCounts[label] ?? 0}</strong><span>${label}</span></div>`).join("")}
      </div>

      <section class="find-map-card" aria-labelledby="find-map-title">
        <div class="map-toolbar"><div><span class="eyebrow">Device map</span><h3 id="find-map-title">Last known positions</h3></div><span class="provider-state">MapLibre tile provider pending</span></div>
        <div class="find-map-stage" role="img" aria-label="World coordinate overview of authorized device positions. Geographic tiles are disabled in this development slice.">
          <div class="find-map-grid" aria-hidden="true"></div>
          ${withLocation.length ? entries.map(renderMapPin).join("") : `<div class="map-message"><strong>No positions available</strong><p>Authorized last-known positions will appear here when enrolled devices report them.</p></div>`}
        </div>
        <p class="find-map-note">Pins use a simple world-coordinate projection only. Map tiles, routing, geocoding, and third-party requests remain disabled until a reviewed provider contract exists.</p>
      </section>

      <div class="find-results-heading"><strong id="find-result-count">${entries.length} device${entries.length === 1 ? "" : "s"}</strong><span aria-live="polite" id="find-filter-status">Showing all enrolled devices.</span></div>
      <div class="find-device-grid">
        ${entries.length ? entries.map(renderDevice).join("") : `<div class="empty-state"><strong>No enrolled devices</strong><p>Enroll a device before Find My can show authorized state.</p></div>`}
      </div>
    </section>`;
}

export function bindFindMySurface(): void {
  const input = document.querySelector<HTMLInputElement>("#find-device-search");
  const status = document.querySelector<HTMLElement>("#find-filter-status");
  const count = document.querySelector<HTMLElement>("#find-result-count");
  if (!input || !status || !count) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const devices = Array.from(document.querySelectorAll<HTMLElement>("[data-find-device]"));
    let visible = 0;
    for (const device of devices) {
      const matches = !query || (device.dataset.findSearch ?? "").includes(query);
      device.hidden = !matches;
      if (matches) visible += 1;
    }
    count.textContent = `${visible} device${visible === 1 ? "" : "s"}`;
    status.textContent = query ? `Filtered by “${input.value.trim()}”.` : "Showing all enrolled devices.";
  });
}
