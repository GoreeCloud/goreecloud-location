import "./find-my-device-detail.css";
import type { FindMyLiveDevice, FindMyLocationSample, FindMyRecoveryDevice } from "./find-my";

export type FindMyDeviceDetail = {
  device: FindMyRecoveryDevice;
  last_location: FindMyPersistedLocation | null;
};

export type FindMyPersistedLocation = FindMyLocationSample & {
  id: string;
  device_id: string;
  client_sample_id?: string;
  server_received_at?: string;
  altitude_m?: number;
  speed_mps?: number;
  bearing_deg?: number;
};

export type FindMyLocationHistoryResponse = {
  locations: FindMyPersistedLocation[];
};

type DeviceDetailRequest = <T>(path: string) => Promise<T>;

const FIND_MY_HISTORY_LIMIT = 10;

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return "Not reported";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Invalid timestamp";
  return new Date(parsed).toLocaleString();
}

function formatNumber(value: number | undefined, suffix: string, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "Not reported";
  return `${value.toFixed(digits)}${suffix}`;
}

function recoveryLabel(action: FindMyRecoveryDevice["capabilities"][keyof FindMyRecoveryDevice["capabilities"]]): string {
  if (action.available) return "Capability reported available, but this Development UI has no execution path.";
  if (action.reason === "device_enrollment_revoked") return "Denied: device enrollment is revoked.";
  if (action.reason === "recovery_authority_unavailable") return "Denied: recovery command authority is not implemented.";
  return `Denied: ${action.reason || "unknown reason"}.`;
}

