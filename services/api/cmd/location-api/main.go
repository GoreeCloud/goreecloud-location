// GoreeCloud Location API
//
// Milestone 2 adds device-authenticated location ingestion and owner-scoped
// location history/live reads while preserving the Milestone 1 account and
// device-management authorization boundary.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/GoreeCloud/goreecloud-location/services/api/internal/config"
	"github.com/GoreeCloud/goreecloud-location/services/api/internal/httpapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultAddress   = ":8080"
	readinessTimeout = 2 * time.Second
)

type healthResponse struct {
	Service string `json:"service"`
	Status  string `json:"status"`
}

type readinessCheck func(context.Context) error

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	databaseURL, err := config.DatabaseURLFromEnvironment()
	if err != nil {
		logger.Error("invalid database configuration", "error", err)
		os.Exit(1)
	}

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		logger.Error("could not parse database configuration", "error", err)
		os.Exit(1)
	}
	configuredDatabase := poolConfig.ConnConfig.Database
	if configuredDatabase == "" {
		logger.Error("database configuration did not select a database")
		os.Exit(1)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		logger.Error("could not initialize database pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	accountAPI := httpapi.New(pool, logger)
	trackingAPI := httpapi.NewTracking(pool, logger)
	api := combinedAPIHandler(accountAPI, trackingAPI)
	server := newServer(addressFromEnvironment(), logger, func(ctx context.Context) error {
		if err := httpapi.Readiness(ctx, pool); err != nil {
			var connectedDatabase string
			if inspectionErr := pool.QueryRow(ctx, `SELECT current_database()`).Scan(&connectedDatabase); inspectionErr != nil {
				return fmt.Errorf("database readiness failed for configured database %q; database identity inspection failed: %v: %w", configuredDatabase, inspectionErr, err)
			}
			return fmt.Errorf("database readiness failed for configured database %q while connected to %q: %w", configuredDatabase, connectedDatabase, err)
		}
		return nil
	}, api)

	logger.Info("starting GoreeCloud Location API", "address", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("location API stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}

func combinedAPIHandler(accountAPI, trackingAPI http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/locations", "/api/v1/live":
			trackingAPI.ServeHTTP(w, r)
		default:
			accountAPI.ServeHTTP(w, r)
		}
	})
}

func newServer(address string, logger *slog.Logger, readiness readinessCheck, api http.Handler) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /readyz", readinessHandler(logger, readiness))
	if api != nil {
		mux.Handle("/api/v1/", api)
	}

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

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeHealthResponse(w, http.StatusOK, "ok")
}

func readinessHandler(logger *slog.Logger, readiness readinessCheck) http.HandlerFunc {
	return func(w http.ResponseWriter, request *http.Request) {
		ctx, cancel := context.WithTimeout(request.Context(), readinessTimeout)
		defer cancel()

		if err := readiness(ctx); err != nil {
			logger.Warn("location API is not ready", "dependency", "database", "error", err)
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
