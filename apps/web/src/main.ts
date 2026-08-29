import "./styles.css";
import { bindFindMySurface, renderFindMySurface, type FindMyRecoveryDevice } from "./find-my";

type User = {
  id: string;
  display_name: string;
};

type Device = {
  id: string;
  display_name: string;
  device_class: string;
  revoked_at?: string;
};

type Preferences = {
  time_zone: string;
  distance_unit: "metric" | "imperial";
  tracking_paused: boolean;
};

type LocationSample = {
  id: string;
  device_id: string;
  captured_at: string;
  server_received_at: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  altitude_m?: number;
  speed_mps?: number;
  bearing_deg?: number;
  battery_percent?: number;
  source: string;
};

type LiveDevice = {
  device: Device;
  location: LocationSample | null;
};

const storageKey = "goreecloud-location-user-token";
const refreshIntervalMs = 30_000;

const applicationRoot = document.querySelector<HTMLElement>("#app");
if (!applicationRoot) throw new Error("GoreeCloud Location application root was not found.");
const app: HTMLElement = applicationRoot;

let token = sessionStorage.getItem(storageKey) ?? "";
let refreshTimer: number | undefined;

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatCoordinates(sample: LocationSample): string {
  return `${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`;
}

function locationState(sample: LocationSample | null): { label: string; className: string } {
  if (!sample) return { label: "No location yet", className: "muted" };
  const ageMs = Date.now() - Date.parse(sample.captured_at);
  if (ageMs <= 5 * 60_000) return { label: "Live", className: "good" };
  if (ageMs <= 60 * 60_000) return { label: "Recent", className: "warn" };
  return { label: "Last known", className: "muted" };
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (response.status === 401) {
    sessionStorage.removeItem(storageKey);
    token = "";
    throw new Error("authentication_required");
  }
  if (!response.ok) throw new Error(`request_failed_${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function renderSignIn(message = ""): void {
  if (refreshTimer) window.clearInterval(refreshTimer);
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card" aria-labelledby="signin-title">
        <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">◎</span><span>GoreeCloud Location</span></div>
        <div class="auth-copy">
          <span class="eyebrow">Private by default</span>
          <h1 id="signin-title">Your places. Your devices. Your control.</h1>
          <p>Use an issued GoreeCloud Location user credential to open the current development experience. Credentials are stored only for this browser session.</p>
        </div>
        <form id="signin-form" class="signin-form">
          <label for="credential">User credential</label>
          <div class="credential-row">
            <input id="credential" name="credential" type="password" autocomplete="off" spellcheck="false" placeholder="loc_usr_…" required />
            <button type="submit">Open Location</button>
          </div>
          ${message ? `<p class="form-error" role="alert">${escapeHTML(message)}</p>` : ""}
          <p class="privacy-note">GoreeCloud Location never needs a client-supplied user ID. Your identity is derived from the authenticated credential.</p>
        </form>
      </section>
    </main>`;

  document.querySelector<HTMLFormElement>("#signin-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>("#credential");
    const candidate = input?.value.trim() ?? "";
    if (!candidate.startsWith("loc_usr_")) {
      renderSignIn("Enter a valid GoreeCloud Location user credential.");
      return;
    }
    token = candidate;
    sessionStorage.setItem(storageKey, token);
    await renderApplication();
  });
}

function deviceIcon(deviceClass: string): string {
  const icons: Record<string, string> = {
    phone: "▯",
    tablet: "▭",
    laptop: "⌑",
    desktop: "▣",
    wearable: "◌",
    vehicle: "◇",
    tracker: "●",
    server: "▤",
    tv: "▰",
  };
  return icons[deviceClass] ?? "◉";
}

function renderDeviceCard(entry: LiveDevice): string {
  const state = locationState(entry.location);
  const sample = entry.location;
  return `
    <article class="device-card" data-device-id="${escapeHTML(entry.device.id)}">
      <div class="device-card-top">
        <div class="device-icon" aria-hidden="true">${deviceIcon(entry.device.device_class)}</div>
        <div class="device-title-wrap">
          <h3>${escapeHTML(entry.device.display_name)}</h3>
          <span>${escapeHTML(entry.device.device_class)}</span>
        </div>
        <span class="state-pill ${state.className}">${state.label}</span>
      </div>
      ${sample ? `
        <div class="device-location">
          <strong>${escapeHTML(formatCoordinates(sample))}</strong>
          <span>${formatRelativeTime(sample.captured_at)}</span>
        </div>
        <dl class="device-facts">
          <div><dt>Accuracy</dt><dd>${sample.accuracy_m == null ? "—" : `±${Math.round(sample.accuracy_m)} m`}</dd></div>
          <div><dt>Battery</dt><dd>${sample.battery_percent == null ? "—" : `${sample.battery_percent}%`}</dd></div>
          <div><dt>Source</dt><dd>${escapeHTML(sample.source)}</dd></div>
        </dl>` : `
        <div class="device-empty">This enrolled device has not reported a native location sample yet.</div>`}
    </article>`;
}

async function setTrackingPaused(current: Preferences): Promise<void> {
  const next = !current.tracking_paused;
  await apiRequest<Preferences>("/api/v1/preferences", {
    method: "PUT",
    body: JSON.stringify({
      time_zone: current.time_zone,
      distance_unit: current.distance_unit,
      tracking_paused: next,
    }),
  });
  await refreshDashboard();
}