function ensureDialog(): HTMLDialogElement {
  const existing = document.querySelector<HTMLDialogElement>("#find-device-detail-dialog");
  if (existing) return existing;

  const dialog = document.createElement("dialog");
  dialog.id = "find-device-detail-dialog";
  dialog.className = "find-device-detail-dialog";
  dialog.setAttribute("aria-labelledby", "find-device-detail-title");
  dialog.innerHTML = `
    <div class="find-detail-shell">
      <div id="find-device-detail-content"></div>
      <div class="find-detail-footer">
        <button class="secondary-button" type="button" data-find-detail-close>Close</button>
      </div>
    </div>`;
  document.body.append(dialog);
  dialog.querySelector<HTMLButtonElement>("[data-find-detail-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

function renderLoading(dialog: HTMLDialogElement, displayName: string): void {
  const content = dialog.querySelector<HTMLElement>("#find-device-detail-content");
  if (!content) return;
  content.innerHTML = `
    <span class="eyebrow">Owner-scoped device detail</span>
    <h2 id="find-device-detail-title">${escapeHTML(displayName)}</h2>
    <p class="find-detail-status" role="status">Loading persisted device state and bounded location history…</p>`;
}

function renderFailure(dialog: HTMLDialogElement): void {
  const content = dialog.querySelector<HTMLElement>("#find-device-detail-content");
  if (!content) return;
  content.innerHTML = `
    <span class="eyebrow">Owner-scoped device detail</span>
    <h2 id="find-device-detail-title">Device detail unavailable</h2>
    <p class="find-detail-status" role="alert">The authoritative device detail or history could not be loaded. No recovery command was attempted.</p>`;
}

function renderDetail(
  dialog: HTMLDialogElement,
  detail: FindMyDeviceDetail,
  history: FindMyLocationHistoryResponse,
): void {
  const content = dialog.querySelector<HTMLElement>("#find-device-detail-content");
  if (!content) return;
  const location = detail.last_location;
  const device = detail.device;
  const revoked = Boolean(device.revoked_at);
  const coordinates = location
    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
    : "No persisted location sample";
  const locations = Array.isArray(history.locations)
    ? history.locations.filter((sample) => sample.device_id === device.device_id).slice(0, FIND_MY_HISTORY_LIMIT)
    : [];

  content.innerHTML = `
    <div class="find-detail-heading">
      <div>
        <span class="eyebrow">Owner-scoped device detail</span>
        <h2 id="find-device-detail-title">${escapeHTML(device.display_name)}</h2>
        <p>${escapeHTML(device.device_class)} · ${revoked ? "Enrollment revoked" : "Enrolled"}</p>
      </div>
      <span class="state-pill ${revoked ? "muted" : "good"}">${revoked ? "Revoked" : "Owner verified"}</span>
    </div>

    <section class="find-detail-section" aria-labelledby="find-detail-location-title">
      <div class="find-detail-section-heading">
        <span class="eyebrow">Persisted state</span>
        <h3 id="find-detail-location-title">Last known location</h3>
      </div>
      <dl class="find-detail-facts">
        <div><dt>Coordinates</dt><dd>${escapeHTML(coordinates)}</dd></div>
        <div><dt>Captured</dt><dd>${escapeHTML(formatTimestamp(location?.captured_at))}</dd></div>
        <div><dt>Server received</dt><dd>${escapeHTML(formatTimestamp(location?.server_received_at))}</dd></div>
        <div><dt>Accuracy</dt><dd>${escapeHTML(formatNumber(location?.accuracy_m, " m"))}</dd></div>
        <div><dt>Battery</dt><dd>${escapeHTML(formatNumber(location?.battery_percent, "%"))}</dd></div>
        <div><dt>Altitude</dt><dd>${escapeHTML(formatNumber(location?.altitude_m, " m", 1))}</dd></div>
        <div><dt>Speed</dt><dd>${escapeHTML(formatNumber(location?.speed_mps, " m/s", 1))}</dd></div>
        <div><dt>Source</dt><dd>${escapeHTML(location?.source ?? "Not reported")}</dd></div>
      </dl>
      <p class="find-detail-note">This is the latest persisted authorized sample. It is not a current connectivity, nearby-finding, or offline-network proof.</p>
    </section>

    <section class="find-detail-section" aria-labelledby="find-detail-history-title">
      <div class="find-detail-section-heading find-detail-history-heading">
        <div>
          <span class="eyebrow">Owner-scoped history</span>
          <h3 id="find-detail-history-title">Recent persisted samples</h3>
        </div>
        <span>${locations.length} of at most ${FIND_MY_HISTORY_LIMIT}</span>
      </div>
      ${renderHistory(locations)}
      <p class="find-detail-note">History comes from the existing authenticated <code>/api/v1/locations</code> read, filtered to this device and bounded to ${FIND_MY_HISTORY_LIMIT} newest persisted samples. It does not infer movement between samples or prove device reachability.</p>
    </section>

    <section class="find-detail-section" aria-labelledby="find-detail-recovery-title">
      <div class="find-detail-section-heading">
        <span class="eyebrow">Recovery gate</span>
        <h3 id="find-detail-recovery-title">Commands remain non-executable</h3>
      </div>
      <div class="find-detail-recovery-grid">
        ${renderRecoveryCapability("Lost Mode", device.capabilities.lost_mode)}
        ${renderRecoveryCapability("Play sound", device.capabilities.play_sound)}
        ${renderRecoveryCapability("Mark found", device.capabilities.mark_found)}
      </div>
      <p class="find-detail-note">These controls mirror the server-authoritative capability gate. This UI never promotes a denied or unimplemented capability into an executable action.</p>
    </section>`;
}

function renderHistory(locations: FindMyPersistedLocation[]): string {
  if (locations.length === 0) {
    return `<div class="find-detail-history-empty">No persisted samples are available for this device.</div>`;
  }

  return `<ol class="find-detail-history-list">
    ${locations.map((sample) => {
      const coordinates = `${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`;
      return `<li>
        <div class="find-detail-history-time">
          <strong>${escapeHTML(formatTimestamp(sample.captured_at))}</strong>
          <span>${escapeHTML(formatTimestamp(sample.server_received_at))}</span>
        </div>
        <div class="find-detail-history-position">
          <strong>${escapeHTML(coordinates)}</strong>
          <span>${escapeHTML(formatNumber(sample.accuracy_m, " m accuracy"))}</span>
        </div>
        <span class="find-detail-history-source">${escapeHTML(sample.source || "Not reported")}</span>
      </li>`;
    }).join("")}
  </ol>`;
}

function renderRecoveryCapability(
  label: string,
  action: FindMyRecoveryDevice["capabilities"][keyof FindMyRecoveryDevice["capabilities"]],
): string {
  return `
    <div class="find-detail-recovery-item">
      <button type="button" disabled aria-disabled="true">${escapeHTML(label)}</button>
      <span>${escapeHTML(recoveryLabel(action))}</span>
    </div>`;
}

export function bindFindMyDeviceDetails(entries: FindMyLiveDevice[], request: DeviceDetailRequest): void {
  const dialog = ensureDialog();
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-find-device]"));

  cards.forEach((card, index) => {
    const entry = entries[index];
    if (!entry) return;

    const existing = card.querySelector<HTMLButtonElement>("[data-find-detail-open]");
    const button = existing ?? document.createElement("button");
    if (!existing) {
      button.type = "button";
      button.className = "find-detail-open secondary-button";
      button.dataset.findDetailOpen = entry.device.id;
      button.textContent = "View authoritative detail";
      card.append(button);
    }

    button.addEventListener("click", async () => {
      renderLoading(dialog, entry.device.display_name);
      if (!dialog.open) dialog.showModal();
      try {
        const deviceId = encodeURIComponent(entry.device.id);
        const [detail, history] = await Promise.all([
          request<FindMyDeviceDetail>(`/api/v1/find-my/devices/${deviceId}`),
          request<FindMyLocationHistoryResponse>(`/api/v1/locations?device_id=${deviceId}&limit=${FIND_MY_HISTORY_LIMIT}`),
        ]);
        renderDetail(dialog, detail, history);
      } catch {
        renderFailure(dialog);
      }
    });
  });
}
