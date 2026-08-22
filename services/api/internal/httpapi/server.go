package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/GoreeCloud/goreecloud-location/services/api/internal/identity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxRequestBodyBytes = 32 << 10

type contextKey string

const principalContextKey contextKey = "principal"

type principal struct {
	UserID   string
	DeviceID string
	Kind     string
}

type API struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
	mux    *http.ServeMux
}

type userResponse struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
}

type deviceResponse struct {
	ID          string     `json:"id"`
	DisplayName string     `json:"display_name"`
	DeviceClass string     `json:"device_class"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
}

type enrolledDeviceResponse struct {
	Device     deviceResponse `json:"device"`
	Credential string         `json:"credential"`
}

type preferencesResponse struct {
	TimeZone       string `json:"time_zone"`
	DistanceUnit   string `json:"distance_unit"`
	TrackingPaused bool   `json:"tracking_paused"`
}

type enrollDeviceRequest struct {
	DisplayName string `json:"display_name"`
	DeviceClass string `json:"device_class"`
}

type updatePreferencesRequest struct {
	TimeZone       string `json:"time_zone"`
	DistanceUnit   string `json:"distance_unit"`
	TrackingPaused bool   `json:"tracking_paused"`
}

func New(pool *pgxpool.Pool, logger *slog.Logger) *API {
	api := &API{pool: pool, logger: logger, mux: http.NewServeMux()}
	api.mux.Handle("GET /api/v1/me", api.requireUser(http.HandlerFunc(api.getMe)))
	api.mux.Handle("GET /api/v1/devices", api.requireUser(http.HandlerFunc(api.listDevices)))
	api.mux.Handle("POST /api/v1/devices", api.requireUser(http.HandlerFunc(api.enrollDevice)))
	api.mux.Handle("DELETE /api/v1/devices/{deviceID}", api.requireUser(http.HandlerFunc(api.revokeDevice)))
	api.mux.Handle("GET /api/v1/preferences", api.requireUser(http.HandlerFunc(api.getPreferences)))
	api.mux.Handle("PUT /api/v1/preferences", api.requireUser(http.HandlerFunc(api.updatePreferences)))
	api.mux.Handle("GET /api/v1/device", api.requireDevice(http.HandlerFunc(api.getDeviceIdentity)))
	return api
}

func (api *API) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	api.mux.ServeHTTP(w, r)
}

func Readiness(ctx context.Context, pool *pgxpool.Pool) error {
	if err := pool.Ping(ctx); err != nil {
		return err
	}
	var applied bool
	if err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM schema_migrations
			WHERE version = '0002_auth_devices_preferences'
		)
	`).Scan(&applied); err != nil {
		return err
	}
	if !applied {
		return errors.New("required database migration is not applied")
	}
	return nil
}

