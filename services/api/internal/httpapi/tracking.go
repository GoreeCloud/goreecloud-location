package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/GoreeCloud/goreecloud-location/services/api/internal/identity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	maxClientSampleIDBytes = 128
	maxHistoryLimit        = 500
	defaultHistoryLimit    = 100
	maxFutureSampleSkew    = 5 * time.Minute
)

type ingestLocationRequest struct {
	ClientSampleID string     `json:"client_sample_id"`
	CapturedAt     time.Time  `json:"captured_at"`
	Latitude       *float64   `json:"latitude"`
	Longitude      *float64   `json:"longitude"`
	AccuracyM      *float64   `json:"accuracy_m,omitempty"`
	AltitudeM      *float64   `json:"altitude_m,omitempty"`
	SpeedMPS       *float64   `json:"speed_mps,omitempty"`
	BearingDeg     *float64   `json:"bearing_deg,omitempty"`
	BatteryPercent *int16     `json:"battery_percent,omitempty"`
}

type locationResponse struct {
	ID               string    `json:"id"`
	DeviceID         string    `json:"device_id"`
	ClientSampleID   string    `json:"client_sample_id"`
	CapturedAt       time.Time `json:"captured_at"`
	ServerReceivedAt time.Time `json:"server_received_at"`
	Latitude         float64   `json:"latitude"`
	Longitude        float64   `json:"longitude"`
	AccuracyM        *float64  `json:"accuracy_m,omitempty"`
	AltitudeM        *float64  `json:"altitude_m,omitempty"`
	SpeedMPS         *float64  `json:"speed_mps,omitempty"`
	BearingDeg       *float64  `json:"bearing_deg,omitempty"`
	BatteryPercent   *int16    `json:"battery_percent,omitempty"`
	Source           string    `json:"source"`
}

type ingestLocationResponse struct {
	Location  locationResponse `json:"location"`
	Duplicate bool             `json:"duplicate"`
}

type liveDeviceResponse struct {
	Device   deviceResponse    `json:"device"`
	Location *locationResponse `json:"location"`
}

type historyOptions struct {
	From     *time.Time
	To       *time.Time
	DeviceID string
	Limit    int
}

type rowScanner interface {
	Scan(dest ...any) error
}

// NewTracking returns the Milestone 2 tracking API surface. It deliberately
// reuses the established user/device authentication middleware and API type so
// authorization semantics cannot drift from the account/device surface.
func NewTracking(pool *pgxpool.Pool, logger *slog.Logger) http.Handler {
	api := &API{pool: pool, logger: logger, mux: http.NewServeMux()}
	api.mux.Handle("POST /api/v1/locations", api.requireDevice(http.HandlerFunc(api.ingestLocation)))
	api.mux.Handle("GET /api/v1/locations", api.requireUser(http.HandlerFunc(api.listLocations)))
	api.mux.Handle("GET /api/v1/live", api.requireUser(http.HandlerFunc(api.liveLocations)))
	return api
}

