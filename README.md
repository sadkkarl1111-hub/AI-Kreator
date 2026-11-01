# Kreator Grafik AI

Aplikacja frontend + backend VPS do generowania i edycji grafik AI.

## Co zostaje w folderze projektu

- `src/` — kod aplikacji i jej grafiki.
- `public/` — publiczne obrazy oraz pliki do pobrania.
- `vps/` — backend, konfiguracja serwera i codzienne kopie bazy.
- `scripts/` — narzędzia wdrażania i przygotowania grafik.
- `docs/` — dokumentacja i raporty.
- `node_modules/` — biblioteki potrzebne do uruchamiania, testowania i budowania projektu.
- `.private-backups/` — zaszyfrowana kopia awaryjna oraz chroniony klucz odzyskiwania; nie usuwać.
- `.git/` i pliki konfiguracji — historia projektu oraz ustawienia pracy.
- `.codex-remote-attachments/` — oryginalne materiały referencyjne z rozmów.

Foldery `dist/` i `vps/server/dist/` są odtwarzalne przez `npm run build` w odpowiedniej części projektu. Po sprzątaniu trzeba wykonać build przed podglądem produkcyjnym, `npm start` backendu lub wdrożeniem. Cache i pliki tymczasowe mogą zostać automatycznie utworzone ponownie podczas pracy.

## Lokalny start (frontend)

```bash
npm install
npm run dev
```

## Build frontendu

```bash
npm run build
```

## Backend VPS (lokalnie)

```bash
cd vps/server
npm install
npm run dev
```

## Wdrozenie na serwer

```powershell
.\scripts\deploy-vps.ps1 -IdentityFile "$env:USERPROFILE\.ssh\id_ed25519" -RestartBackend -ReloadNginx
```

## Darmowa galeria GIF-ów

`/tools/gifs` udostępnia 34 autorskie animacje: 16 emoji z przezroczystym tłem
oraz 18 polskich reakcji. Każda ma GIF, statyczny podgląd i MP4 (H.264, yuv420p,
bez dźwięku, 2,4 s, faststart) do przesyłania jako film w WhatsApp Web.
Okno wysyłania pokazuje podgląd filmu i przygotowuje prawdziwy plik, jeśli przeglądarka
obsługuje systemowe menu udostępniania plików. Do WhatsApp Web można przeciągnąć
MP4 z folderu Pobrane. Link jest osobną opcją;
schowek nie zapewnia uniwersalnego wklejania animacji. Nie wymaga konta ani API.
Podglądy można zatrzymać; preferencja ograniczenia ruchu w systemie włącza statyczne obrazy.

Pliki są w `public/gifs/v1/`, a katalog w `src/data/gif-library.json`.
Odtwarzanie kolekcji: `node scripts/generate-gif-library.mjs` (Sharp + gifenc).
Potem uruchom `node scripts/generate-emoji-gifs.mjs` oraz
`node scripts/prepare-gif-sharing.mjs` (wymaga FFmpeg na PATH).
Emoji są w `public/gifs/emoji-v1/`. MP4 ma jasne tło i zachowuje ruch jako film;
nie jest automatycznie instalowaną naklejką WhatsApp ani gwarancją zapętlenia.
Po zmianie grafiki opublikuj nową wersję katalogu, aby zachować wcześniej udostępnione linki.
Normalny build korzysta z gotowych plików. Przy wdrożeniu nowej trasy trzeba także
zaktualizować generowane HTML `_seo/`, mapę strony i reguły Apache zgodnie z `vps/README.md`.

## Kolekcja badge’ów sprzedażowych

`/tools/badges` zawiera dodatkowo 144 autorskie badge’e: po 48 gwarancji,
bonusów i elementów sprzedażowych. Każdy z 24 motywów ma sześć stylów i palet.
Biblioteka pozwala łączyć wyszukiwanie, kategorię, styl i kolor.
Nowe elementy są też dostępne w karuzelach i panelu zarządzania badge’ami.

Źródła SVG oraz PNG 1000×1000 z przezroczystym tłem:
`public/badges/sales-v1/`. Katalog: `src/data/sales-badges.json`.
Odtwarzanie: `node scripts/generate-sales-badges.mjs` (Sharp).
Wdrożenie wymaga także skopiowania `dist/badges/` do publicznego katalogu serwera.
Zachowuj starsze adresy plików. Ustawienia ukrywania i dostępu pozostają w istniejącym API.

## Podział badge’ów według wyglądu

Kafelki na `/tools/badges` grupują całą kolekcję, także starsze grafiki:
3D i przestrzenne, ołówkowe i rysowane, neonowe oraz płaskie i wektorowe.
`?look=3d`, `?look=drawn`, `?look=neon`, `?look=flat` otwierają wybrany widok.
Klasyfikacja: `src/lib/badgeAppearance.ts`. Kolory w palecie są indeksowane osobno,
więc filtr „Złoty” obejmuje też złoto-granatowe ilustracje. Kafelki i miniatury
uwzględniają widoczność oraz dostęp do pakietów.

Kolekcja 24 ilustracji (8 × 3D, 8 × ołówkowe, 8 × neonowe) jest w
`public/badges/illustrated-v1/`, katalog w `src/data/illustrated-badges.json`.
Grafiki przygotowano w imagegen; opisy do ponownego wygenerowania są w
`scripts/illustrated-badge-prompts.json`. Zachowuj przezroczystość PNG i istniejące adresy.

Dodatkowa kolekcja webinarowa w `public/badges/webinar-v1/` obejmuje 12 ilustracji:
wejściówki, rezerwacje, gwarancje zwrotu i oznaczenia limitu miejsc.
Jej wpisy są w tym samym katalogu `src/data/illustrated-badges.json`, a prompty
w `scripts/webinar-badge-prompts.json`. Oznaczenia „20 miejsc”, „50 miejsc”
i „Ostatnie miejsca” są gotowymi grafikami, nie licznikiem zapisów.
W bibliotece mają kategorie „Webinar”, „Gwarancje” i „Liczba miejsc”.

## Gdzie są przechowywane dane — kontrola 1.11.2026

| Zawartość | Lokalizacja |
| --- | --- |
| Gotowa biblioteka badge’ów, GIF-ów i pliki strony | VPS: `/var/www/ai-kreator.pl/`; kopia źródeł i biblioteki w lokalnym projekcie oraz na GitHubie |
| Grafiki AI w galerii oraz pliki zapisywane przez backend | Cloudflare R2; działające API ma `STORAGE_DRIVER=s3` i endpoint R2 |
| Konta, kredyty, metadane grafik i konfiguracja | PostgreSQL na VPS, usługa `postgres` |
| Roboczy projekt karuzeli i ulubione zasoby | Przeglądarka użytkownika; „Zapisz projekt” pobiera dodatkowo plik JSON na jego urządzenie |

Kontrola serwera potwierdziła również `Result=success` i `ExecMainStatus=0`
dla zadania kopii PostgreSQL. Kopie bazy są w `/var/backups/ai-kreator/daily-db`.
Ta kontrola nie obejmowała niezależnej kopii zawartości R2.
Generowanie nowych ilustracji biblioteki w imagegen nie zmienia lokalizacji,
z której strona je udostępnia: wybrane PNG są kopiowane do projektu i wdrażane na VPS.

## Wymagane klucze API

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- (opcjonalnie) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`

