# Host hardening VPS

Ten plik zbiera minimalny, powtarzalny baseline dla produkcyjnego hosta `ai-kreator.pl`.

## Porty publiczne

Na hoście publicznie otwarte powinny byc tylko:

- `22/tcp` - SSH
- `80/tcp` - HTTP
- `443/tcp` - HTTPS

W praktyce pilnuje tego `ufw`.

## SSH

Docelowy stan:

- `root` dozwolony tylko po kluczu
- `PasswordAuthentication no`
- `KbdInteractiveAuthentication no`

Docelowy override trzymamy w:

- `/etc/ssh/sshd_config.d/100-root-key-only.conf`

Przyklad:

```conf
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
```

Po zmianach:

```bash
systemctl restart ssh
sshd -T | grep -E 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|usepam'
```

## Docker

Backend i uslugi danych stoja na Docker Compose, wiec po restarcie hosta Docker musi startowac automatycznie.

Kontrola:

```bash
systemctl enable docker.service docker.socket
systemctl status docker --no-pager
```

Kontenery powinny miec tez limit rotacji logow, zeby host nie zapychal sie po cichu przez `json-file`.

Docelowo w `docker-compose.yml`:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Kontrola:

```bash
docker inspect --format='{{.Name}} {{.HostConfig.LogConfig.Type}} {{json .HostConfig.LogConfig.Config}}' \
  kreator-ai-api kreator-ai-postgres kreator-ai-redis
```

## Fail2ban

Minimalny zestaw jaili:

- `sshd`
- `recidive`

Docelowy plik:

- `/etc/fail2ban/jail.local`

Przyklad:

```ini
[DEFAULT]
banaction = ufw
backend = systemd
findtime = 10m
bantime = 1h
maxretry = 5
usedns = warn

[sshd]
enabled = true
port = ssh
mode = normal

[recidive]
enabled = true
logpath = /var/log/fail2ban.log
findtime = 1d
bantime = 1w
maxretry = 5
```

Kontrola:

```bash
systemctl restart fail2ban
fail2ban-client status
fail2ban-client status sshd
fail2ban-client status recidive
```

## FTP

`vsftpd` nie jest potrzebny dla tej aplikacji i nie powinien zostawac na hoście.

Docelowy stan:

- usluga zatrzymana
- usluga wylaczona
- pakiet usuniety

Kontrola:

```bash
systemctl is-enabled vsftpd
systemctl is-active vsftpd
dpkg -l | grep vsftpd
```

## Compose / sekrety

`POSTGRES_PASSWORD` ma byc pobierane z `vps/.env`, a nie wpisane na sztywno w `docker-compose.yml`.

Minimalna zgodnosc:

```env
POSTGRES_PASSWORD=...
DATABASE_URL=postgresql://app_user:...@postgres:5432/kreator_ai
```

Nowy wolumen Postgresa powinien startowac od razu bez lokalnego `trust`.

W `docker-compose.yml`:

```yaml
POSTGRES_INITDB_ARGS: --auth-host=scram-sha-256 --auth-local=scram-sha-256
```

Na dzialajacej instancji warto tez sprawdzic `pg_hba.conf`, bo stare wolumeny moga nadal miec:

- `local ... trust`
- `host 127.0.0.1/32 ... trust`
- `host ::1/128 ... trust`

Docelowo te wpisy powinny wymagac `scram-sha-256`.

## Szybka lista kontrolna po awarii / restarcie VPS

```bash
systemctl status docker --no-pager
systemctl status nginx --no-pager
systemctl status fail2ban --no-pager
docker compose -f /opt/ai-kreator-source/vps/docker-compose.yml ps
curl -s https://ai-kreator.pl/api/health
ufw status verbose
ss -ltnp
```

## Autoaktualizacje

Host powinien miec aktywne:

- `apt-daily.timer`
- `apt-daily-upgrade.timer`
- `unattended-upgrades`
- `logrotate.timer`

Warto tez miec lokalny override, np. `/etc/apt/apt.conf.d/52ai-kreator-auto-maintenance`:

```conf
APT::Periodic::AutocleanInterval "7";
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
```

Kontrola:

```bash
systemctl list-timers --all | grep -E 'apt|unattended|logrotate'
systemctl status unattended-upgrades --no-pager
systemctl status logrotate.timer --no-pager
```
