#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
api_dir="$repo_root/services/api"
tmp_dir="$(mktemp -d)"
api_pid=""

cleanup() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

: "${LOCATION_DATABASE_HOST:=127.0.0.1}"
: "${LOCATION_DATABASE_PORT:=5432}"
: "${LOCATION_DATABASE_NAME:=goreecloud_location}"
: "${LOCATION_DATABASE_USER:=goreecloud_location}"
: "${LOCATION_DATABASE_SSLMODE:=disable}"
: "${LOCATION_API_ADDRESS:=127.0.0.1:18082}"
export LOCATION_DATABASE_HOST LOCATION_DATABASE_PORT LOCATION_DATABASE_NAME LOCATION_DATABASE_USER LOCATION_DATABASE_SSLMODE LOCATION_API_ADDRESS

if [[ -z "${LOCATION_DATABASE_PASSWORD:-}" ]]; then
  echo "LOCATION_DATABASE_PASSWORD is required for tracking integration acceptance" >&2
  exit 1
fi

(
  cd "$api_dir"
  go run ./cmd/location-api
) >"$tmp_dir/api.log" 2>&1 &
api_pid=$!

for _ in $(seq 1 45); do
  if curl --fail --silent "http://$LOCATION_API_ADDRESS/readyz" >/dev/null; then
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    cat "$tmp_dir/api.log" >&2
    exit 1
  fi
  sleep 1
done

if ! curl --fail --silent "http://$LOCATION_API_ADDRESS/readyz" >/dev/null; then
  cat "$tmp_dir/api.log" >&2
  exit 1
fi

create_user() {
  local name="$1"
  (
    cd "$api_dir"
    go run ./cmd/location-admin create-user --display-name "$name" 2>>"$tmp_dir/admin.log"
  )
}

extract_json() {
  local expression="$1"
  python3 -c "import json,sys; value=json.load(sys.stdin); print($expression)"
}

user_a_json="$(create_user 'Tracking User A')"
user_b_json="$(create_user 'Tracking User B')"
user_a_id="$(printf '%s' "$user_a_json" | extract_json "value['user_id']")"
user_b_id="$(printf '%s' "$user_b_json" | extract_json "value['user_id']")"
user_a_token="$(printf '%s' "$user_a_json" | extract_json "value['token']")"
user_b_token="$(printf '%s' "$user_b_json" | extract_json "value['token']")"

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  -H 'Content-Type: application/json' \
  -d '{"display_name":"Tracking A Phone","device_class":"phone"}' \
  "http://$LOCATION_API_ADDRESS/api/v1/devices" >"$tmp_dir/device-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  -H 'Content-Type: application/json' \
  -d '{"display_name":"Tracking B Phone","device_class":"phone"}' \
  "http://$LOCATION_API_ADDRESS/api/v1/devices" >"$tmp_dir/device-b.json"

device_a_id="$(cat "$tmp_dir/device-a.json" | extract_json "value['device']['id']")"
device_b_id="$(cat "$tmp_dir/device-b.json" | extract_json "value['device']['id']")"
device_a_token="$(cat "$tmp_dir/device-a.json" | extract_json "value['credential']")"
device_b_token="$(cat "$tmp_dir/device-b.json" | extract_json "value['credential']")"

captured_a="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat().replace('+00:00', 'Z'))
PY
)"
captured_b="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat().replace('+00:00', 'Z'))
PY
)"

sample_a_payload="$(printf '{"client_sample_id":"tracking-a-001","captured_at":"%s","latitude":29.9511,"longitude":-90.0715,"accuracy_m":4.5,"speed_mps":1.2,"bearing_deg":45,"battery_percent":83}' "$captured_a")"
sample_b_payload="$(printf '{"client_sample_id":"tracking-b-001","captured_at":"%s","latitude":41.8781,"longitude":-87.6298,"accuracy_m":6,"battery_percent":72}' "$captured_b")"

status="$(curl --silent --output "$tmp_dir/user-token-ingest.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $user_a_token" \
  -H 'Content-Type: application/json' \
  -d "$sample_a_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "401" ]] || { echo "user credential was incorrectly accepted for device ingestion" >&2; exit 1; }

status="$(curl --silent --output "$tmp_dir/ingest-a.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  -H 'Content-Type: application/json' \
  -d "$sample_a_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "201" ]] || { cat "$tmp_dir/ingest-a.json" >&2; echo "first device A sample was not created" >&2; exit 1; }

status="$(curl --silent --output "$tmp_dir/ingest-b.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_b_token" \
  -H 'Content-Type: application/json' \
  -d "$sample_b_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "201" ]] || { cat "$tmp_dir/ingest-b.json" >&2; echo "first device B sample was not created" >&2; exit 1; }

location_a_id="$(cat "$tmp_dir/ingest-a.json" | extract_json "value['location']['id']")"
location_b_id="$(cat "$tmp_dir/ingest-b.json" | extract_json "value['location']['id']")"
python3 - "$tmp_dir/ingest-a.json" "$tmp_dir/ingest-b.json" "$device_a_id" "$device_b_id" <<'PY'
import json,sys
a=json.load(open(sys.argv[1]))
b=json.load(open(sys.argv[2]))
assert a['duplicate'] is False and b['duplicate'] is False
assert a['location']['device_id'] == sys.argv[3]
assert b['location']['device_id'] == sys.argv[4]
assert a['location']['source'] == 'native-device'
assert b['location']['source'] == 'native-device'
PY

