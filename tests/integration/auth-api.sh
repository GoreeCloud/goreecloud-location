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
: "${LOCATION_API_ADDRESS:=127.0.0.1:18080}"
export LOCATION_DATABASE_HOST LOCATION_DATABASE_PORT LOCATION_DATABASE_NAME LOCATION_DATABASE_USER LOCATION_DATABASE_SSLMODE LOCATION_API_ADDRESS

if [[ -z "${LOCATION_DATABASE_PASSWORD:-}" ]]; then
  echo "LOCATION_DATABASE_PASSWORD is required for integration acceptance" >&2
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

user_a_json="$(create_user 'Integration User A')"
user_b_json="$(create_user 'Integration User B')"
user_a_id="$(printf '%s' "$user_a_json" | extract_json "value['user_id']")"
user_b_id="$(printf '%s' "$user_b_json" | extract_json "value['user_id']")"
user_a_token="$(printf '%s' "$user_a_json" | extract_json "value['token']")"
user_b_token="$(printf '%s' "$user_b_json" | extract_json "value['token']")"

if [[ "$user_a_id" == "$user_b_id" ]]; then
  echo "independent users received the same id" >&2
  exit 1
fi

status="$(curl --silent --output "$tmp_dir/unauthorized.json" --write-out '%{http_code}' \
  -H 'Authorization: Bearer loc_usr_invalid' \
  "http://$LOCATION_API_ADDRESS/api/v1/me")"
[[ "$status" == "401" ]] || { echo "invalid token was not rejected" >&2; exit 1; }

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/me" >"$tmp_dir/me-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/me" >"$tmp_dir/me-b.json"
python3 - "$tmp_dir/me-a.json" "$tmp_dir/me-b.json" "$user_a_id" "$user_b_id" <<'PY'
import json,sys
me_a=json.load(open(sys.argv[1]))
me_b=json.load(open(sys.argv[2]))
assert me_a['id']==sys.argv[3]
assert me_b['id']==sys.argv[4]
assert me_a['id'] != me_b['id']
PY

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  -H 'Content-Type: application/json' \
  -d '{"display_name":"User A Phone","device_class":"phone"}' \
  "http://$LOCATION_API_ADDRESS/api/v1/devices" >"$tmp_dir/device-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  -H 'Content-Type: application/json' \
  -d '{"display_name":"User B Phone","device_class":"phone"}' \
  "http://$LOCATION_API_ADDRESS/api/v1/devices" >"$tmp_dir/device-b.json"

device_a_id="$(cat "$tmp_dir/device-a.json" | extract_json "value['device']['id']")"
device_b_id="$(cat "$tmp_dir/device-b.json" | extract_json "value['device']['id']")"
device_a_token="$(cat "$tmp_dir/device-a.json" | extract_json "value['credential']")"

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/devices" >"$tmp_dir/devices-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/devices" >"$tmp_dir/devices-b.json"
python3 - "$tmp_dir/devices-a.json" "$tmp_dir/devices-b.json" "$device_a_id" "$device_b_id" <<'PY'
import json,sys
a={d['id'] for d in json.load(open(sys.argv[1]))['devices']}
b={d['id'] for d in json.load(open(sys.argv[2]))['devices']}
assert sys.argv[3] in a and sys.argv[4] not in a
assert sys.argv[4] in b and sys.argv[3] not in b
PY

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/find-my/recovery-capabilities" >"$tmp_dir/recovery-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/find-my/recovery-capabilities" >"$tmp_dir/recovery-b.json"
python3 - "$tmp_dir/recovery-a.json" "$tmp_dir/recovery-b.json" "$device_a_id" "$device_b_id" <<'PY'
import json,sys
a=json.load(open(sys.argv[1]))['devices']
b=json.load(open(sys.argv[2]))['devices']
assert {d['device_id'] for d in a} == {sys.argv[3]}
assert {d['device_id'] for d in b} == {sys.argv[4]}
for device in a+b:
    assert set(device['capabilities']) == {'lost_mode','play_sound','mark_found'}
    for capability in device['capabilities'].values():
        assert capability == {'available': False, 'reason': 'recovery_authority_unavailable'}
PY

curl --fail --silent \
  -H "Authorization: Bearer $device_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/device" >"$tmp_dir/device-auth.json"
python3 - "$tmp_dir/device-auth.json" "$user_a_id" "$device_a_id" <<'PY'
import json,sys
value=json.load(open(sys.argv[1]))
assert value['user_id']==sys.argv[2]
assert value['device']['id']==sys.argv[3]
PY

status="$(curl --silent --output "$tmp_dir/cross-revoke.json" --write-out '%{http_code}' \
  -X DELETE \
  -H "Authorization: Bearer $user_b_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/devices/$device_a_id")"
[[ "$status" == "404" ]] || { echo "cross-user device revocation was not hidden/rejected" >&2; exit 1; }

curl --fail --silent \
  -X PUT \
  -H "Authorization: Bearer $user_a_token" \
  -H 'Content-Type: application/json' \
  -d '{"time_zone":"America/Chicago","distance_unit":"imperial","tracking_paused":true}' \
  "http://$LOCATION_API_ADDRESS/api/v1/preferences" >"$tmp_dir/preferences-a.json"
curl --fail --silent \
  -H "Authorization: Bearer $user_b_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/preferences" >"$tmp_dir/preferences-b.json"
python3 - "$tmp_dir/preferences-a.json" "$tmp_dir/preferences-b.json" <<'PY'
import json,sys
a=json.load(open(sys.argv[1]))
b=json.load(open(sys.argv[2]))
assert a == {'time_zone':'America/Chicago','distance_unit':'imperial','tracking_paused':True}
assert b == {'time_zone':'UTC','distance_unit':'metric','tracking_paused':False}
PY

status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -X DELETE \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/devices/$device_a_id")"
[[ "$status" == "204" ]] || { echo "owner could not revoke device" >&2; exit 1; }

curl --fail --silent \
  -H "Authorization: Bearer $user_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/find-my/recovery-capabilities" >"$tmp_dir/recovery-a-revoked.json"
python3 - "$tmp_dir/recovery-a-revoked.json" "$device_a_id" <<'PY'
import json,sys
devices=json.load(open(sys.argv[1]))['devices']
assert len(devices) == 1 and devices[0]['device_id'] == sys.argv[2]
assert devices[0].get('revoked_at')
for capability in devices[0]['capabilities'].values():
    assert capability == {'available': False, 'reason': 'device_enrollment_revoked'}
PY

status="$(curl --silent --output "$tmp_dir/revoked-device.json" --write-out '%{http_code}' \
  -H "Authorization: Bearer $device_a_token" \
  "http://$LOCATION_API_ADDRESS/api/v1/device")"
[[ "$status" == "401" ]] || { echo "revoked device credential remained usable" >&2; exit 1; }

printf 'authenticated multi-user API acceptance passed\n'