func (api *API) ingestLocation(w http.ResponseWriter, r *http.Request) {
	var request ingestLocationRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if err := normalizeAndValidateLocation(&request, time.Now().UTC()); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_location_sample")
		return
	}

	p := principalFromContext(r.Context())
	tx, err := api.pool.Begin(r.Context())
	if err != nil {
		api.internalError(w, r, "begin_location_ingestion", err)
		return
	}
	defer tx.Rollback(r.Context())

	// Re-lock the authenticated device inside the write transaction. This closes
	// the race where a device is revoked after middleware authentication but before
	// the sample is persisted; a concurrent revocation waits for this transaction.
	var revokedAt *time.Time
	if err := tx.QueryRow(r.Context(), `
		SELECT revoked_at
		FROM devices
		WHERE id = $1 AND user_id = $2
		FOR SHARE
	`, p.DeviceID, p.UserID).Scan(&revokedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "authentication_required")
			return
		}
		api.internalError(w, r, "lock_ingestion_device", err)
		return
	}
	if revokedAt != nil {
		writeError(w, http.StatusUnauthorized, "authentication_required")
		return
	}

	// Ensure the preference row exists and lock it while accepting the sample.
	// A concurrent pause request therefore cannot interleave with this decision.
	if _, err := tx.Exec(r.Context(), `
		INSERT INTO user_preferences(user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO NOTHING
	`, p.UserID); err != nil {
		api.internalError(w, r, "ensure_ingestion_preferences", err)
		return
	}
	var trackingPaused bool
	if err := tx.QueryRow(r.Context(), `
		SELECT tracking_paused
		FROM user_preferences
		WHERE user_id = $1
		FOR SHARE
	`, p.UserID).Scan(&trackingPaused); err != nil {
		api.internalError(w, r, "lock_ingestion_preferences", err)
		return
	}
	if trackingPaused {
		writeError(w, http.StatusConflict, "tracking_paused")
		return
	}

	sampleID, err := identity.NewUUID()
	if err != nil {
		api.internalError(w, r, "generate_location_id", err)
		return
	}

	location, err := insertLocation(r.Context(), tx, sampleID, p, request)
	if errors.Is(err, pgx.ErrNoRows) {
		existing, loadErr := loadLocationByClientSampleID(r.Context(), tx, p.UserID, p.DeviceID, request.ClientSampleID)
		if loadErr != nil {
			api.internalError(w, r, "load_duplicate_location", loadErr)
			return
		}
		if !sameLocationPayload(existing, request) {
			writeError(w, http.StatusConflict, "sample_conflict")
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			api.internalError(w, r, "commit_duplicate_location", err)
			return
		}
		writeJSON(w, http.StatusOK, ingestLocationResponse{Location: existing, Duplicate: true})
		return
	}
	if err != nil {
		api.internalError(w, r, "insert_location", err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		api.internalError(w, r, "commit_location_ingestion", err)
		return
	}

	writeJSON(w, http.StatusCreated, ingestLocationResponse{Location: location, Duplicate: false})
}

func insertLocation(ctx context.Context, tx pgx.Tx, id string, p principal, request ingestLocationRequest) (locationResponse, error) {
	return scanLocation(tx.QueryRow(ctx, `
		INSERT INTO location_samples(
			id, user_id, device_id, client_sample_id, captured_at, position,
			accuracy_m, altitude_m, speed_mps, bearing_deg, battery_percent, source
		)
		VALUES (
			$1, $2, $3, $4, $5,
			ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
			$8, $9, $10, $11, $12, 'native-device'
		)
		ON CONFLICT (device_id, client_sample_id) DO NOTHING
		RETURNING
			id::text, device_id::text, client_sample_id, captured_at,
			server_received_at, ST_Y(position::geometry), ST_X(position::geometry),
			accuracy_m, altitude_m, speed_mps, bearing_deg, battery_percent, source
	`, id, p.UserID, p.DeviceID, request.ClientSampleID, request.CapturedAt,
		*request.Longitude, *request.Latitude, request.AccuracyM, request.AltitudeM,
		request.SpeedMPS, request.BearingDeg, request.BatteryPercent))
}

func loadLocationByClientSampleID(ctx context.Context, tx pgx.Tx, userID, deviceID, clientSampleID string) (locationResponse, error) {
	return scanLocation(tx.QueryRow(ctx, `
		SELECT
			id::text, device_id::text, client_sample_id, captured_at,
			server_received_at, ST_Y(position::geometry), ST_X(position::geometry),
			accuracy_m, altitude_m, speed_mps, bearing_deg, battery_percent, source
		FROM location_samples
		WHERE user_id = $1 AND device_id = $2 AND client_sample_id = $3
	`, userID, deviceID, clientSampleID))
}

