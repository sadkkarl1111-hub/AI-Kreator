#!/usr/bin/env bash
# Monthly patch updates of the existing PostgreSQL 16 and Redis 7 services only.
set -Eeuo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run through sudo.' >&2; exit 1; }
SOURCE=/opt/ai-kreator-source/vps
ROOT=/var/backups/ai-kreator/maintenance
install -d -m 700 "$ROOT"
exec 9>/run/ai-kreator-deploy.lock
flock -n 9 || { echo 'Deployment or maintenance already running.' >&2; exit 1; }
cd "$SOURCE"
docker compose config --format json | python3 /usr/local/lib/ai-kreator/release_tool.py compose
BACKUP=$(mktemp -d "$ROOT/$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")
OLD_POSTGRES=$(docker inspect kreator-ai-postgres --format '{{.Image}}')
OLD_REDIS=$(docker inspect kreator-ai-redis --format '{{.Image}}')
docker tag "$OLD_POSTGRES" "ai-kreator-postgres:before-$(basename "$BACKUP")"
docker tag "$OLD_REDIS" "ai-kreator-redis:before-$(basename "$BACKUP")"
printf '%s\n%s\n' "$OLD_POSTGRES" "$OLD_REDIS" > "$BACKUP/images"
CHANGED=0
ready() {
  for _ in $(seq 1 45); do
    if docker exec kreator-ai-postgres sh -ec 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 \
      && [[ "$(docker exec kreator-ai-redis redis-cli ping 2>/dev/null)" == PONG ]] \
      && curl -fsS --max-time 10 'http://127.0.0.1:3101/public/ai-models?purpose=editing' >/dev/null; then return 0; fi
    sleep 2
  done
  return 1
}
cleanup() {
  local status=$?
  trap - EXIT
  if (( status != 0 && CHANGED )); then
    echo 'Restoring previous PostgreSQL and Redis images; original volumes stay in place.' >&2
    docker tag "$OLD_POSTGRES" postgres:16-alpine
    docker tag "$OLD_REDIS" redis:7-alpine
    docker compose up -d --no-deps --no-build postgres redis
    ready || echo 'Maintenance recovery needs attention.' >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
BACKUP_DIR="$BACKUP/database" KEEP_BACKUPS=1 /usr/local/sbin/ai-kreator-daily-db-backup
docker compose pull postgres redis
if [[ "$(docker image inspect postgres:16-alpine --format '{{.Id}}')" != "$OLD_POSTGRES" || "$(docker image inspect redis:7-alpine --format '{{.Id}}')" != "$OLD_REDIS" ]]; then
  CHANGED=1
  docker compose up -d --no-deps --no-build postgres redis
fi
ready
curl -fsS --max-time 20 https://ai-kreator.pl/api/health >/dev/null
printf 'verified\n' > "$BACKUP/status"
echo "Monthly PostgreSQL/Redis patches verified; recovery copy: $BACKUP"
