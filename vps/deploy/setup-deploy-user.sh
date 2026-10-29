#!/usr/bin/env bash
# Jednorazowa konfiguracja serwera pod automatyczne wdrożenia z GitHub Actions.
# Uruchom jako root, z folderu, w którym leży też ai-kreator-deploy.sh:
#   bash setup-deploy-user.sh "ssh-ed25519 AAAA... github-actions-ai-kreator"
#
# Co robi:
#   - zakłada użytkownika `deploy` (bez hasła, logowanie tylko kluczem),
#   - wpisuje mu jeden klucz publiczny GitHub Actions,
#   - instaluje /usr/local/sbin/ai-kreator-deploy,
#   - pozwala mu przez sudo uruchomić WYŁĄCZNIE ten jeden skrypt.
# Nie zmienia konfiguracji SSH, Apache, Dockera ani bazy.

set -euo pipefail

PUBKEY="${1:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[[ $EUID -eq 0 ]] || { echo "Uruchom jako root."; exit 1; }
[[ "$PUBKEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || { echo "Podaj klucz publiczny ssh-ed25519 w cudzysłowie."; exit 1; }
[[ -f "$HERE/ai-kreator-deploy.sh" ]] || { echo "Brak ai-kreator-deploy.sh obok tego skryptu."; exit 1; }

for cmd in flock curl tar diff docker apache2ctl sudo; do
  command -v "$cmd" >/dev/null || { echo "Brak programu: $cmd"; exit 1; }
done

if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
  passwd -l deploy >/dev/null
  echo "Utworzono użytkownika deploy."
fi

install -d -m 700 -o deploy -g deploy /home/deploy/.ssh /home/deploy/incoming
printf 'restrict %s\n' "$PUBKEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

sed -i 's/\r$//' "$HERE/ai-kreator-deploy.sh"
install -m 750 -o root -g root "$HERE/ai-kreator-deploy.sh" /usr/local/sbin/ai-kreator-deploy
install -d -m 700 -o root -g root /var/lib/ai-kreator/releases

SUDOERS=/etc/sudoers.d/ai-kreator-deploy
echo 'deploy ALL=(root) NOPASSWD: /usr/local/sbin/ai-kreator-deploy' > "$SUDOERS.tmp"
chmod 440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp" >/dev/null
mv "$SUDOERS.tmp" "$SUDOERS"

if sshd -T 2>/dev/null | grep -qi '^allowusers '; then
  echo "UWAGA: sshd ma ustawione AllowUsers — dopisz tam użytkownika deploy, inaczej GitHub się nie zaloguje."
fi

echo "Gotowe. Użytkownik deploy może tylko wgrać paczkę i uruchomić: sudo /usr/local/sbin/ai-kreator-deploy <sha>"