func (api *API) listLocations(w http.ResponseWriter, r *http.Request) {
	options, err := parseHistoryOptions(r.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_query")
		return
	}

	p := principalFromContext(r.Context())
	rows, err := api.pool.Query(r.Context(), `
		SELECT
			id::text, device_id::text, client_sample_id, captured_at,
			server_received_at, ST_Y(position::geometry), ST_X(position::geometry),
			accuracy_m, altitude_m, speed_mps, bearing_deg, battery_percent, source
		FROM location_samples
		WHERE user_id = $1
		  AND ($2::timestamptz IS NULL OR captured_at >= $2)
		  AND ($3::timestamptz IS NULL OR captured_at < $3)
		  AND ($4::text = '' OR device_id::text = $4)
		ORDER BY captured_at DESC, server_received_at DESC, id DESC
		LIMIT $5
	`, p.UserID, options.From, options.To, options.DeviceID, options.Limit)
	if err != nil {
		api.internalError(w, r, "list_locations", err)
		return
	}
	defer rows.Close()

	locations := make([]locationResponse, 0)
	for rows.Next() {
		location, err := scanLocation(rows)
		if err != nil {
			api.internalError(w, r, "list_locations_scan", err)
			return
		}
		locations = append(locations, location)
	}
	if err := rows.Err(); err != nil {
		api.internalError(w, r, "list_locations_rows", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"locations": locations})
}

func (api *API) liveLocations(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	rows, err := api.pool.Query(r.Context(), `
		SELECT
			device.id::text, device.display_name, device.device_class,
			sample.id::text, sample.device_id::text, sample.client_sample_id,
			sample.captured_at, sample.server_received_at,
			ST_Y(sample.position::geometry), ST_X(sample.position::geometry),
			sample.accuracy_m, sample.altitude_m, sample.speed_mps,
			sample.bearing_deg, sample.battery_percent, sample.source
		FROM devices AS device
		LEFT JOIN LATERAL (
			SELECT location_samples.*
			FROM location_samples
			WHERE location_samples.user_id = device.user_id
			  AND location_samples.device_id = device.id
			ORDER BY captured_at DESC, server_received_at DESC, id DESC
			LIMIT 1
		) AS sample ON true
		WHERE device.user_id = $1 AND device.revoked_at IS NULL
		ORDER BY device.created_at, device.id
	`, p.UserID)
	if err != nil {
		api.internalError(w, r, "list_live_locations", err)
		return
	}
	defer rows.Close()

	devices := make([]liveDeviceResponse, 0)
	for rows.Next() {
		var deviceID, displayName, deviceClass string
		var sampleID, sampleDeviceID, clientSampleID, source *string
		var capturedAt, serverReceivedAt *time.Time
		var latitude, longitude, accuracy, altitude, speed, bearing *float64
		var battery *int16
		if err := rows.Scan(
			&deviceID, &displayName, &deviceClass,
			&sampleID, &sampleDeviceID, &clientSampleID, &capturedAt, &serverReceivedAt,
			&latitude, &longitude, &accuracy, &altitude, &speed, &bearing, &battery, &source,
		); err != nil {
			api.internalError(w, r, "list_live_locations_scan", err)
			return
		}

		entry := liveDeviceResponse{
			Device: deviceResponse{ID: deviceID, DisplayName: displayName, DeviceClass: deviceClass},
		}
		if sampleID != nil {
			entry.Location = &locationResponse{
				ID:               *sampleID,
				DeviceID:         *sampleDeviceID,
				ClientSampleID:   *clientSampleID,
				CapturedAt:       *capturedAt,
				ServerReceivedAt: *serverReceivedAt,
				Latitude:         *latitude,
				Longitude:        *longitude,
				AccuracyM:        accuracy,
				AltitudeM:        altitude,
				SpeedMPS:         speed,
				BearingDeg:       bearing,
				BatteryPercent:   battery,
				Source:           *source,
			}
		}
		devices = append(devices, entry)
	}
	if err := rows.Err(); err != nil {
		api.internalError(w, r, "list_live_locations_rows", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"devices": devices})
}

func scanLocation(row rowScanner) (locationResponse, error) {
	var location locationResponse
	err := row.Scan(
		&location.ID,
		&location.DeviceID,
		&location.ClientSampleID,
		&location.CapturedAt,
		&location.ServerReceivedAt,
		&location.Latitude,
		&location.Longitude,
		&location.AccuracyM,
		&location.AltitudeM,
		&location.SpeedMPS,
		&location.BearingDeg,
		&location.BatteryPercent,
		&location.Source,
	)
	return location, err
}

