#!/usr/bin/env bash
# Wdrożenie AI Kreatora z paczki przysłanej przez GitHub Actions.
# Instalowany jako /usr/local/sbin/ai-kreator-deploy (root:root, 0750).
# Użytkownik `deploy` może go uruchomić tylko przez: sudo /usr/local/sbin/ai-kreator-deploy <sha>
#
# Kolejność zgodna z vps/README.md (SEO):
#   1. stare pliki z hashem zostają, nowe zasoby i _seo/ trafiają na serwer przed przełączeniem strony,
#   2. reguły SEO Apache są podmieniane tylko po udanym `apache2ctl configtest`,
#   3. index.html jest podmieniany na końcu, atomowo,
#   4. backend jest przebudowywany tylko, gdy zmienił się jego kod; po starcie sprawdzany jest /health.

set -euo pipefail
umask 022

SHA="${1:-}"
INCOMING=/home/deploy/incoming
WEBROOT=/var/www/ai-kreator.pl
SOURCE=/opt/ai-kreator-source
SEO_CONF=/etc/apache2/ai-kreator-seo-routes.conf
RELEASES=/var/lib/ai-kreator/releases
HEALTH_URL=http://127.0.0.1:3101/health
KEEP_BACKUPS=15

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() { log "BŁĄD: $*"; exit 1; }

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "Podaj pełny identyfikator commita (40 znaków)."
ARCHIVE="$INCOMING/$SHA.tar.gz"
[[ -f "$ARCHIVE" ]] || fail "Brak paczki $ARCHIVE"

exec 9>/run/ai-kreator-deploy.lock
flock -n 9 || fail "Trwa inne wdrożenie."

WORK="$(mktemp -d /var/tmp/ai-kreator-deploy.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

log "Rozpakowuję paczkę ${SHA:0:7}"
tar -xzf "$ARCHIVE" -C "$WORK" --no-same-owner --no-same-permissions
[[ -z "$(find "$WORK" -type l -print -quit)" ]] || fail "Paczka zawiera dowiązania symboliczne — przerywam."
[[ -f "$WORK/dist/index.html" ]] || fail "W paczce nie ma dist/index.html."
[[ -d "$WORK/vps/server/src" ]] || fail "W paczce nie ma vps/server/src."

# ---------- kopia do cofnięcia ----------
BACKUP="$RELEASES/$(date +%Y%m%d-%H%M%S)-${SHA:0:7}"
mkdir -p "$BACKUP"
chmod 700 "$RELEASES"
[[ -f "$WEBROOT/index.html" ]] && cp -a "$WEBROOT/index.html" "$BACKUP/index.html"
[[ -d "$WEBROOT/_seo" ]] && cp -a "$WEBROOT/_seo" "$BACKUP/_seo"
[[ -f "$SEO_CONF" ]] && cp -a "$SEO_CONF" "$BACKUP/seo-routes.conf"
if [[ -d "$SOURCE/vps/server" ]]; then
  tar -czf "$BACKUP/vps-server.tgz" -C "$SOURCE/vps" --exclude=node_modules --exclude=dist server docker-compose.yml 2>/dev/null || true
fi
log "Kopia do cofnięcia: $BACKUP"

# ---------- frontend: nowe zasoby i _seo/ przed przełączeniem ----------
mv "$WORK/dist/index.html" "$WORK/index.html"
if [[ -d "$WORK/dist/_seo" ]]; then mv "$WORK/dist/_seo" "$WORK/_seo"; fi

log "Wgrywam zasoby frontendu (stare pliki z hashem zostają)"
mkdir -p "$WEBROOT"
cp -a "$WORK/dist/." "$WEBROOT/"

if [[ -d "$WORK/_seo" ]]; then
  rm -rf "$WEBROOT/_seo.new" "$WEBROOT/_seo.old"
  cp -a "$WORK/_seo" "$WEBROOT/_seo.new"
  [[ -d "$WEBROOT/_seo" ]] && mv "$WEBROOT/_seo" "$WEBROOT/_seo.old"
  mv "$WEBROOT/_seo.new" "$WEBROOT/_seo"
  rm -rf "$WEBROOT/_seo.old"
