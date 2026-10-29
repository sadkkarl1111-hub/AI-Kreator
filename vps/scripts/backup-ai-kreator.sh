#!/usr/bin/env sh
set -eu
umask 077

BACKUP_DIR="${BACKUP_DIR:-/opt/ai-kreator-backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-kreator-ai-postgres}"
API_CONTAINER="${API_CONTAINER:-kreator-ai-api}"
POSTGRES_DB="${POSTGRES_DB:-kreator_ai}"
POSTGRES_USER="${POSTGRES_USER:-app_user}"
WEB_ROOT="${WEB_ROOT:-/var/www/ai-kreator.pl}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$RUN_DIR"
chmod 700 "$BACKUP_DIR" "$RUN_DIR"

echo "[backup] writing to $RUN_DIR"

DB_DUMP="$RUN_DIR/postgres.dump"
POSTGRES_PASSWORD="$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_PASSWORD)"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$DB_DUMP"

if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
    -pass "pass:$BACKUP_ENCRYPTION_PASSPHRASE" \
    -in "$DB_DUMP" \
    -out "$DB_DUMP.enc"
  rm -f "$DB_DUMP"
  DB_DUMP="$DB_DUMP.enc"
fi

if [ -d "$WEB_ROOT" ]; then
  tar -czf "$RUN_DIR/webroot.tar.gz" -C "$WEB_ROOT" .
fi

if docker exec "$API_CONTAINER" sh -lc "test -d /app/storage" >/dev/null 2>&1; then
  docker exec "$API_CONTAINER" sh -lc "tar -czf - -C /app/storage ." > "$RUN_DIR/api-storage.tar.gz" || true
fi

sha256sum "$RUN_DIR"/* > "$RUN_DIR/SHA256SUMS"

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} \;

echo "[backup] done: $RUN_DIR"
