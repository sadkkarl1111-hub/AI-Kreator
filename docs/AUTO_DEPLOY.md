# Automatyczne wdrożenie (GitHub Actions → VPS)

Każdy push na `main` uruchamia `.github/workflows/deploy.yml`:

1. **Testy i budowanie** (GitHub): `npm ci`, `npm test`, `npm run build`, testy backendu `vps/server`.
   Jeśli cokolwiek się nie powiedzie, nic nie trafia na serwer.
2. **Wdrożenie**: paczka (`dist/` + `vps/` bez `.env`) idzie przez SSH na użytkownika `deploy`,
   a następnie `sudo /usr/local/sbin/ai-kreator-deploy <sha>`:
   - nowe zasoby i `_seo/` są wgrywane przed przełączeniem, stare pliki z hashem zostają,
   - reguły `/etc/apache2/ai-kreator-seo-routes.conf` podmieniane tylko po udanym `apache2ctl configtest`,
   - `index.html` podmieniany na końcu, atomowo,
   - kontener `api` przebudowywany tylko, gdy zmienił się kod backendu; potem sprawdzany jest `/health`,
     a przy błędzie przywracana jest poprzednia wersja backendu.
3. Na koniec sprawdzenie `https://ai-kreator.pl/` i `https://ai-kreator.pl/api/health`.

Pull requesty do `main` uruchamiają tylko testy, bez wdrożenia.
Ręczne uruchomienie: GitHub → Actions → „Testy i wdrożenie” → Run workflow.

## Konfiguracja (jednorazowo)

### Serwer (jako root)

```bash
scp vps/deploy/ai-kreator-deploy.sh vps/deploy/setup-deploy-user.sh root@57.128.201.254:/root/
ssh root@57.128.201.254 'bash /root/setup-deploy-user.sh "<klucz publiczny ai_kreator_deploy.pub>"'
```

Skrypt zakłada użytkownika `deploy` (logowanie tylko kluczem, opcja `restrict`),
instaluje `/usr/local/sbin/ai-kreator-deploy` i pozwala przez sudo uruchomić wyłącznie ten skrypt.
Nie zmienia SSH, Apache, Dockera ani bazy.

### GitHub

Settings → Secrets and variables → Actions → New repository secret:

- `DEPLOY_SSH_KEY`: cała zawartość prywatnego klucza `ai_kreator_deploy`
  (od `-----BEGIN OPENSSH PRIVATE KEY-----` do `-----END OPENSSH PRIVATE KEY-----`).

Bez tego sekretu workflow robi testy i budowanie, a wdrożenie pomija z ostrzeżeniem.

## Cofnięcie wdrożenia

Kopie poprzedniego `index.html`, `_seo/`, reguł SEO i kodu backendu: `/var/lib/ai-kreator/releases/` (ostatnie 15).
Najprościej cofnąć przez `git revert` na `main` — automat wdroży poprzednią wersję.

## Ręczne wdrożenie awaryjne

`scripts/deploy-vps.ps1` nadal działa (logowanie jako root), ale pomija sprawdzanie testów i kasuje stare pliki z hashem.
Używaj tylko, gdy GitHub Actions nie działa.