async function loadDashboard(): Promise<{ user: User; preferences: Preferences; live: LiveDevice[]; recovery: FindMyRecoveryDevice[] }> {
  const recoveryRequest = apiRequest<{ devices: FindMyRecoveryDevice[] }>("/api/v1/find-my/recovery-capabilities")
    .catch(() => ({ devices: [] }));
  const [user, preferences, liveResponse, recoveryResponse] = await Promise.all([
    apiRequest<User>("/api/v1/me"),
    apiRequest<Preferences>("/api/v1/preferences"),
    apiRequest<{ devices: LiveDevice[] }>("/api/v1/live"),
    recoveryRequest,
  ]);
  return { user, preferences, live: liveResponse.devices, recovery: recoveryResponse.devices };
}

async function renderApplication(): Promise<void> {
  try {
    const data = await loadDashboard();
    app.innerHTML = `
      <div class="app-shell" data-glaze-ui="location" data-glaze-version="2.0.0">
        <aside class="sidebar" aria-label="Location navigation">
          <a class="brand-lockup app-brand" href="#live"><span class="brand-mark" aria-hidden="true">◎</span><span>Location</span></a>
          <nav>
            <a class="nav-item active" href="#live"><span>⌖</span>Live</a>
            <a class="nav-item disabled" href="#timeline" aria-disabled="true"><span>◷</span>Timeline <em>Next</em></a>
            <a class="nav-item disabled" href="#places" aria-disabled="true"><span>⌂</span>Places</a>
            <a class="nav-item disabled" href="#trips" aria-disabled="true"><span>↗</span>Trips</a>
            <a class="nav-item" href="#find-my"><span>◎</span>Find My <em>Dev</em></a>
            <a class="nav-item disabled" href="#sharing" aria-disabled="true"><span>◇</span>Sharing</a>
          </nav>
          <div class="sidebar-footer">
            <div class="account-chip"><span class="avatar">${escapeHTML(data.user.display_name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHTML(data.user.display_name)}</strong><span>Development</span></div></div>
            <button id="sign-out" class="icon-button" type="button" aria-label="Sign out">↪</button>
          </div>
        </aside>

        <main class="workspace" id="live">
          <header class="topbar">
            <div><span class="eyebrow">Live</span><h1>Where your devices are now.</h1></div>
            <div class="topbar-actions">
              <button id="refresh-live" class="secondary-button" type="button">Refresh</button>
              <button id="tracking-toggle" class="${data.preferences.tracking_paused ? "primary-button" : "danger-button"}" type="button">
                ${data.preferences.tracking_paused ? "Resume tracking" : "Pause tracking"}
              </button>
            </div>
          </header>

          <section class="privacy-banner ${data.preferences.tracking_paused ? "paused" : ""}" aria-live="polite">
            <span class="privacy-icon" aria-hidden="true">${data.preferences.tracking_paused ? "Ⅱ" : "◉"}</span>
            <div><strong>${data.preferences.tracking_paused ? "Tracking is paused" : "Native tracking is active"}</strong><span>${data.preferences.tracking_paused ? "New device samples are blocked server-side until you resume." : "Only authenticated enrolled devices can report location to your account."}</span></div>
          </section>

          <section class="map-card" aria-labelledby="map-title">
            <div class="map-toolbar">
              <div><span class="eyebrow">Live surface</span><h2 id="map-title">${data.live.length} enrolled device${data.live.length === 1 ? "" : "s"}</h2></div>
              <span class="provider-state">MapLibre provider adapter pending</span>
            </div>
            <div class="map-stage">
              <div class="map-grid" aria-hidden="true"></div>
              <div class="map-message">
                <span class="map-pin" aria-hidden="true">⌖</span>
                <strong>Private map foundation</strong>
                <p>Live coordinates are available from the native API. Geographic tiles stay disabled until the replaceable MapLibre provider contract is implemented.</p>
              </div>
            </div>
          </section>

          <section class="devices-section" aria-labelledby="devices-title">
            <div class="section-heading"><div><span class="eyebrow">Devices</span><h2 id="devices-title">Live and last known</h2></div><span class="updated-at">Updated just now</span></div>
            <div class="device-grid">
              ${data.live.length ? data.live.map(renderDeviceCard).join("") : `<div class="empty-state"><strong>No enrolled devices</strong><p>Enroll a device through the authenticated API before live location can appear here.</p></div>`}
            </div>
          </section>

          ${renderFindMySurface(data.live, data.recovery)}
        </main>
      </div>`;

    document.querySelector<HTMLButtonElement>("#sign-out")?.addEventListener("click", () => {
      sessionStorage.removeItem(storageKey);
      token = "";
      renderSignIn();
    });
    document.querySelector<HTMLButtonElement>("#refresh-live")?.addEventListener("click", () => void refreshDashboard());
    document.querySelector<HTMLButtonElement>("#tracking-toggle")?.addEventListener("click", () => void setTrackingPaused(data.preferences));
    bindFindMySurface();

    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => void refreshDashboard(), refreshIntervalMs);
  } catch (error) {
    if (error instanceof Error && error.message === "authentication_required") {
      renderSignIn("Your credential was rejected or is no longer active.");
      return;
    }
    renderSignIn("GoreeCloud Location could not reach the native API.");
  }
}

async function refreshDashboard(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>("#refresh-live");
  if (button) {
    button.disabled = true;
    button.textContent = "Refreshing…";
  }
  await renderApplication();
}

if (token) {
  void renderApplication();
} else {
  renderSignIn();
}
