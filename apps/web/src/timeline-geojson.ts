export type TimelineGeoJSONSample = {
  id: string;
  device_id: string;
  captured_at: string;
  server_received_at: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  source: string;
};

export type TimelineGeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: {
      device_id: string;
      device_name: string;
      captured_at: string;
      server_received_at: string;
      accuracy_m?: number;
      source: string;
    };
  }>;
};

export function timelineHistoryGeoJSON(
  samples: TimelineGeoJSONSample[],
  deviceNames: ReadonlyMap<string, string> = new Map(),
  limit = 50,
): TimelineGeoJSONFeatureCollection {
  const boundedLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 50;
  return {
    type: "FeatureCollection",
    features: samples.slice(0, boundedLimit).map((sample) => ({
      type: "Feature",
      id: sample.id,
      geometry: {
        type: "Point",
        coordinates: [sample.longitude, sample.latitude],
      },
      properties: {
        device_id: sample.device_id,
        device_name: deviceNames.get(sample.device_id) ?? "Enrolled device",
        captured_at: sample.captured_at,
        server_received_at: sample.server_received_at,
        ...(sample.accuracy_m == null ? {} : { accuracy_m: sample.accuracy_m }),
        source: sample.source,
      },
    })),
  };
}
