#!/usr/bin/env bash
# Root-owned entry point; run via sudo from ubuntu or an optional deploy account.
set -Eeuo pipefail
umask 077
BASE=/var/lib/ai-kreator
RELEASES=$BASE/releases
SOURCE=/opt/ai-kreator-source/vps
WEBROOT=/var/www/ai-kreator.pl
SEO_CONF=/etc/apache2/ai-kreator-seo-routes.conf
HELPER=/usr/local/lib/ai-kreator/release_tool.py
DB_BACKUP=/usr/local/sbin/ai-kreator-daily-db-backup
WORK="" BACKUP="" CANDIDATE=""
REBUILD=0 FRONTEND_ONLY=0

log() { printf '[ai-kreator-deploy] %s\n' "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }
[[ $EUID == 0 ]] || fail 'Run through sudo.'
install -d -m 700 "$BASE" "$RELEASES" "$BASE/work"
exec 9>/run/ai-kreator-deploy.lock
flock -n 9 || fail 'Another deployment or maintenance task is running.'
for path in "$SOURCE/server" "$WEBROOT" "$RELEASES"; do
  [[ -d "$path" && "$(readlink -f -- "$path")" == "$path" ]] || fail "Unexpected target path: $path"
done
compose() { (cd "$SOURCE" && docker compose "$@"); }
check_http() { curl -fsS --connect-timeout 5 --max-time 20 "$1" >/dev/null; }
wait_api() {
  for _ in $(seq 1 45); do
    if check_http http://127.0.0.1:3101/health && check_http 'http://127.0.0.1:3101/public/ai-models?purpose=editing'; then return 0; fi
    sleep 2
  done
  return 1
}
restore_release() {
  local backup=$1 old_image restore
  [[ "$(dirname -- "$backup")" == "$RELEASES" && ! -L "$backup" && -f "$backup/old-image" ]] || return 1
  old_image=$(cat "$backup/old-image")
  [[ "$old_image" =~ ^sha256:[a-f0-9]{64}$ ]] || return 1
  log "Restoring application from $(basename "$backup"); database data is left in place."
  if [[ -f "$backup/applied-source" ]]; then
    restore=$(mktemp -d "$BASE/work/restore.XXXXXX")
    tar -xzf "$backup/server.tgz" -C "$restore" || return 1
    rsync -r --delete --exclude=node_modules --exclude=dist --exclude='.env*' "$restore/server/" "$SOURCE/server/" || return 1
    rm -rf -- "$restore"
  fi
  if [[ -f "$backup/applied-api" ]]; then
    docker tag "$old_image" vps-api || return 1
    compose up -d --no-deps --no-build --force-recreate api || return 1
    wait_api || return 1
  fi
  if [[ -f "$backup/applied-web" ]]; then
    rsync -r --chown=root:www-data --chmod=D755,F644 "$backup/webroot/" "$WEBROOT/" || return 1
    install -m 644 -o root -g www-data "$backup/index.html" "$WEBROOT/.index-rollback.new" || return 1
    mv -f "$WEBROOT/.index-rollback.new" "$WEBROOT/index.html" || return 1
    if [[ -f "$backup/deployment-check.json" ]]; then install -m 644 -o root -g www-data "$backup/deployment-check.json" "$WEBROOT/deployment-check.json" || return 1; fi
  fi
  if [[ -f "$backup/applied-apache" ]]; then
    install -m 644 -o root -g root "$backup/seo-routes.conf" "$SEO_CONF" || return 1
    apache2ctl configtest && systemctl reload apache2 || return 1
  fi
  check_http https://ai-kreator.pl/ && check_http https://ai-kreator.pl/api/health || return 1
  printf 'rolled-back\n' > "$backup/status"
}
cleanup() {
  local status=$?
  trap - EXIT
  [[ -z "$CANDIDATE" ]] || docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  if (( status != 0 )) && [[ -n "$BACKUP" && -f "$BACKUP/old-image" ]]; then
    if ! restore_release "$BACKUP"; then log "ROLLBACK NEEDS ATTENTION: $BACKUP" >&2; fi
  fi
  if [[ -n "$WORK" && "$(dirname -- "$WORK")" == "$BASE/work" && ! -L "$WORK" ]]; then rm -rf -- "$WORK"; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ "${1:-}" == --rollback ]]; then
  [[ $# == 2 && "$2" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}\.[A-Za-z0-9]{6}$ ]] || fail 'Provide the exact release directory name.'
  restore_release "$RELEASES/$2"
  log 'Rollback verified.'
  exit 0
fi
SHA=${1:-}
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || fail 'Provide a full 40-character commit SHA.'
shift
for option in "$@"; do
  case "$option" in --rebuild-api) REBUILD=1;; --frontend-only) FRONTEND_ONLY=1;; *) fail "Unknown option: $option";; esac
