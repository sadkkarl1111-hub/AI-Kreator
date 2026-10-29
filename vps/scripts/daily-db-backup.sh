#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-kreator/daily-db}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-kreator-ai-postgres}"
RETENTION_HELPER="${RETENTION_HELPER:-/usr/local/lib/ai-kreator/db_backup_retention.py}"
KEEP_BACKUPS="${KEEP_BACKUPS:-14}"
[[ "$BACKUP_DIR" = /* && "$BACKUP_DIR" != / && ! -L "$BACKUP_DIR" ]]
mkdir -p "$BACKUP_DIR"
[[ "$(readlink -f -- "$BACKUP_DIR")" == "$BACKUP_DIR" ]]
chmod 700 "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then echo '[db-backup] another copy is running'; exit 0; fi
[[ "$KEEP_BACKUPS" =~ ^[1-9][0-9]*$ ]]
scope=$(printf '%s' "$BACKUP_DIR" | sha256sum | awk '{print $1}')
# With this folder's lock held, matching verification containers can only be orphans.
while IFS= read -r orphan; do
  [[ -z "$orphan" ]] || docker rm -fv "$orphan" >/dev/null
done < <(docker ps -aq --filter label=ai-kreator.daily-db-check=true --filter "label=ai-kreator.daily-db-scope=$scope")

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
filename="kreator-ai-db-${timestamp}.dump"
final="$BACKUP_DIR/$filename"
[[ ! -e "$final" && ! -e "$final.json" && ! -e "$final.sha256" ]]
partial=""
metadata=""
checksum=""
verifier=""
published=0
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "$verifier" ]]; then docker rm -fv "$verifier" >/dev/null 2>&1 || true; fi
  for path in "$partial" "$metadata" "$checksum"; do
    if [[ -n "$path" && "$(dirname -- "$path")" == "$BACKUP_DIR" ]]; then rm -f -- "$path"; fi
  done
  if [[ "$published" == 0 ]]; then
    rm -f -- "$final.sha256" "$final.json"
  fi
  if (( status != 0 )); then echo '[db-backup] FAILED; previous backups retained' >&2; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

ready=0
for i in $(seq 1 45); do
  if docker exec "$POSTGRES_CONTAINER" sh -ec 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]]
db_bytes=$(docker exec "$POSTGRES_CONTAINER" sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_database_size(current_database());"')
[[ "$db_bytes" =~ ^[0-9]+$ ]]
available_kb=$(df -Pk -- "$BACKUP_DIR" | awk 'NR==2 {print $4}')
[[ "$available_kb" =~ ^[0-9]+$ ]]
# Reserve space for both the compressed dump and the isolated restoration database.
(( available_kb * 1024 > db_bytes * 3 + 536870912 ))
partial=$(mktemp "$BACKUP_DIR/.${filename}.XXXXXX.tmp")
echo '[db-backup] creating PostgreSQL snapshot'
timeout --kill-after=15s 600 docker exec "$POSTGRES_CONTAINER" sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6 --lock-wait-timeout=30000' > "$partial"
[[ -s "$partial" ]]
docker exec -i "$POSTGRES_CONTAINER" pg_restore --list < "$partial" >/dev/null

echo '[db-backup] verifying restoration in isolated PostgreSQL'
image=$(docker inspect -f '{{.Image}}' "$POSTGRES_CONTAINER")
password=$(openssl rand -hex 24)
verifier=$(docker create --name "kreator-ai-daily-db-check-${timestamp}-$$" --label ai-kreator.daily-db-check=true --label "ai-kreator.daily-db-scope=$scope" --network none --memory 256m --cpus 1 -e POSTGRES_PASSWORD="$password" "$image")
unset password
docker start "$verifier" >/dev/null
ready=0
for i in $(seq 1 45); do
  if docker exec "$verifier" sh -ec '[ "$(cat /proc/1/comm)" = postgres ] && pg_isready -U postgres' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]]
docker cp "$partial" "$verifier":/tmp/backup.dump
docker exec "$verifier" sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore --no-owner --no-acl --exit-on-error -U postgres -d postgres /tmp/backup.dump'
tables=$(docker exec "$verifier" sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -U postgres -d postgres -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='\''public'\'';"')
[[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]]
docker rm -fv "$verifier" >/dev/null
verifier=""

digest=$(sha256sum -- "$partial" | awk '{print $1}')
bytes=$(stat -c %s -- "$partial")
metadata=$(mktemp "$BACKUP_DIR/.${filename}.metadata.XXXXXX.tmp")
checksum=$(mktemp "$BACKUP_DIR/.${filename}.checksum.XXXXXX.tmp")
python3 - "$metadata" "$filename" "$digest" "$bytes" "$tables" <<'PY'
import datetime, json, sys
target, name, digest, size, tables = sys.argv[1:]
with open(target, "w", encoding="utf-8") as output:
    json.dump({"dump": name, "sha256": digest, "bytes": int(size), "tables": int(tables), "status": "restore_verified", "verified_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, output)
    output.write("\n")
PY
printf '%s  %s\n' "$digest" "$filename" > "$checksum"
sync -f "$partial"
mv -- "$metadata" "$final.json"; metadata=""
mv -- "$checksum" "$final.sha256"; checksum=""
mv -- "$partial" "$final"; partial=""; published=1
python3 "$RETENTION_HELPER" "$BACKUP_DIR" "$filename" --keep "$KEEP_BACKUPS"
echo "[db-backup] success: $filename ($bytes bytes, $tables restored tables); keeping $KEEP_BACKUPS verified copies"