func (api *API) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok || !strings.HasPrefix(token, "loc_usr_") {
			writeError(w, http.StatusUnauthorized, "authentication_required")
			return
		}

		var userID string
		err := api.pool.QueryRow(r.Context(), `
			UPDATE user_access_tokens AS token
			SET last_used_at = now()
			FROM users AS owner
			WHERE token.token_hash = $1
			  AND token.user_id = owner.id
			  AND token.revoked_at IS NULL
			  AND (token.expires_at IS NULL OR token.expires_at > now())
			RETURNING token.user_id
		`, identity.HashOpaqueToken(token)).Scan(&userID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "authentication_required")
			return
		}
		if err != nil {
			api.internalError(w, r, "authenticate_user", err)
			return
		}

		ctx := context.WithValue(r.Context(), principalContextKey, principal{UserID: userID, Kind: "user"})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (api *API) requireDevice(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok || !strings.HasPrefix(token, "loc_dev_") {
			writeError(w, http.StatusUnauthorized, "authentication_required")
			return
		}

		var userID, deviceID string
		err := api.pool.QueryRow(r.Context(), `
			UPDATE device_credentials AS credential
			SET last_used_at = now()
			FROM devices AS device
			WHERE credential.token_hash = $1
			  AND credential.user_id = device.user_id
			  AND credential.device_id = device.id
			  AND credential.revoked_at IS NULL
			  AND device.revoked_at IS NULL
			  AND (credential.expires_at IS NULL OR credential.expires_at > now())
			RETURNING credential.user_id, credential.device_id
		`, identity.HashOpaqueToken(token)).Scan(&userID, &deviceID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "authentication_required")
			return
		}
		if err != nil {
			api.internalError(w, r, "authenticate_device", err)
			return
		}

		ctx := context.WithValue(r.Context(), principalContextKey, principal{UserID: userID, DeviceID: deviceID, Kind: "device"})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (api *API) getMe(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	var response userResponse
	if err := api.pool.QueryRow(r.Context(), `
		SELECT id, display_name FROM users WHERE id = $1
	`, p.UserID).Scan(&response.ID, &response.DisplayName); err != nil {
		api.internalError(w, r, "get_me", err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (api *API) listDevices(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	rows, err := api.pool.Query(r.Context(), `
		SELECT id, display_name, device_class, revoked_at
		FROM devices
		WHERE user_id = $1
		ORDER BY created_at, id
	`, p.UserID)
	if err != nil {
		api.internalError(w, r, "list_devices", err)
		return
	}
	defer rows.Close()

	devices := make([]deviceResponse, 0)
	for rows.Next() {
		var device deviceResponse
		if err := rows.Scan(&device.ID, &device.DisplayName, &device.DeviceClass, &device.RevokedAt); err != nil {
			api.internalError(w, r, "list_devices_scan", err)
			return
		}
		devices = append(devices, device)
	}
	if err := rows.Err(); err != nil {
		api.internalError(w, r, "list_devices_rows", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": devices})
}

func (api *API) enrollDevice(w http.ResponseWriter, r *http.Request) {
	var request enrollDeviceRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	request.DisplayName = strings.TrimSpace(request.DisplayName)
	request.DeviceClass = strings.TrimSpace(strings.ToLower(request.DeviceClass))
	if request.DisplayName == "" || len(request.DisplayName) > 100 || !validDeviceClass(request.DeviceClass) {
		writeError(w, http.StatusBadRequest, "invalid_device")
		return
	}

	p := principalFromContext(r.Context())
	deviceID, err := identity.NewUUID()
	if err != nil {
		api.internalError(w, r, "generate_device_id", err)
		return
	}
	credentialID, err := identity.NewUUID()
	if err != nil {
		api.internalError(w, r, "generate_device_credential_id", err)
		return
	}
	credential, credentialHash, err := identity.NewOpaqueToken("loc_dev_")
	if err != nil {
		api.internalError(w, r, "generate_device_credential", err)
		return
	}

	tx, err := api.pool.Begin(r.Context())
	if err != nil {
		api.internalError(w, r, "begin_device_enrollment", err)
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `
		INSERT INTO devices(id, user_id, display_name, device_class)
		VALUES ($1, $2, $3, $4)
	`, deviceID, p.UserID, request.DisplayName, request.DeviceClass); err != nil {
		api.internalError(w, r, "insert_device", err)
		return
	}
	if _, err := tx.Exec(r.Context(), `
		INSERT INTO device_credentials(id, user_id, device_id, token_hash, label)
		VALUES ($1, $2, $3, $4, 'initial enrollment')
	`, credentialID, p.UserID, deviceID, credentialHash); err != nil {
		api.internalError(w, r, "insert_device_credential", err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		api.internalError(w, r, "commit_device_enrollment", err)
		return
	}

	writeJSON(w, http.StatusCreated, enrolledDeviceResponse{
		Device:     deviceResponse{ID: deviceID, DisplayName: request.DisplayName, DeviceClass: request.DeviceClass},
		Credential: credential,
	})
}

func (api *API) revokeDevice(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	deviceID := strings.TrimSpace(r.PathValue("deviceID"))
	if deviceID == "" {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}

	tx, err := api.pool.Begin(r.Context())
	if err != nil {
		api.internalError(w, r, "begin_device_revocation", err)
		return
	}
	defer tx.Rollback(r.Context())

	commandTag, err := tx.Exec(r.Context(), `
		UPDATE devices
		SET revoked_at = now(), updated_at = now()
		WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, deviceID, p.UserID)
	if err != nil {
		api.internalError(w, r, "revoke_device", err)
		return
	}
	if commandTag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	if _, err := tx.Exec(r.Context(), `
		UPDATE device_credentials
		SET revoked_at = COALESCE(revoked_at, now())
		WHERE device_id = $1 AND user_id = $2
	`, deviceID, p.UserID); err != nil {
		api.internalError(w, r, "revoke_device_credentials", err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		api.internalError(w, r, "commit_device_revocation", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (api *API) getPreferences(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	preferences, err := api.loadPreferences(r.Context(), p.UserID)
	if err != nil {
		api.internalError(w, r, "get_preferences", err)
		return
	}
	writeJSON(w, http.StatusOK, preferences)
}

func (api *API) updatePreferences(w http.ResponseWriter, r *http.Request) {
	var request updatePreferencesRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	request.TimeZone = strings.TrimSpace(request.TimeZone)
	request.DistanceUnit = strings.TrimSpace(strings.ToLower(request.DistanceUnit))
	if request.TimeZone == "" || len(request.TimeZone) > 100 || (request.DistanceUnit != "metric" && request.DistanceUnit != "imperial") {
		writeError(w, http.StatusBadRequest, "invalid_preferences")
		return
	}

	p := principalFromContext(r.Context())
	var response preferencesResponse
	if err := api.pool.QueryRow(r.Context(), `
		INSERT INTO user_preferences(user_id, time_zone, distance_unit, tracking_paused)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id) DO UPDATE SET
			time_zone = EXCLUDED.time_zone,
			distance_unit = EXCLUDED.distance_unit,
			tracking_paused = EXCLUDED.tracking_paused,
			updated_at = now()
		RETURNING time_zone, distance_unit, tracking_paused
	`, p.UserID, request.TimeZone, request.DistanceUnit, request.TrackingPaused).Scan(
		&response.TimeZone, &response.DistanceUnit, &response.TrackingPaused,
	); err != nil {
		api.internalError(w, r, "update_preferences", err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (api *API) getDeviceIdentity(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	var response deviceResponse
	if err := api.pool.QueryRow(r.Context(), `
		SELECT id, display_name, device_class, revoked_at
		FROM devices
		WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, p.DeviceID, p.UserID).Scan(&response.ID, &response.DisplayName, &response.DeviceClass, &response.RevokedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "authentication_required")
			return
		}
		api.internalError(w, r, "get_device_identity", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user_id": p.UserID, "device": response})
}

func (api *API) loadPreferences(ctx context.Context, userID string) (preferencesResponse, error) {
	var response preferencesResponse
	err := api.pool.QueryRow(ctx, `
		INSERT INTO user_preferences(user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
		RETURNING time_zone, distance_unit, tracking_paused
	`, userID).Scan(&response.TimeZone, &response.DistanceUnit, &response.TrackingPaused)
	return response, err
}

func (api *API) internalError(w http.ResponseWriter, r *http.Request, operation string, err error) {
	api.logger.Error("location API request failed", "operation", operation, "method", r.Method, "route", r.Pattern, "error", err)
	writeError(w, http.StatusInternalServerError, "internal_error")
}

func bearerToken(r *http.Request) (string, bool) {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	token := strings.TrimSpace(parts[1])
	return token, token != ""
}

func principalFromContext(ctx context.Context) principal {
	value, _ := ctx.Value(principalContextKey).(principal)
	return value
}

func validDeviceClass(value string) bool {
	switch value {
	case "phone", "tablet", "vehicle", "tracker", "watch", "other":
		return true
	default:
		return false
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, destination any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain exactly one JSON value")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