done
(( ! REBUILD || ! FRONTEND_ONLY )) || fail 'Choose frontend-only or an API rebuild.'
INCOMING=""
for directory in /home/ubuntu/ai-kreator-incoming /home/deploy/incoming; do
  if [[ -f "$directory/$SHA.tar.gz" ]]; then INCOMING=$directory; break; fi
done
[[ -n "$INCOMING" && ! -L "$INCOMING" && "$(readlink -f "$INCOMING")" == "$INCOMING" && "$(stat -c %a "$INCOMING")" == 700 ]] || fail 'Inbox must be a real private directory (0700).'
for file in "$SHA.tar.gz" "$SHA.tar.gz.sha256"; do
  [[ -f "$INCOMING/$file" && ! -L "$INCOMING/$file" && "$(stat -c %a "$INCOMING/$file")" == 600 ]] || fail "Package must be a regular file with mode 0600: $file"
done
WORK=$(mktemp -d "$BASE/work/deploy.XXXXXX")
install -m 600 "$INCOMING/$SHA.tar.gz" "$WORK/$SHA.tar.gz"
install -m 600 "$INCOMING/$SHA.tar.gz.sha256" "$WORK/$SHA.tar.gz.sha256"
mkdir "$WORK/package"
python3 "$HELPER" extract "$WORK/$SHA.tar.gz" "$WORK/$SHA.tar.gz.sha256" "$WORK/package" "$SHA"
PACKAGE=$WORK/package
cmp -s "$PACKAGE/vps/docker-compose.yml" "$SOURCE/docker-compose.yml" || fail 'Ordinary releases cannot change Compose. Review stack changes separately.'
compose config --format json | python3 "$HELPER" compose
API_CHANGED=$REBUILD
if (( ! FRONTEND_ONLY )) && ! diff -rq --exclude=node_modules --exclude=dist --exclude='.env*' "$PACKAGE/vps/server" "$SOURCE/server" >/dev/null; then API_CHANGED=1; fi
(( ! FRONTEND_ONLY )) || API_CHANGED=0
BACKUP=$(mktemp -d "$RELEASES/$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}.XXXXXX")
RELEASE=$(basename "$BACKUP")
mkdir "$BACKUP/webroot"
printf '%s\n' "$SHA" > "$BACKUP/commit"
docker inspect kreator-ai-api --format '{{.Image}}' > "$BACKUP/old-image"
docker tag "$(cat "$BACKUP/old-image")" "ai-kreator-api:rollback-$RELEASE"
cp -a "$WEBROOT/index.html" "$BACKUP/index.html"
[[ ! -f "$WEBROOT/deployment-check.json" ]] || cp -a "$WEBROOT/deployment-check.json" "$BACKUP/deployment-check.json"
cp -a "$SEO_CONF" "$BACKUP/seo-routes.conf"
tar -czf "$BACKUP/server.tgz" --exclude=server/node_modules --exclude=server/dist --exclude='server/.env*' -C "$SOURCE" server
chmod -R go-rwx "$BACKUP"
log "Recovery copy: $BACKUP"
if (( API_CHANGED )); then
  [[ -x "$DB_BACKUP" ]] || fail 'Verified database backup tool is missing.'
  BACKUP_DIR="$BACKUP/database" KEEP_BACKUPS=1 "$DB_BACKUP"
  IMAGE="ai-kreator-api:release-$RELEASE"
  log 'Building the exact packaged API with a fresh base image.'
  docker build --pull --label "ai-kreator.commit=$SHA" -t "$IMAGE" "$PACKAGE/vps/server"
  docker run --rm --network none --memory 768m --cpus 2 --mount "type=bind,src=$PACKAGE/vps/server/test,dst=/app/test,readonly" "$IMAGE" sh -ec 'node --test test/*.test.mjs'
  # createApp avoids startup migrations and scheduled jobs during the read-only
  # candidate checks. No paid AI calls or user writes happen here.
  CANDIDATE="kreator-ai-candidate-$RELEASE"
  docker run -d --name "$CANDIDATE" --network vps_default --env-file "$SOURCE/.env" --memory 768m --cpus 2 "$IMAGE" node --input-type=module -e 'import {createApp} from "./dist/app.js"; createApp().listen(3000);' >/dev/null
  READY=0
  for _ in $(seq 1 30); do
    if docker exec "$CANDIDATE" node -e 'Promise.all(["/health","/public/ai-models?purpose=editing"].map(async p=>{const r=await fetch("http://127.0.0.1:3000"+p);if(!r.ok)throw Error("health failed");const d=await r.json();if(p!=="/health"&&!Array.isArray(d.models))throw Error("database unavailable");})).catch(()=>process.exit(1))' >/dev/null 2>&1; then READY=1; break; fi
    sleep 2
  done
  (( READY )) || fail 'Candidate failed its health or database read check.'
  docker rm -f "$CANDIDATE" >/dev/null
  CANDIDATE=""
  touch "$BACKUP/applied-source"
  rsync -r --delete --exclude=node_modules --exclude=dist --exclude='.env*' --chown=root:root --chmod=D755,F644 "$PACKAGE/vps/server/" "$SOURCE/server/"
  touch "$BACKUP/applied-api"
  docker tag "$IMAGE" vps-api
  compose up -d --no-deps --no-build api
  wait_api || fail 'New production API did not become ready.'
