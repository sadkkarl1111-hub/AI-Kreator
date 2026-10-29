# VPS Starter

Ten folder jest punktem startowym pod pelne odejscie od legacy-backend.

## Co jest tutaj przygotowane

- `.env.example` z lista sekretow i konfiguracji pod backend VPS
- `server/` z podstawowym szkieletem backendu `Node.js + Express + TypeScript`
- `docker-compose.yml` z uslugami `api`, `postgres`, `redis`
- `nginx/snappyweb.conf` jako przykladowy reverse proxy pod produkcje

## Od czego zaczac

1. Skopiuj `vps/.env.example` do lokalnego `.env`.
2. Postaw backend z folderu `vps/server`.
3. Podlacz PostgreSQL i Redis.
4. Zacznij implementowac endpointy wedlug `docs/VPS_API_MAP.md`.
5. Przepinaj frontend modul po module z `legacy-backend` na wlasne API.

## Dokumenty migracji

- `docs/VPS_MIGRATION_PLAN.md`
- `docs/VPS_API_MAP.md`

## Wazne

Samo przeniesienie frontendu na VPS nie usuwa legacy-backend.
legacy-backend zniknie dopiero po przeniesieniu:

- auth
- database
- storage
- edge functions
- webhookow i cronow

## Minimalny baseline bezpieczenstwa hosta

Po starcie produkcji VPS powinien miec dopiety co najmniej taki zestaw:

- `ufw` aktywny z otwartymi tylko `22`, `80`, `443`
- `fail2ban` aktywny przynajmniej dla `sshd`, najlepiej z dodatkowym jail `recidive`
- brak publicznie uruchomionego `vsftpd` / FTP, jesli nie jest absolutnie potrzebny
- `docker` wlaczony na starcie hosta, zeby backend po restarcie nie zostal martwy
- logi kontenerow z limitem rotacji, zeby Docker nie zapelnial dysku
- Docker i bazy wystawione tylko na `127.0.0.1`
- logowanie `root` tylko po kluczu SSH, bez logowania haslem

Szczegolowy runbook hosta jest opisany w [HOST_HARDENING.md](./HOST_HARDENING.md).

## Sekrety bazy

`docker-compose.yml` nie powinien trzymac hasla PostgreSQL na sztywno.
Haslo bazy idzie z `POSTGRES_PASSWORD` w produkcyjnym `.env`.

W praktyce:

- `POSTGRES_PASSWORD` musi byc ustawione w `vps/.env`
- `DATABASE_URL` musi wskazywac na to samo haslo
- po zmianie hasla w dzialajacym srodowisku trzeba zrobic to kontrolowanie, z migracja / restartem uslug


## Codzienna kopia bazy — uruchomiona 26.10.2026

Serwerowy timer `ai-kreator-db-backup.timer` uruchamia kopię PostgreSQL codziennie o `00:00 Europe/Warsaw`. Nie wymaga włączonego komputera ani Codexa. Strefa czasu jest jawna; ustawienie UTC hosta pozostało bez zmian. `Persistent=true` nadrabia pominięty termin po ponownym uruchomieniu serwera.

- Skrypt: `/usr/local/sbin/ai-kreator-daily-db-backup` (źródło: `scripts/daily-db-backup.sh`).
- Rotacja: `/usr/local/lib/ai-kreator/db_backup_retention.py`.
- Katalog: `/var/backups/ai-kreator/daily-db`, uprawnienia 0700; pliki 0600.
- Retencja: ostatnie **14 zweryfikowanych kopii**, nie sztywne 14 dni. Przy błędzie starsze poprawne kopie pozostają.
- Każdy zrzut `pg_dump` jest odtwarzany w oddzielnym, odizolowanym kontenerze PostgreSQL z limitami 256 MB / 1 CPU. Kontener i jego anonimowy wolumen są usuwane. Osierocone kontenery testowe są sprzątane tylko według etykiety i katalogu tego zadania, po uzyskaniu blokady.
- Przed zapisaniem jest kontrola wolnego miejsca; plik jest publikowany dopiero po poprawnym odtworzeniu. Kopia otrzymuje sumę SHA256 oraz metadane `.json`.
- Rotacja usuwa wyłącznie nadmiarowe pliki własnych zestawów `.dump/.sha256/.json`. Nie usuwa katalogów ani dowiązań i nie obejmuje wcześniejszych pełnych kopii wdrożeń.
- `flock` zapobiega nakładaniu się przebiegów. Nieudane zadanie jest ponawiane po 5 minutach, maksymalnie 3 próby w godzinie; wynik jest w dzienniku systemowym.
- Ten harmonogram obejmuje bazę na tym serwerze. Pełna zaszyfrowana kopia z 26.10.2026 na komputerze pozostaje oddzielna; codzienne kopie nie są automatycznie wysyłane poza VPS.