status="$(curl --silent --output "$tmp_dir/duplicate-a.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  -H 'Content-Type: application/json' \
  -d "$sample_a_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "200" ]] || { cat "$tmp_dir/duplicate-a.json" >&2; echo "idempotent sample retry did not return success" >&2; exit 1; }
python3 - "$tmp_dir/duplicate-a.json" "$location_a_id" <<'PY'
import json,sys
value=json.load(open(sys.argv[1]))
assert value['duplicate'] is True
assert value['location']['id'] == sys.argv[2]
PY

conflict_payload="$(printf '{"client_sample_id":"tracking-a-001","captured_at":"%s","latitude":30.0000,"longitude":-90.0715}' "$captured_a")"
status="$(curl --silent --output "$tmp_dir/conflict-a.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  -H 'Content-Type: application/json' \
  -d "$conflict_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "409" ]] || { echo "conflicting sample retry was not rejected" >&2; exit 1; }

invalid_sample_payload="$(printf '{"client_sample_id":"tracking-a-invalid","captured_at":"%s","latitude":91,"longitude":-90.0715}' "$captured_a")"
status="$(curl --silent --output "$tmp_dir/invalid-sample.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  -H 'Content-Type: application/json' \
  -d "$invalid_sample_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "400" ]] || { echo "invalid coordinate sample was not rejected" >&2; exit 1; }

missing_coordinate_payload="$(printf '{"client_sample_id":"tracking-a-missing-coordinate","captured_at":"%s","longitude":-90.0715}' "$captured_a")"
status="$(curl --silent --output "$tmp_dir/missing-coordinate.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  -H 'Content-Type: application/json' \
  -d "$missing_coordinate_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "400" ]] || { echo "missing coordinate sample was not rejected" >&2; exit 1; }

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations?limit=10" >"$tmp_dir/history-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations?limit=10" >"$tmp_dir/history-b.json"
python3 - "$tmp_dir/history-a.json" "$tmp_dir/history-b.json" "$location_a_id" "$location_b_id" <<'PY'
import json,sys
a={item['id'] for item in json.load(open(sys.argv[1]))['locations']}
b={item['id'] for item in json.load(open(sys.argv[2]))['locations']}
assert sys.argv[3] in a and sys.argv[4] not in a
assert sys.argv[4] in b and sys.argv[3] not in b
PY

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations?device_id=$device_b_id" >"$tmp_dir/cross-device-filter.json"
python3 - "$tmp_dir/cross-device-filter.json" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['locations'] == []
PY

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/live" >"$tmp_dir/live-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/live" >"$tmp_dir/live-b.json"
python3 - "$tmp_dir/live-a.json" "$tmp_dir/live-b.json" "$device_a_id" "$device_b_id" "$location_a_id" "$location_b_id" <<'PY'
import json,sys
a=json.load(open(sys.argv[1]))['devices']
b=json.load(open(sys.argv[2]))['devices']
assert any(item['device']['id'] == sys.argv[3] and item['location']['id'] == sys.argv[5] for item in a)
assert all(item['device']['id'] != sys.argv[4] for item in a)
assert any(item['device']['id'] == sys.argv[4] and item['location']['id'] == sys.argv[6] for item in b)
assert all(item['device']['id'] != sys.argv[3] for item in b)
PY

status="$(curl --silent --output "$tmp_dir/invalid-history.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations?limit=501")"
[[ "$status" == "400" ]] || { echo "invalid history query was not rejected" >&2; exit 1; }

curl --fail --silent \
  -X PUT \
  -H "Authorization: Bearer $user_a_token" \
  -H 'Content-Type: application/json' \
  -d '{"time_zone":"UTC","distance_unit":"metric","tracking_paused":true}' \
  "http://$LOCATION_API_ADDRESS/api/v1/preferences" >"$tmp_dir/pause-a.json"

paused_payload="$(printf '{"client_sample_id":"tracking-a-paused","captured_at":"%s","latitude":29.9512,"longitude":-90.0716}' "$captured_b")"
status="$(curl --silent --output "$tmp_dir/paused-ingest.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  -H 'Content-Type: application/json' \
  -d "$paused_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "409" ]] || { echo "tracking pause did not block ingestion" >&2; exit 1; }

curl --fail --silent \
  -X PUT \
  -H "Authorization: Bearer $user_a_token" \
  -H 'Content-Type: application/json' \
  -d '{"time_zone":"UTC","distance_unit":"metric","tracking_paused":false}' \
  "http://$LOCATION_API_ADDRESS/api/v1/preferences" >/dev/null

status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -X DELETE \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/devices/$device_a_id")"
[[ "$status" == "204" ]] || { echo "device A revocation failed" >&2; exit 1; }

revoked_payload="$(printf '{"client_sample_id":"tracking-a-revoked","captured_at":"%s","latitude":29.9513,"longitude":-90.0717}' "$captured_b")"
status="$(curl --silent --output "$tmp_dir/revoked-ingest.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  -H 'Content-Type: application/json' \
  -d "$revoked_payload" \
  "http://$LOCATION_API_ADDRESS/api/v1/locations")"
[[ "$status" == "401" ]] || { echo "revoked device credential remained able to ingest" >&2; exit 1; }

for sensitive in "$user_a_token" "$user_b_token" "$device_a_token" "$device_b_token" "29.9511" "-90.0715" "41.8781" "-87.6298"; do
  if grep -F -- "$sensitive" "$tmp_dir/api.log" >/dev/null; then
    echo "ordinary API log contains sensitive tracking/authentication data" >&2
    exit 1
  fi
done

printf 'native tracking API acceptance passed\n'
