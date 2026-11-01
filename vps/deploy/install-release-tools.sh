#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run through sudo.' >&2; exit 1; }
HERE=$(cd -- "$(dirname -- "$0")" && pwd)
for command in docker python3 rsync curl flock apache2ctl; do command -v "$command" >/dev/null; done
[[ -x /usr/local/sbin/ai-kreator-daily-db-backup ]]
bash -n "$HERE/ai-kreator-deploy.sh"
bash -n "$HERE/ai-kreator-maintenance.sh"
install -d -m 755 /usr/local/lib/ai-kreator
install -d -m 700 /var/lib/ai-kreator /var/lib/ai-kreator/releases /var/lib/ai-kreator/work
install -m 644 -o root -g root "$HERE/release_tool.py" /usr/local/lib/ai-kreator/release_tool.py
install -m 750 -o root -g root "$HERE/ai-kreator-deploy.sh" /usr/local/sbin/ai-kreator-deploy
install -m 750 -o root -g root "$HERE/ai-kreator-maintenance.sh" /usr/local/sbin/ai-kreator-maintenance
install -m 644 -o root -g root "$HERE/ai-kreator-maintenance.service" /etc/systemd/system/ai-kreator-maintenance.service
install -m 644 -o root -g root "$HERE/ai-kreator-maintenance.timer" /etc/systemd/system/ai-kreator-maintenance.timer
systemctl daemon-reload
systemctl enable --now ai-kreator-maintenance.timer
echo 'Installed release tools and monthly PostgreSQL/Redis maintenance. SSH and other sites were not changed.'
