#!/usr/bin/env bash
# Kopiert den Kiosk-Service nach systemd, lädt ihn neu und startet die
# Slotmaschine neu. Nach jeder Änderung an Service/Code auf dem Pi ausführen:
#   ./deploy/update-service.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE=slotmachine-kiosk.service

chmod +x "$DIR/../start.sh"
sudo cp "$DIR/$SERVICE" /etc/systemd/system/
sudo systemctl daemon-reload
# Autostart beim Booten sicherstellen (macht nichts, wenn schon aktiviert)
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

echo "Neu gestartet. Logs: journalctl -u $SERVICE -f"
