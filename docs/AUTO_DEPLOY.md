# GitHub Actions i wdrożenie ręczne

Aktualna procedura serwera: [VPS_SYNC_GUIDE.md](./VPS_SYNC_GUIDE.md). Wdrożenie ręczne przez `ubuntu` działa niezależnie od Actions. Sam `git push` nie jest potwierdzeniem publikacji strony.

Workflow `.github/workflows/deploy.yml` testuje i buduje frontend oraz API z Node.js 24. `scripts/package-release.mjs` tworzy paczkę dla konkretnego commita z sumą SHA256, bez lokalnych sekretów i nieśledzonych źródeł.

Automatyczna publikacja wymaga osobnego konta `deploy`, jego klucza publicznego i sekretu `DEPLOY_SSH_KEY` w GitHubie. Nie zakładaj, że te elementy istnieją. Bez sekretu workflow pomija publikację z ostrzeżeniem. Wynik testów i wynik wdrożenia sprawdzaj osobno.

## Opcjonalna konfiguracja automatu

1. Prześlij cały katalog `vps/deploy` do prywatnego katalogu administracyjnego na VPS.
2. Uruchom `setup-deploy-user.sh` przez `ubuntu` i sudo z uzgodnionym kluczem publicznym dedykowanym GitHub Actions. Skrypt instaluje narzędzia i ogranicza sudo konta deploy do stałego skryptu. Nie używaj osobistego klucza SSH jako klucza CI.
3. Zapisz dedykowany klucz prywatny w sekrecie GitHuba `DEPLOY_SSH_KEY`, nigdy w repozytorium.
4. Sprawdź udany workflow i numer commita na `https://ai-kreator.pl/deployment-check.json`.

Paczki trafiają do `/home/deploy/incoming`, katalog 0700, pliki 0600. Konto deploy uruchamia `sudo /usr/local/sbin/ai-kreator-deploy <pełny-sha>`. Serwer wymaga paczki, sumy i manifestu oraz wykonuje te same kontrole, kopie, budowanie z `--pull` i próby cofnięcia co przy wdrożeniu ręcznym.

Stałe narzędzia root instaluje administrator oddzielnie. Paczka aplikacji nie może podmieniać skryptu wdrażania ani SSH.

## Testy procedury

```bash
python3 -m unittest discover -s vps/deploy -p 'test_release_tool.py' -v
# Linux, root i rsync; wszystkie ścieżki oraz usługi są zastąpione w testach:
sudo python3 -m unittest discover -s vps/deploy -p 'test_deploy_transaction.py' -v
```

Testowane awarie: nowe API, konfiguracja Apache i kontrola publicznej strony. Testy nie przełączają działających usług.
