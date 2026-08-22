// GoreeCloud Location API
//
// Milestone 0 intentionally exposes only non-sensitive health endpoints. User,
// device, location, sharing, and administrative APIs are added only after their
// authorization and data-ownership boundaries are implemented and tested.
package main

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"
)

const defaultAddress = ":8080"

type healthResponse struct {
	Service string `json:"service"`
	Status  string `json:"status"`
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	server := newServer(addressFromEnvironment(), logger)

	logger.Info("starting GoreeCloud Location API", "address", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("location API stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}

func newServer(address string, logger *slog.Logger) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /readyz", healthHandler)

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
	if address := os.Getenv("LOCATION_API_ADDRESS"); address != "" {
		return address
	}
	return defaultAddress
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(healthResponse{
		Service: "goreecloud-location-api",
		Status:  "ok",
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
