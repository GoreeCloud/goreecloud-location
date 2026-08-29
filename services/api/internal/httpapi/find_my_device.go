package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

type findMyDeviceDetailResponse struct {
	Device       findMyRecoveryDeviceResponse `json:"device"`
	LastLocation *locationResponse            `json:"last_location"`
}

// getFindMyDeviceDetail returns one authenticated owner's enrolled-device identity,
// latest persisted location sample, and the current authoritative recovery gate.
// The device id is always constrained by the authenticated user id so this endpoint
// cannot be used as a cross-user enrollment or location existence oracle.
func (api *API) getFindMyDeviceDetail(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	deviceID := r.PathValue("deviceID")
	if deviceID == "" {
		writeError(w, http.StatusNotFound, "device_not_found")
		return
	}

	row := api.pool.QueryRow(r.Context(), `
		SELECT
			device.id::text, device.display_name, device.device_class, device.revoked_at,
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
		WHERE device.user_id = $1 AND device.id::text = $2
	`, p.UserID, deviceID)

	var response findMyDeviceDetailResponse
	var sampleID, sampleDeviceID, clientSampleID, source *string
	var capturedAt, serverReceivedAt *time.Time
	var latitude, longitude, accuracy, altitude, speed, bearing *float64
	var battery *int16
	if err := row.Scan(
		&response.Device.DeviceID,
		&response.Device.DisplayName,
		&response.Device.DeviceClass,
		&response.Device.RevokedAt,
		&sampleID,
		&sampleDeviceID,
		&clientSampleID,
		&capturedAt,
		&serverReceivedAt,
		&latitude,
		&longitude,
		&accuracy,
		&altitude,
		&speed,
		&bearing,
		&battery,
		&source,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "device_not_found")
			return
		}
		api.internalError(w, r, "find_my_device_detail", err)
		return
	}

	response.Device.Capabilities = deniedRecoveryCapabilities(response.Device.RevokedAt != nil)
	if sampleID != nil {
		response.LastLocation = &locationResponse{
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

	writeJSON(w, http.StatusOK, response)
}
