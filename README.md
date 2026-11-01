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

## Wymagane klucze API

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- (opcjonalnie) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`

