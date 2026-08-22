#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="$repo_root/deploy/compose.development.yml"
env_file="$repo_root/.env"

if [[ ! -f "$env_file" ]]; then
  echo "nothing to stop: $env_file does not exist"
  exit 0
fi

docker compose --env-file "$env_file" -f "$compose_file" down
