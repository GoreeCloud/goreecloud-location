package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	server := newServer(":0", slog.Default(), func(context.Context) error { return nil })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)

	server.Handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("expected Cache-Control no-store, got %q", got)
	}
	if got := recorder.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options nosniff, got %q", got)
	}

	body := decodeHealthResponse(t, recorder)
	if body.Service != "goreecloud-location-api" || body.Status != "ok" {
		t.Fatalf("unexpected response: %#v", body)
	}
}

func TestReadinessEndpointReady(t *testing.T) {
	server := newServer(":0", slog.Default(), func(context.Context) error { return nil })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)

	server.Handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if body := decodeHealthResponse(t, recorder); body.Status != "ready" {
		t.Fatalf("expected ready status, got %#v", body)
	}
}

func TestReadinessEndpointNotReady(t *testing.T) {
	server := newServer(":0", slog.Default(), func(context.Context) error {
		return errors.New("database unavailable")
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)

	server.Handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, recorder.Code)
	}
	if body := decodeHealthResponse(t, recorder); body.Status != "not_ready" {
		t.Fatalf("expected not_ready status, got %#v", body)
	}
}

func TestUnknownRouteIsNotFound(t *testing.T) {
	server := newServer(":0", slog.Default(), func(context.Context) error { return nil })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/locations", nil)

	server.Handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, recorder.Code)
	}
}

func decodeHealthResponse(t *testing.T, recorder *httptest.ResponseRecorder) healthResponse {
	t.Helper()

	var body healthResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return body
}