fi
# Back up overwritten files, retain older hashed assets, switch index last.
touch "$BACKUP/applied-web"
rsync -r --checksum --backup --backup-dir="$BACKUP/webroot" --exclude=index.html --chown=root:www-data --chmod=D755,F644 "$PACKAGE/dist/" "$WEBROOT/"
if ! cmp -s "$PACKAGE/vps/apache/seo-routes.conf" "$SEO_CONF"; then
  touch "$BACKUP/applied-apache"
  install -m 644 -o root -g root "$PACKAGE/vps/apache/seo-routes.conf" "$SEO_CONF"
  apache2ctl configtest
  systemctl reload apache2
fi
install -m 644 -o root -g www-data "$PACKAGE/dist/index.html" "$WEBROOT/.index-release.new"
mv -f "$WEBROOT/.index-release.new" "$WEBROOT/index.html"
for url in https://ai-kreator.pl/ https://ai-kreator.pl/api/health 'https://ai-kreator.pl/api/public/ai-models?purpose=editing' https://ai-kreator.pl/tools/widgets; do
  check_http "$url" || fail "Public check failed: $url"
done
python3 - "$SHA" "$RELEASE" "$WEBROOT/.deployment-check.new" <<'PY'
import datetime, json, sys
commit, release, target = sys.argv[1:]
with open(target, 'w') as output:
    json.dump({'commit': commit, 'release': release, 'status': 'verified', 'deployedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}, output)
PY
chown root:www-data "$WEBROOT/.deployment-check.new"
chmod 644 "$WEBROOT/.deployment-check.new"
mv -f "$WEBROOT/.deployment-check.new" "$WEBROOT/deployment-check.json"
printf 'verified\n' > "$BACKUP/status"
printf '%s\n' "$RELEASE" > "$BASE/current-release"
# Exact files from this operation only. No wildcard removal or global image prune.
rm -f -- "$INCOMING/$SHA.tar.gz" "$INCOMING/$SHA.tar.gz.sha256"
log "Verified release: $SHA; rollback: sudo /usr/local/sbin/ai-kreator-deploy --rollback $RELEASE"
