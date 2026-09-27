#!/usr/bin/env bash
# Kopiert den Kiosk- und den Touch-Fix-Service nach systemd, lädt sie neu und
# startet die Slotmaschine neu. Nach jeder Änderung an Service/Code auf dem Pi ausführen:
#   ./deploy/update-service.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE=slotmachine-kiosk.service
TOUCH_SERVICE=slotmachine-touch.service

chmod +x "$DIR/../start.sh"
sudo cp "$DIR/$SERVICE" "$DIR/$TOUCH_SERVICE" /etc/systemd/system/
sudo systemctl daemon-reload
# Autostart beim Booten sicherstellen (macht nichts, wenn schon aktiviert)
sudo systemctl enable "$SERVICE" "$TOUCH_SERVICE"
# Touch-Fix sofort einmal laufen lassen (falls Touch gerade fehlt)
sudo systemctl start "$TOUCH_SERVICE" || true
sudo systemctl restart "$SERVICE"

echo "Neu gestartet. Logs: journalctl -u $SERVICE -f"