func normalizeAndValidateLocation(request *ingestLocationRequest, now time.Time) error {
	request.ClientSampleID = strings.TrimSpace(request.ClientSampleID)
	request.CapturedAt = request.CapturedAt.UTC().Truncate(time.Microsecond)

	if !validClientSampleID(request.ClientSampleID) || request.CapturedAt.IsZero() {
		return errors.New("invalid identity or timestamp")
	}
	if request.CapturedAt.After(now.UTC().Add(maxFutureSampleSkew)) {
		return errors.New("captured_at is too far in the future")
	}
	if request.Latitude == nil || request.Longitude == nil {
		return errors.New("coordinates are required")
	}
	if !finiteInRange(*request.Latitude, -90, 90) || !finiteInRange(*request.Longitude, -180, 180) {
		return errors.New("invalid coordinates")
	}
	if request.AccuracyM != nil && !finiteInRange(*request.AccuracyM, 0, 1_000_000) {
		return errors.New("invalid accuracy")
	}
	if request.AltitudeM != nil && (math.IsNaN(*request.AltitudeM) || math.IsInf(*request.AltitudeM, 0)) {
		return errors.New("invalid altitude")
	}
	if request.SpeedMPS != nil && !finiteInRange(*request.SpeedMPS, 0, 1_000) {
		return errors.New("invalid speed")
	}
	if request.BearingDeg != nil && (!finiteInRange(*request.BearingDeg, 0, 360) || *request.BearingDeg == 360) {
		return errors.New("invalid bearing")
	}
	if request.BatteryPercent != nil && (*request.BatteryPercent < 0 || *request.BatteryPercent > 100) {
		return errors.New("invalid battery percentage")
	}
	return nil
}

func validClientSampleID(value string) bool {
	if value == "" || len(value) > maxClientSampleIDBytes {
		return false
	}
	for _, r := range value {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	return true
}

func finiteInRange(value, minimum, maximum float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= minimum && value <= maximum
}

func parseHistoryOptions(values url.Values) (historyOptions, error) {
	options := historyOptions{Limit: defaultHistoryLimit, DeviceID: strings.TrimSpace(values.Get("device_id"))}
	if len(options.DeviceID) > 64 {
		return historyOptions{}, errors.New("device id is too long")
	}

	if value := strings.TrimSpace(values.Get("from")); value != "" {
		parsed, err := time.Parse(time.RFC3339Nano, value)
		if err != nil {
			return historyOptions{}, err
		}
		parsed = parsed.UTC()
		options.From = &parsed
	}
	if value := strings.TrimSpace(values.Get("to")); value != "" {
		parsed, err := time.Parse(time.RFC3339Nano, value)
		if err != nil {
			return historyOptions{}, err
		}
		parsed = parsed.UTC()
		options.To = &parsed
	}
	if options.From != nil && options.To != nil && !options.From.Before(*options.To) {
		return historyOptions{}, errors.New("from must be before to")
	}

	if value := strings.TrimSpace(values.Get("limit")); value != "" {
		limit, err := strconv.Atoi(value)
		if err != nil || limit < 1 || limit > maxHistoryLimit {
			return historyOptions{}, errors.New("invalid limit")
		}
		options.Limit = limit
	}
	return options, nil
}

func sameLocationPayload(location locationResponse, request ingestLocationRequest) bool {
	return request.Latitude != nil && request.Longitude != nil &&
		location.DeviceID != "" &&
		location.ClientSampleID == request.ClientSampleID &&
		location.CapturedAt.Equal(request.CapturedAt) &&
		location.Latitude == *request.Latitude &&
		location.Longitude == *request.Longitude &&
		sameOptionalFloat(location.AccuracyM, request.AccuracyM) &&
		sameOptionalFloat(location.AltitudeM, request.AltitudeM) &&
		sameOptionalFloat(location.SpeedMPS, request.SpeedMPS) &&
		sameOptionalFloat(location.BearingDeg, request.BearingDeg) &&
		sameOptionalInt16(location.BatteryPercent, request.BatteryPercent)
}

func sameOptionalFloat(left, right *float64) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func sameOptionalInt16(left, right *int16) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}
