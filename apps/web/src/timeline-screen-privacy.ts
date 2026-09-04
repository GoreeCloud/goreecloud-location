import './timeline-screen-privacy.css';

const coordinateText = new WeakMap<HTMLElement, string>();
const copyCoordinates = new WeakMap<HTMLButtonElement, string>();
let privacyEnabled = false;
let activeTimeline: HTMLElement | null = null;
let timelineObserver: MutationObserver | null = null;

function hasVisibleTimelineSamples(timeline: HTMLElement): boolean {
  return timeline.querySelector('.timeline-item') !== null;
}

function filtersAreBusy(timeline: HTMLElement): boolean {
  const device = timeline.querySelector<HTMLSelectElement>('#timeline-device-filter');
  const time = timeline.querySelector<HTMLSelectElement>('#timeline-time-filter');
  const deletion = timeline.querySelector<HTMLSelectElement>('#timeline-delete-window');
  return Boolean(device?.disabled || time?.disabled || deletion?.disabled);
}

function syncExportAvailability(timeline: HTMLElement): void {
  const hasSamples = hasVisibleTimelineSamples(timeline);
  const busy = filtersAreBusy(timeline);
  timeline.querySelectorAll<HTMLButtonElement>('#timeline-export-current, #timeline-export-geojson').forEach((button) => {
    const presentationFiltered = button.getAttribute('aria-disabled') === 'true';
    button.disabled = privacyEnabled || !hasSamples || busy || presentationFiltered;
    button.title = privacyEnabled
      ? 'Screen privacy is hiding precise coordinates. Show precise coordinates before exporting coordinate-bearing data.'
      : presentationFiltered
        ? 'Select All reported accuracy before exporting the full loaded Timeline view.'
        : '';
  });
}

function applyCoordinatePresentation(timeline: HTMLElement): void {
  timeline.classList.toggle('timeline-screen-privacy-active', privacyEnabled);

  timeline.querySelectorAll<HTMLElement>('.timeline-coordinates').forEach((coordinates) => {
    if (!coordinateText.has(coordinates)) coordinateText.set(coordinates, coordinates.textContent ?? '');
    if (privacyEnabled) coordinates.textContent = 'Precise coordinates hidden';
    else coordinates.textContent = coordinateText.get(coordinates) ?? coordinates.textContent ?? '';
  });

  timeline.querySelectorAll<HTMLButtonElement>('.timeline-copy-coordinates').forEach((button) => {
    const renderedCoordinates = button.dataset.timelineCopyCoordinate;
    if (renderedCoordinates && !copyCoordinates.has(button)) copyCoordinates.set(button, renderedCoordinates);
    if (privacyEnabled) {
      delete button.dataset.timelineCopyCoordinate;
      button.disabled = true;
      button.title = 'Screen privacy is hiding precise coordinates.';
      button.setAttribute('aria-disabled', 'true');
    } else {
      const original = copyCoordinates.get(button);
      if (original) button.dataset.timelineCopyCoordinate = original;
      button.disabled = false;
      button.title = '';
      button.removeAttribute('aria-disabled');
    }
  });

  syncExportAvailability(timeline);
}

function screenPrivacyStatus(timeline: HTMLElement): HTMLElement | null {
  return timeline.querySelector<HTMLElement>('#timeline-filter-status');
}

function ensurePrivacyControl(timeline: HTMLElement): void {
  const filters = timeline.querySelector<HTMLElement>('.timeline-filters');
  if (!filters) return;

  let control = timeline.querySelector<HTMLButtonElement>('#timeline-screen-privacy-toggle');
  if (!control) {
    control = document.createElement('button');
    control.type = 'button';
    control.id = 'timeline-screen-privacy-toggle';
    control.className = 'timeline-screen-privacy-toggle';
    control.setAttribute('role', 'switch');
    control.setAttribute('aria-controls', 'timeline-list');
    filters.append(control);

    control.addEventListener('click', () => {
      privacyEnabled = !privacyEnabled;
      control?.setAttribute('aria-checked', String(privacyEnabled));
      control!.textContent = privacyEnabled ? 'Show precise coordinates' : 'Hide precise coordinates';
      applyCoordinatePresentation(timeline);
      const status = screenPrivacyStatus(timeline);
      if (status) {
        status.textContent = privacyEnabled
          ? 'Screen privacy is active. Precise coordinate text, coordinate copy, and coordinate-bearing local exports are paused. Loaded Location data was not deleted, redacted, or changed.'
          : 'Screen privacy is off. Precise coordinates are visible again for this already-authorized loaded Timeline view. No history request or storage change was made.';
      }
    });
  }

  control.setAttribute('aria-checked', String(privacyEnabled));
  control.textContent = privacyEnabled ? 'Show precise coordinates' : 'Hide precise coordinates';
}

function bindTimelineScreenPrivacy(): void {
  const timeline = document.querySelector<HTMLElement>('#timeline');
  if (!timeline) return;

  if (activeTimeline !== timeline) {
    timelineObserver?.disconnect();
    activeTimeline = timeline;
    timelineObserver = new MutationObserver(() => {
      ensurePrivacyControl(timeline);
      applyCoordinatePresentation(timeline);
    });
    timelineObserver.observe(timeline, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled'],
    });
  }

  ensurePrivacyControl(timeline);
  applyCoordinatePresentation(timeline);
}

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const appObserver = new MutationObserver(() => bindTimelineScreenPrivacy());
  appObserver.observe(app, { childList: true, subtree: true });
  bindTimelineScreenPrivacy();
}

const blockCoordinateBearingExport = (event: Event): void => {
  if (!privacyEnabled) return;
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  if (target.id !== 'timeline-export-current' && target.id !== 'timeline-export-geojson') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const timeline = target.closest<HTMLElement>('#timeline');
  const status = timeline ? screenPrivacyStatus(timeline) : null;
  if (status) status.textContent = 'Screen privacy is active. Show precise coordinates before exporting coordinate-bearing Timeline data.';
};

document.addEventListener('click', blockCoordinateBearingExport, { capture: true });