fi

chown -R root:www-data "$WEBROOT"
find "$WEBROOT" -path "$WEBROOT/.well-known" -prune -o -type d -exec chmod 755 {} +
find "$WEBROOT" -path "$WEBROOT/.well-known" -prune -o -type f -exec chmod 644 {} +

# ---------- reguły SEO Apache ----------
APACHE_RELOAD=0
if [[ -f "$SEO_CONF" && -f "$WORK/vps/apache/seo-routes.conf" ]] && ! cmp -s "$SEO_CONF" "$WORK/vps/apache/seo-routes.conf"; then
  log "Aktualizuję reguły SEO Apache"
  install -m 644 -o root -g root "$WORK/vps/apache/seo-routes.conf" "$SEO_CONF"
  if ! apache2ctl configtest >/dev/null 2>&1; then
    cp -a "$BACKUP/seo-routes.conf" "$SEO_CONF"
    fail "apache2ctl configtest nie przeszedł — przywróciłem poprzednie reguły, strona nie została przełączona."
  fi
  APACHE_RELOAD=1
fi

# ---------- przełączenie strony ----------
install -m 644 -o root -g www-data "$WORK/index.html" "$WEBROOT/.index.html.new"
mv -f "$WEBROOT/.index.html.new" "$WEBROOT/index.html"
if [[ "$APACHE_RELOAD" == 1 ]]; then systemctl reload apache2; fi
log "Frontend przełączony"

# ---------- backend ----------
BACKEND_CHANGED=0
if ! diff -rq --exclude=node_modules --exclude=dist "$WORK/vps/server" "$SOURCE/vps/server" >/dev/null 2>&1 \
   || ! cmp -s "$WORK/vps/docker-compose.yml" "$SOURCE/vps/docker-compose.yml"; then
  BACKEND_CHANGED=1
fi

log "Aktualizuję pliki w $SOURCE/vps (bez .env)"
mkdir -p "$SOURCE/vps"
rm -rf "$SOURCE/vps/server/src" "$SOURCE/vps/server/test"
cp -a "$WORK/vps/." "$SOURCE/vps/"
chown -R root:root "$SOURCE"
find "$SOURCE/vps/scripts" -type f -name '*.sh' -exec chmod 750 {} + 2>/dev/null || true
chmod 600 "$SOURCE/vps/.env" 2>/dev/null || true

wait_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

if [[ "$BACKEND_CHANGED" == 1 ]]; then
  log "Kod backendu się zmienił — przebudowuję kontener api"
  if ! (cd "$SOURCE/vps" && docker compose up -d --build api) || ! wait_healthy; then
    log "Backend nie odpowiada po wdrożeniu — przywracam poprzednią wersję"
    if [[ -f "$BACKUP/vps-server.tgz" ]]; then
      rm -rf "$SOURCE/vps/server/src" "$SOURCE/vps/server/test"
      tar -xzf "$BACKUP/vps-server.tgz" -C "$SOURCE/vps"
      (cd "$SOURCE/vps" && docker compose up -d --build api) || true
      wait_healthy && log "Poprzedni backend działa." || log "Poprzedni backend też nie odpowiada — sprawdź: docker compose logs api"
    fi
    fail "Wdrożenie backendu nie powiodło się (frontend jest już nowy)."
  fi
  log "Backend działa: $HEALTH_URL"
else
  log "Kod backendu bez zmian — kontener api nie jest przebudowywany"
fi

# ---------- sprzątanie ----------
rm -f "$ARCHIVE"
find "$INCOMING" -maxdepth 1 -name '*.tar.gz' -mtime +2 -delete 2>/dev/null || true
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf

log "Gotowe: ${SHA:0:7} jest na ai-kreator.pl"
