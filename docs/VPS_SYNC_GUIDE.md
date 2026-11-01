# Wdrożenie po aktualizacji serwera — 1 listopada 2026

Serwer `57.128.201.254` używa Ubuntu 26.04.1 LTS, Apache i Docker Compose v2. Logujemy się jako `ubuntu`. Blokada wychodzącego SSH z serwera nie blokuje połączeń SSH/SCP z komputera. Repozytorium pobieramy przez HTTPS.

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" ubuntu@57.128.201.254
```

Na drugim komputerze użyj jego własnego, wcześniej autoryzowanego klucza. Nie twórz ani nie podmieniaj kluczy automatycznie. Klucz prywatny, `.env` i hasła nie należą do repozytorium ani paczki.

## Lokalizacje

| Element | Miejsce |
|---|---|
| Frontend | `/var/www/ai-kreator.pl` |
| Źródła API i Compose | `/opt/ai-kreator-source/vps` |
| Sekrety | `/opt/ai-kreator-source/vps/.env`, root, 0600 |
| Reguły SEO Apache | `/etc/apache2/ai-kreator-seo-routes.conf` |
| Skrypt wdrażania | `/usr/local/sbin/ai-kreator-deploy` |
| Paczki ubuntu | `/home/ubuntu/ai-kreator-incoming`, 0700 |
| Kopie wdrożeń | `/var/lib/ai-kreator/releases`, 0700 |
| Codzienne kopie bazy | `/var/backups/ai-kreator/daily-db`, 0700 |

Porty API 3101, PostgreSQL 5432 i Redis 6379 pozostają dostępne tylko na `127.0.0.1`. Zwykły deploy nie zmienia Compose, SSH, MySQL, innych witryn ani kontenerów innych projektów.

## Instalacja narzędzi

Prześlij cały katalog `vps/deploy` do prywatnego katalogu administracyjnego użytkownika ubuntu. Przykład dla obecnej instalacji:

```bash
sudo bash /home/ubuntu/ai-kreator-admin-20261101/deploy/install-release-tools.sh
```

Instalator wymaga istniejącej kopii bazy z próbą odtworzenia. Instaluje narzędzia i miesięczny timer. Nie zmienia kluczy SSH. Aktualizacja samej procedury wymaga ponownej kontroli i instalacji narzędzi przez administratora; paczka aplikacji nie podmienia narzędzi root.

## Wdrożenie z Windows

Wymagane: Git, Node.js 24 z npm, OpenSSH i autoryzowany klucz. Najpierw zapisz zmiany w commicie i wyślij je do GitHuba. Skrypt odrzuca niezapisane zmiany plików śledzonych przez Git.

```powershell
Set-Location C:\Projekty\ai-kreator
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1

# Tylko frontend, bez podmiany API i kopii bazy:
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -FrontendOnly

# Wymuś odświeżenie obrazu bazowego i przebudowanie API:
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -RestartBackend

# Klucz drugiego komputera:
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -IdentityFile "$env:USERPROFILE\.ssh\ai-kreator-vps"
```

Skrypt wykonuje testy i budowanie, tworzy paczkę dla konkretnego commita przez `scripts/package-release.mjs`, dodaje manifest i sumę SHA256. Źródła pochodzą z `git archive`, więc lokalne sekrety i nieśledzone pliki nie trafiają do paczki. Nie pakuje całego katalogu `vps`.

## Kontrole na serwerze

1. Blokada równoległego wdrożenia lub konserwacji. Weryfikacja sumy i commita; odrzucenie sekretów, dowiązań, powtórzeń i ścieżek wychodzących poza paczkę.
2. Kopia źródeł, strony, reguł SEO i etykieta poprzedniego obrazu API. `.env` i wolumeny pozostają na miejscu.
3. Przed zmianą API: eksport bazy i odtworzenie w osobnym kontenerze bez sieci. Błąd zatrzymuje wdrożenie.
4. Budowanie dokładnie kodu z paczki z `docker build --pull`. Obie fazy Dockerfile używają Node.js 24; npm na hoście Ubuntu nie jest wymagany.
5. Testy backendu bez sieci. Następnie kontener próbny wykonuje odczytową kontrolę API i bazy, bez migracji startowych i harmonogramu kredytów.
6. Przełączenie tylko `api`: `docker compose up -d --no-deps --no-build api`.
7. Nowe zasoby i HTML SEO przed głównym `index.html`; starsze pliki z hashem pozostają. Zmiana reguł wymaga udanego `apache2ctl configtest` przed przeładowaniem Apache.
8. Kontrola strony, API, odczytu modeli i widżetów. Numer commita jest publikowany na `https://ai-kreator.pl/deployment-check.json`.

Błąd po rozpoczęciu zmian uruchamia próbę przywrócenia obrazu, źródeł, strony i konfiguracji. Baza nie jest automatycznie cofana, aby nie usuwać nowych zapisów użytkowników. Migracje bazy wymagają osobnego planu zgodności i odtworzenia.

## Cofnięcie i sprzątanie

Na końcu wdrożenia wypisywana jest konkretna komenda:

```bash
sudo /usr/local/sbin/ai-kreator-deploy --rollback NAZWA_KATALOGU_KOPII
```

Skrypt usuwa tylko własny katalog roboczy oraz dwa pliki zakończonego przesyłania. Zachowuje kopie i etykiety obrazów do cofnięcia. Nie wykonuj `rm -rf /var/tmp/ai-kreator-*`, globalnego `docker image prune` ani `docker compose down -v`. Starsze kopie wdrożeń przegląda się i usuwa osobno po wybraniu potrzebnych punktów cofnięcia.

## PostgreSQL i Redis

`ai-kreator-maintenance.timer` wykonuje konserwację w pierwszą niedzielę miesiąca o **03:20 Europe/Warsaw**. Pominięty termin nie jest nadrabiany przy starcie hosta. Ręczne uruchomienie i kontrola:

```bash
sudo systemctl start ai-kreator-maintenance.service
sudo journalctl -u ai-kreator-maintenance.service -n 40 --no-pager
```

Najpierw kopia z odtworzeniem, potem zachowanie poprzednich obrazów i pobranie poprawek `postgres:16-alpine` oraz `redis:7-alpine`. Restart tylko po zmianie obrazu; kontrola bazy, Redis i API. Czas przerwy zależy od startu usług, nie zakładaj stałych 10 sekund. Zmiana głównej wersji PostgreSQL wymaga osobnej migracji.

## Kontrola końcowa

```bash
cd /opt/ai-kreator-source/vps
sudo docker compose ps
sudo docker compose logs --tail 30 api
curl -fsS https://ai-kreator.pl/api/health
curl -fsS https://ai-kreator.pl/deployment-check.json
sudo systemctl list-timers --all ai-kreator-db-backup.timer ai-kreator-maintenance.timer
```

Codzienna kopia pozostaje ustawiona na 00:00 Europe/Warsaw i przechowuje 14 zweryfikowanych zestawów. Sam rozmiar pliku ani `gzip -t` nie zastępują odtworzenia. Kopie poza hostem wymagają osobno uzgodnionego miejsca i ochrony klucza szyfrującego.
