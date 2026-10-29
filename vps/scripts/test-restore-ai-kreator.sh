#!/usr/bin/env sh
set -eu

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-kreator-ai-postgres}"
POSTGRES_USER="${POSTGRES_USER:-app_user}"
RESTORE_DB="${RESTORE_DB:-kreator_ai_restore_test}"
BACKUP_PATH="${1:-}"

if [ -z "$BACKUP_PATH" ]; then
  BACKUP_ROOT="${BACKUP_DIR:-/opt/ai-kreator-backups}"
  BACKUP_PATH="$(find "$BACKUP_ROOT" \( -name 'postgres.dump' -o -name 'postgres.dump.enc' \) | sort | tail -n 1)"
fi

if [ -z "$BACKUP_PATH" ] || [ ! -f "$BACKUP_PATH" ]; then
  echo "[restore-test] backup dump not found" >&2
  exit 1
fi

TMP_DUMP="/tmp/ai-kreator-restore-test.dump"
rm -f "$TMP_DUMP"

case "$BACKUP_PATH" in
  *.enc)
    if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
      echo "[restore-test] BACKUP_ENCRYPTION_PASSPHRASE is required for encrypted backups" >&2
      exit 1
    fi
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
      -pass "pass:$BACKUP_ENCRYPTION_PASSPHRASE" \
      -in "$BACKUP_PATH" \
      -out "$TMP_DUMP"
    ;;
  *)
    cp "$BACKUP_PATH" "$TMP_DUMP"
    ;;
esac

echo "[restore-test] restoring $BACKUP_PATH into temporary database $RESTORE_DB"

POSTGRES_PASSWORD="$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_PASSWORD)"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  dropdb -h 127.0.0.1 -U "$POSTGRES_USER" --if-exists "$RESTORE_DB"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  createdb -h 127.0.0.1 -U "$POSTGRES_USER" "$RESTORE_DB"
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$RESTORE_DB" < "$TMP_DUMP"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$RESTORE_DB" -c "SELECT COUNT(*) AS auth_users FROM auth_users;"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$POSTGRES_CONTAINER" \
  dropdb -h 127.0.0.1 -U "$POSTGRES_USER" "$RESTORE_DB"

rm -f "$TMP_DUMP"

echo "[restore-test] ok"
