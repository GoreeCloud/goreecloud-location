package httpapi

import (
	"net/http"
	"time"
)

// Recovery capability responses are authoritative server-side gates for the
// current Find My Development surface. No recovery command is considered
// available until a later accepted implementation replaces these denied states.
type recoveryActionCapability struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason"`
}

type recoveryCapabilities struct {
	LostMode  recoveryActionCapability `json:"lost_mode"`
	PlaySound recoveryActionCapability `json:"play_sound"`
	MarkFound recoveryActionCapability `json:"mark_found"`
}

type findMyRecoveryDeviceResponse struct {
	DeviceID     string               `json:"device_id"`
	DisplayName  string               `json:"display_name"`
	DeviceClass  string               `json:"device_class"`
	RevokedAt    *time.Time           `json:"revoked_at,omitempty"`
	Capabilities recoveryCapabilities `json:"capabilities"`
}

// FindMyRecoveryRoutes exposes owner-scoped Find My read state without creating
// recovery command authority. It reuses the same user authentication middleware
// as ordinary account/device APIs.
func (api *API) FindMyRecoveryRoutes() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/find-my/recovery-capabilities", api.requireUser(http.HandlerFunc(api.getFindMyRecoveryCapabilities)))
	mux.Handle("GET /api/v1/find-my/devices/{deviceID}", api.requireUser(http.HandlerFunc(api.getFindMyDeviceDetail)))
	return mux
}

func (api *API) getFindMyRecoveryCapabilities(w http.ResponseWriter, r *http.Request) {
	p := principalFromContext(r.Context())
	rows, err := api.pool.Query(r.Context(), `
		SELECT id, display_name, device_class, revoked_at
		FROM devices
		WHERE user_id = $1
		ORDER BY created_at, id
	`, p.UserID)
	if err != nil {
		api.internalError(w, r, "find_my_recovery_capabilities", err)
		return
	}
	defer rows.Close()

	devices := make([]findMyRecoveryDeviceResponse, 0)
	for rows.Next() {
		var response findMyRecoveryDeviceResponse
		if err := rows.Scan(&response.DeviceID, &response.DisplayName, &response.DeviceClass, &response.RevokedAt); err != nil {
			api.internalError(w, r, "find_my_recovery_capabilities_scan", err)
			return
		}
		response.Capabilities = deniedRecoveryCapabilities(response.RevokedAt != nil)
		devices = append(devices, response)
	}
	if err := rows.Err(); err != nil {
		api.internalError(w, r, "find_my_recovery_capabilities_rows", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"devices": devices})
}

func deniedRecoveryCapabilities(revoked bool) recoveryCapabilities {
	reason := "recovery_authority_unavailable"
	if revoked {
		reason = "device_enrollment_revoked"
	}
	denied := recoveryActionCapability{Available: false, Reason: reason}
	return recoveryCapabilities{
		LostMode:  denied,
		PlaySound: denied,
		MarkFound: denied,
	}
}
