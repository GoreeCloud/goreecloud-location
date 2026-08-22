#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="$repo_root/deploy/compose.development.yml"
env_file="$repo_root/.env"
example_file="$repo_root/.env.example"
secret_dir="$repo_root/.secrets"
secret_file="$secret_dir/postgres-password"

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required to generate the local development secret" >&2; exit 1; }

umask 077
mkdir -p "$secret_dir"

if [[ ! -f "$secret_file" ]]; then
  openssl rand -hex 32 > "$secret_file"
  chmod 600 "$secret_file"
fi

if [[ ! -f "$env_file" ]]; then
  cp "$example_file" "$env_file"
  chmod 600 "$env_file"
fi

compose=(docker compose --env-file "$env_file" -f "$compose_file")

"${compose[@]}" config --quiet
"${compose[@]}" up -d database

ready=0
for _ in $(seq 1 30); do
  if "${compose[@]}" exec -T database pg_isready -U goreecloud_location -d goreecloud_location >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" -ne 1 ]]; then
  echo "development PostGIS did not become ready" >&2
  exit 1
fi

"$repo_root/scripts/dev/migrate.sh"
"$repo_root/scripts/dev/verify-database.sh"

echo "GoreeCloud Location development PostGIS is ready."
