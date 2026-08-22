#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="$repo_root/deploy/compose.development.yml"
env_file="$repo_root/.env"

if [[ ! -f "$env_file" ]]; then
  echo "missing $env_file; run scripts/dev/database-up.sh first" >&2
  exit 1
fi

compose=(docker compose --env-file "$env_file" -f "$compose_file")
"${compose[@]}" exec -T database psql -v ON_ERROR_STOP=1 -U goreecloud_location -d goreecloud_location < "$repo_root/tests/integration/database.sql"
