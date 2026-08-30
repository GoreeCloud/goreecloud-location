package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const maxHistoryDeletionBatch = 500

type historyDeletionOptions struct {
	Before   time.Time
	DeviceID string
}

type historyDeletionResponse struct {
	DeletedCount  int64 `json:"deleted_count"`
	MoreMayRemain bool  `json:"more_may_remain"`
}

// NewHistoryControl returns the explicit owner-authorized destructive history
// surface. It is kept separate from ingestion/read composition so an accidental
// route change cannot silently turn a read or device-authenticated request into
// history deletion authority.
func NewHistoryControl(pool *pgxpool.Pool, logger *slog.Logger) http.Handler {
	api := &API{pool: pool, logger: logger, mux: http.NewServeMux()}
	api.mux.Handle("DELETE /api/v1/locations", api.requireUser(http.HandlerFunc(api.deleteLocationHistory)))
	return api
}

func (api *API) deleteLocationHistory(w http.ResponseWriter, r *http.Request) {
	options, err := parseHistoryDeletionOptions(r.URL.Query(), time.Now().UTC())
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_query")
		return
	}

	p := principalFromContext(r.Context())
	var deletedCount int64
	if err := api.pool.QueryRow(r.Context(), `
		WITH target AS (
			SELECT id
			FROM location_samples
			WHERE user_id = $1
			  AND captured_at < $2
			  AND ($3::text = '' OR device_id::text = $3)
			ORDER BY captured_at, server_received_at, id
			LIMIT $4
		), deleted AS (
			DELETE FROM location_samples AS sample
			USING target
			WHERE sample.id = target.id
			RETURNING sample.id
		)
		SELECT count(*) FROM deleted
	`, p.UserID, options.Before, options.DeviceID, maxHistoryDeletionBatch).Scan(&deletedCount); err != nil {
		api.internalError(w, r, "delete_location_history", err)
		return
	}

	writeJSON(w, http.StatusOK, historyDeletionResponse{
		DeletedCount:  deletedCount,
		MoreMayRemain: deletedCount == maxHistoryDeletionBatch,
	})
}

func parseHistoryDeletionOptions(values url.Values, now time.Time) (historyDeletionOptions, error) {
	beforeValue := strings.TrimSpace(values.Get("before"))
	if beforeValue == "" {
		return historyDeletionOptions{}, errors.New("before cutoff is required")
	}
	before, err := time.Parse(time.RFC3339Nano, beforeValue)
	if err != nil {
		return historyDeletionOptions{}, err
	}
	before = before.UTC().Truncate(time.Microsecond)
	if before.After(now.UTC()) {
		return historyDeletionOptions{}, errors.New("before cutoff must not be in the future")
	}

	deviceID := strings.TrimSpace(values.Get("device_id"))
	if len(deviceID) > 64 {
		return historyDeletionOptions{}, errors.New("device id is too long")
	}

	return historyDeletionOptions{Before: before, DeviceID: deviceID}, nil
}
