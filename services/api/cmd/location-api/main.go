// GoreeCloud Location API
//
// Milestone 0 intentionally exposes only non-sensitive health endpoints. User,
// device, location, sharing, and administrative APIs are added only after their
// authorization and data-ownership boundaries are implemented and tested.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultAddress      = ":8080"
	defaultDatabasePort = "5432"
	readinessTimeout    = 2 * time.Second
)

type healthResponse struct {
	Service string `json:"service"`
	Status  string `json:"status"`
}

type readinessCheck func(context.Context) error

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	server := newServer(addressFromEnvironment(), logger, databaseReadinessFromEnvironment())

	logger.Info("starting GoreeCloud Location API", "address", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("location API stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}

func newServer(address string, logger *slog.Logger, readiness readinessCheck) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /readyz", readinessHandler(logger, readiness))

	return &http.Server{
		Addr:              address,
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
}

func addressFromEnvironment() string {
	if address := strings.TrimSpace(os.Getenv("LOCATION_API_ADDRESS")); address != "" {
		return address
	}
	return defaultAddress
}

func databaseReadinessFromEnvironment() readinessCheck {
	host := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_HOST"))
	port := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_PORT"))
	if port == "" {
		port = defaultDatabasePort
	}

	return func(ctx context.Context) error {
		if host == "" {
			return errors.New("database host is not configured")
		}

		connection, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(host, port))
		if err != nil {
			return fmt.Errorf("database socket unavailable: %w", err)
		}
		return connection.Close()
	}
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeHealthResponse(w, http.StatusOK, "ok")
}

func readinessHandler(logger *slog.Logger, readiness readinessCheck) http.HandlerFunc {
	return func(w http.ResponseWriter, request *http.Request) {
		ctx, cancel := context.WithTimeout(request.Context(), readinessTimeout)
		defer cancel()

		if err := readiness(ctx); err != nil {
			logger.Warn("location API is not ready", "dependency", "database")
			writeHealthResponse(w, http.StatusServiceUnavailable, "not_ready")
			return
		}

		writeHealthResponse(w, http.StatusOK, "ready")
	}
}

func writeHealthResponse(w http.ResponseWriter, statusCode int, status string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(healthResponse{
		Service: "goreecloud-location-api",
		Status:  status,
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}
