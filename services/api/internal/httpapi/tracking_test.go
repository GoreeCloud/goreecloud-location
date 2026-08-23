package httpapi

import (
	"math"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestNormalizeAndValidateLocationAcceptsValidSample(t *testing.T) {
	now := time.Date(2026, 8, 22, 23, 0, 0, 0, time.UTC)
	accuracy := 8.5
	altitude := 142.3
	speed := 3.2
	bearing := 359.9
	battery := int16(87)
	request := ingestLocationRequest{
		ClientSampleID: "  sample-001  ",
		CapturedAt:     now.Add(-time.Minute).Add(789 * time.Nanosecond),
		Latitude:       41.8781,
		Longitude:      -87.6298,
		AccuracyM:      &accuracy,
		AltitudeM:      &altitude,
		SpeedMPS:       &speed,
		BearingDeg:     &bearing,
		BatteryPercent: &battery,
	}

	if err := normalizeAndValidateLocation(&request, now); err != nil {
		t.Fatal(err)
	}
	if request.ClientSampleID != "sample-001" {
		t.Fatalf("client sample id was not normalized: %q", request.ClientSampleID)
	}
	if request.CapturedAt.Nanosecond()%1000 != 0 {
		t.Fatalf("captured_at was not normalized to PostgreSQL microsecond precision: %s", request.CapturedAt)
	}
}

func TestNormalizeAndValidateLocationRejectsInvalidSamples(t *testing.T) {
	now := time.Date(2026, 8, 22, 23, 0, 0, 0, time.UTC)
	valid := func() ingestLocationRequest {
		return ingestLocationRequest{
			ClientSampleID: "sample-001",
			CapturedAt:     now,
			Latitude:       41.8781,
			Longitude:      -87.6298,
		}
	}

	tests := map[string]func(*ingestLocationRequest){
		"blank client sample id": func(request *ingestLocationRequest) { request.ClientSampleID = "   " },
		"oversized client sample id": func(request *ingestLocationRequest) { request.ClientSampleID = strings.Repeat("a", maxClientSampleIDBytes+1) },
		"control character": func(request *ingestLocationRequest) { request.ClientSampleID = "sample\n001" },
		"zero timestamp": func(request *ingestLocationRequest) { request.CapturedAt = time.Time{} },
		"future timestamp": func(request *ingestLocationRequest) { request.CapturedAt = now.Add(maxFutureSampleSkew + time.Second) },
		"latitude": func(request *ingestLocationRequest) { request.Latitude = 90.1 },
		"longitude": func(request *ingestLocationRequest) { request.Longitude = -180.1 },
		"nan coordinate": func(request *ingestLocationRequest) { request.Latitude = math.NaN() },
		"negative accuracy": func(request *ingestLocationRequest) { value := -1.0; request.AccuracyM = &value },
		"infinite altitude": func(request *ingestLocationRequest) { value := math.Inf(1); request.AltitudeM = &value },
		"negative speed": func(request *ingestLocationRequest) { value := -0.1; request.SpeedMPS = &value },
		"bearing 360": func(request *ingestLocationRequest) { value := 360.0; request.BearingDeg = &value },
		"battery over 100": func(request *ingestLocationRequest) { value := int16(101); request.BatteryPercent = &value },
	}

	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			request := valid()
			mutate(&request)
			if err := normalizeAndValidateLocation(&request, now); err == nil {
				t.Fatal("expected invalid sample to be rejected")
			}
		})
	}
}

func TestParseHistoryOptions(t *testing.T) {
	values := url.Values{
		"from":      {"2026-08-20T00:00:00Z"},
		"to":        {"2026-08-23T00:00:00Z"},
		"device_id": {"device-a"},
		"limit":     {"250"},
	}
	options, err := parseHistoryOptions(values)
	if err != nil {
		t.Fatal(err)
	}
	if options.From == nil || options.To == nil || options.DeviceID != "device-a" || options.Limit != 250 {
		t.Fatalf("unexpected history options: %#v", options)
	}
}

func TestParseHistoryOptionsRejectsInvalidBounds(t *testing.T) {
	tests := []url.Values{
		{"limit": {"0"}},
		{"limit": {"501"}},
		{"limit": {"not-a-number"}},
		{"from": {"invalid"}},
		{"from": {"2026-08-23T00:00:00Z"}, "to": {"2026-08-22T00:00:00Z"}},
		{"device_id": {strings.Repeat("d", 65)}},
	}
	for _, values := range tests {
		if _, err := parseHistoryOptions(values); err == nil {
			t.Fatalf("expected invalid query to be rejected: %v", values)
		}
	}
}

func TestSameLocationPayload(t *testing.T) {
	captured := time.Date(2026, 8, 22, 23, 0, 0, 123000, time.UTC)
	accuracy := 5.0
	battery := int16(80)
	request := ingestLocationRequest{
		ClientSampleID: "sample-001",
		CapturedAt:     captured,
		Latitude:       41.0,
		Longitude:      -87.0,
		AccuracyM:      &accuracy,
		BatteryPercent: &battery,
	}
	location := locationResponse{
		DeviceID:       "device-a",
		ClientSampleID: request.ClientSampleID,
		CapturedAt:     captured,
		Latitude:       request.Latitude,
		Longitude:      request.Longitude,
		AccuracyM:      &accuracy,
		BatteryPercent: &battery,
	}
	if !sameLocationPayload(location, request) {
		t.Fatal("equivalent payload was not recognized as idempotent")
	}
	request.Longitude = -88.0
	if sameLocationPayload(location, request) {
		t.Fatal("conflicting payload was accepted as idempotent")
	}
}
