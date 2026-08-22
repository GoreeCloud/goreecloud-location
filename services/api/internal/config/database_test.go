package config

import (
	"net/url"
	"testing"
)

func TestDatabaseURLFromEnvironmentTargetsConfiguredDatabase(t *testing.T) {
	t.Setenv("LOCATION_DATABASE_HOST", "127.0.0.1")
	t.Setenv("LOCATION_DATABASE_PORT", "5432")
	t.Setenv("LOCATION_DATABASE_NAME", "goreecloud_location")
	t.Setenv("LOCATION_DATABASE_USER", "location_app")
	t.Setenv("LOCATION_DATABASE_PASSWORD", "development-only-test-value")
	t.Setenv("LOCATION_DATABASE_PASSWORD_FILE", "")
	t.Setenv("LOCATION_DATABASE_SSLMODE", "disable")

	databaseURL, err := DatabaseURLFromEnvironment()
	if err != nil {
		t.Fatal(err)
	}

	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatalf("parse database URL: %v", err)
	}
	if parsed.Scheme != "postgres" {
		t.Fatalf("unexpected scheme %q", parsed.Scheme)
	}
	if parsed.Host != "127.0.0.1:5432" {
		t.Fatalf("unexpected host %q", parsed.Host)
	}
	if parsed.Path != "/goreecloud_location" {
		t.Fatalf("unexpected database path %q", parsed.Path)
	}
	if parsed.User.Username() != "location_app" {
		t.Fatalf("unexpected database user %q", parsed.User.Username())
	}
	password, ok := parsed.User.Password()
	if !ok || password != "development-only-test-value" {
		t.Fatal("database password was not preserved in the parsed URL")
	}
	if parsed.Query().Get("sslmode") != "disable" {
		t.Fatalf("unexpected sslmode %q", parsed.Query().Get("sslmode"))
	}
}

func TestDatabaseURLFromEnvironmentDefaultsToRequireTLS(t *testing.T) {
	t.Setenv("LOCATION_DATABASE_HOST", "database.internal")
	t.Setenv("LOCATION_DATABASE_PORT", "")
	t.Setenv("LOCATION_DATABASE_NAME", "location")
	t.Setenv("LOCATION_DATABASE_USER", "location_app")
	t.Setenv("LOCATION_DATABASE_PASSWORD", "development-only-test-value")
	t.Setenv("LOCATION_DATABASE_PASSWORD_FILE", "")
	t.Setenv("LOCATION_DATABASE_SSLMODE", "")

	databaseURL, err := DatabaseURLFromEnvironment()
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatalf("parse database URL: %v", err)
	}
	if parsed.Host != "database.internal:5432" {
		t.Fatalf("unexpected default host/port %q", parsed.Host)
	}
	if parsed.Query().Get("sslmode") != "require" {
		t.Fatalf("expected TLS-required default, got %q", parsed.Query().Get("sslmode"))
	}
}