Kontrola:

```bash
sudo systemctl list-timers --all ai-kreator-db-backup.timer
sudo systemctl show ai-kreator-db-backup.service -p Result -p ExecMainStatus
sudo journalctl -u ai-kreator-db-backup.service -n 30 --no-pager
```

Ręczny dodatkowy przebieg: `sudo systemctl start ai-kreator-db-backup.service`. Test retencji: `python3 scripts/test-db-backup-retention.py` (na Linuksie, z katalogu `vps`). Pierwszy poprawny zrzut miał 658809 bajtów i 48 odtworzonych tabel. Sprawdzono usunięcie 3 najstarszych spośród 17 testowych kopii, ochronę ręcznych kopii i symlinków, zachowanie wszystkich kopii przy błędzie oraz blokadę równoległego przebiegu.

## SEO publicznych stron — 26.10.2026

`npm run build` generuje `dist/sitemap.xml`, osobne dokumenty HTML w `dist/_seo/` oraz `vps/apache/seo-routes.conf`. Lista stron i metadane mają wspólne źródło w `src/lib/seo.ts`; artykuły są pobierane z `src/content/blog.ts`. Publiczne HTML zawierają treść początkową, canonical, tytuł, opis, Open Graph i JSON-LD. React zastępuje treść początkową interaktywną stroną. `RouteSeo` aktualizuje te same dane przy nawigacji w aplikacji.

Wdrożenie wymaga zarówno zawartości `dist/`, jak i wygenerowanego pliku reguł: `/etc/apache2/ai-kreator-seo-routes.conf`, dołączonego przez `Include` wewnątrz bloku `<Directory /var/www/ai-kreator.pl>` w aktywnym Apache. Zastępuje on dawną ogólną regułę SPA; nie należy przywracać fallbacku wszystkich adresów na `index.html`. VirtualHost ma `ErrorDocument 404 /_seo/not-found.html`, przekierowanie HTTPS www na domenę główną i nagłówek `X-Robots-Tag: noindex, nofollow` dla API.

Zachowuj publiczne adresy bez końcowego ukośnika, z wyjątkiem `/`. Alias `/terms` przekierowuje na `/regulamin`, `/privacy` na `/polityka-prywatnosci`. Zalogowane widoki i udostępnienia z tokenem dostają dokument `noindex`; nieznane adresy zwracają HTTP 404. `robots.txt` pozwala na publiczne strony i zasoby JS/CSS, blokuje API oraz wewnętrzny katalog HTML i wskazuje mapę witryny. Samo `noindex` nie zastępuje autoryzacji API.

Przy kolejnych wdrożeniach zachowaj stare pliki z hashem, wgraj nowe zasoby i `_seo/` przed przełączeniem strony, zaktualizuj reguły i sprawdź `apache2ctl configtest` przed przeładowaniem. Dodając trasę w `App.tsx`, uzupełnij listę publicznych stron lub `PRIVATE_PATHS`; test `src/lib/seo.test.ts` sprawdza spójność. Mapę `https://ai-kreator.pl/sitemap.xml` należy zgłosić w Google Search Console. Indeksowanie i pozycje pozostają decyzją wyszukiwarki.
