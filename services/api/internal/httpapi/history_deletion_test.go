package httpapi

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestParseHistoryDeletionOptionsRequiresExplicitNonFutureCutoff(t *testing.T) {
	now := time.Date(2026, 8, 30, 15, 0, 0, 0, time.UTC)
	options, err := parseHistoryDeletionOptions(url.Values{
		"before":    {"2026-08-29T12:30:00.123456789-05:00"},
		"device_id": {" device-a "},
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	if options.DeviceID != "device-a" {
		t.Fatalf("unexpected device id: %q", options.DeviceID)
	}
	if options.Before.Location() != time.UTC || options.Before.Nanosecond()%1000 != 0 {
		t.Fatalf("cutoff was not normalized to UTC microsecond precision: %s", options.Before)
	}
}

func TestParseHistoryDeletionOptionsRejectsUnsafeScope(t *testing.T) {
	now := time.Date(2026, 8, 30, 15, 0, 0, 0, time.UTC)
	tests := []url.Values{
		{},
		{"before": {"invalid"}},
		{"before": {"2026-08-30T15:00:01Z"}},
		{"before": {"2026-08-29T00:00:00Z"}, "device_id": {strings.Repeat("d", 65)}},
	}
	for _, values := range tests {
		if _, err := parseHistoryDeletionOptions(values, now); err == nil {
			t.Fatalf("expected unsafe deletion scope to be rejected: %v", values)
		}
	}
}
