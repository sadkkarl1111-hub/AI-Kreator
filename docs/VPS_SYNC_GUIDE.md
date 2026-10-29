# VPS Sync Guide

## Cel

Ten plik opisuje najprostszy sposob przerzucania zmian z lokalnego repo na VPS bez Git na serwerze.

## Skrypt

Uzyj skryptu:

- `scripts/deploy-vps.ps1`

## Co robi skrypt

1. Pakuje gotowy frontend z lokalnego folderu `dist`.
2. Pakuje osobno pliki potrzebne pod VPS/backend:
   - `vps/`
   - dokumentacje migracji
3. Wysyla obie paczki na VPS przez `scp`.
4. Rozpakowuje frontend do:
   - `/var/www/ai-kreator.pl`
5. Rozpakowuje pliki VPS/backend do:
   - `/opt/ai-kreator-source`
6. Opcjonalnie:
   - restartuje backend Docker
   - przeladowuje Nginx

## Przyklad uzycia

Synchronizacja samych plikow:

```powershell
powershell -ExecutionPolicy Bypass -Command "npm run build"
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1
```

Synchronizacja + przebudowa backendu:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -RestartBackend
```

Synchronizacja + backend + Nginx:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -RestartBackend -ReloadNginx
```

## Jak pozbyc sie pytania o haslo

Najwygodniej ustawic klucz SSH raz, a potem uzywac go przy deployu.

### 1. Utworz klucz lokalnie

W PowerShell:

```powershell
ssh-keygen -t ed25519 -C "ai-kreator-vps"
```

Jesli nie chcesz zmieniac sciezki, potwierdz domyslna lokalizacje:

- `C:\Users\witel\.ssh\id_ed25519`

### 2. Dodaj klucz publiczny na VPS

W PowerShell:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@57.128.201.254 "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys"
```

### 3. Test polaczenia

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@57.128.201.254
```

### 4. Uzywaj klucza przy deployu

```powershell
powershell -ExecutionPolicy Bypass -Command "npm run build"
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -IdentityFile "$env:USERPROFILE\.ssh\id_ed25519"
```

Po tym deploy nie powinien juz pytac o haslo przy kazdym `scp` i `ssh`.

## Aktualne dane wdrozenia (potwierdzone z uzytkownikiem 2026-09-20)

- Host: `57.128.201.254`, port SSH: `22`, uzytkownik: `ubuntu`.
- Podana przez uzytkownika komenda PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\ai-kreator-vps" ubuntu@57.128.201.254
```

- Plik `ai-kreator-vps` nie istnieje na tym komputerze podczas kontroli 2026-09-20. Nie tworzyc ani nie podmieniac kluczy automatycznie.
- Zweryfikowano przez `ssh-keygen -y`: klucz prywatny `$env:USERPROFILE\.ssh\id_ed25519` odpowiada dokladnie kluczowi publicznemu podanemu przez uzytkownika z komentarzem `ai-kreator-vps`. Komentarz nie jest nazwa pliku. Prawidlowa komenda dla tego komputera: `ssh -i "$env:USERPROFILE\.ssh\id_ed25519" ubuntu@57.128.201.254`.
- Wdrozenia 2026-09-12 dzialaly przez `ssh -o BatchMode=yes ubuntu@57.128.201.254` z domyslnie dostepnym uwierzytelnianiem i `sudo -n`.
- Uzytkownik wymaga zachowania ustawien serwera i aplikacji. Dla zmian menu wdrazac tylko frontend, po kopii zapasowej; nie zmieniac `.env`, SSH, nginx, Docker Compose ani bazy danych.
- Ponizsze przyklady z kontem `root` sa historyczne. Do kolejnych wdrozen uzywac `ubuntu`.

## Domyslne ustawienia historycznego skryptu

- host: `57.128.201.254`
- user: `root`
- katalog frontendu: `/var/www/ai-kreator.pl`
- katalog plikow VPS/backendu: `/opt/ai-kreator-source`

Mozesz je nadpisac parametrami:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -HostName "1.2.3.4" -SshUser "root" -RemoteWebRoot "/var/www/inna-apka" -RemoteSourcePath "/opt/inna-apka-source" -IdentityFile "$env:USERPROFILE\.ssh\inna_nazwa_klucza"
```

## Wazne

- skrypt wymaga lokalnego `dist`, wiec najpierw zrob `npm run build`
- skrypt nie wysyla lokalnego pliku `.env`
- frontend i backend nie lacza sie automatycznie z lokalnym repo, dopoki nie uruchomisz tego skryptu albo innego deployu
- frontend i kod backendu sa celowo rozdzielone, zeby nie nadpisywac dzialajacej strony plikami zrodlowymi Vite
