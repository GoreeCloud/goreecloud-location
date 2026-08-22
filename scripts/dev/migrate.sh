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

for migration in "$repo_root"/migrations/*.sql; do
  version="$(basename "$migration" .sql)"
  table_exists="$("${compose[@]}" exec -T database psql -U goreecloud_location -d goreecloud_location -Atqc "SELECT to_regclass('public.schema_migrations') IS NOT NULL;")"

  if [[ "$table_exists" == "t" ]]; then
    already_applied="$("${compose[@]}" exec -T database psql -U goreecloud_location -d goreecloud_location -Atqc "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '$version');")"
    if [[ "$already_applied" == "t" ]]; then
      echo "skip $version (already applied)"
      continue
    fi
  fi

  echo "apply $version"
  "${compose[@]}" exec -T database psql -v ON_ERROR_STOP=1 -U goreecloud_location -d goreecloud_location < "$migration"
done
