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

## Wymagane klucze API

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- (opcjonalnie) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`

