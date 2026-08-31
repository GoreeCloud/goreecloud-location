export type TimelineGPXSample = {
  id: string;
  device_id: string;
  captured_at: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  source: string;
};

function escapeXML(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

export function timelineHistoryGPX(
  samples: TimelineGPXSample[],
  deviceNames: ReadonlyMap<string, string> = new Map(),
  limit = 50,
): string {
  const boundedLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 50;
  const waypoints = samples.slice(0, boundedLimit).map((sample) => {
    if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) {
      throw new TypeError("Timeline GPX coordinates must be finite.");
    }
    const name = escapeXML(deviceNames.get(sample.device_id) ?? "Enrolled device");
    const accuracy = sample.accuracy_m == null || !Number.isFinite(sample.accuracy_m)
      ? ""
      : ` · Accuracy: ±${sample.accuracy_m} m`;
    const description = escapeXML(`Source: ${sample.source}${accuracy}`);
    return `  <wpt lat="${sample.latitude}" lon="${sample.longitude}">\n` +
      `    <time>${escapeXML(sample.captured_at)}</time>\n` +
      `    <name>${name}</name>\n` +
      `    <desc>${description}</desc>\n` +
      "  </wpt>";
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="GoreeCloud Location" xmlns="http://www.topografix.com/GPX/1/1">',
    ...waypoints,
    '</gpx>',
    '',
  ].join("\n");
}
