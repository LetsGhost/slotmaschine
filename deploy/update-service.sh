#!/usr/bin/env bash
# Kopiert den Kiosk- und den Touch-Fix-Service nach systemd, lädt sie neu und
# startet die Slotmaschine neu. Nach jeder Änderung an Service/Code auf dem Pi ausführen:
#   ./deploy/update-service.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE=slotmachine-kiosk.service
TOUCH_SERVICE=slotmachine-touch.service

chmod +x "$DIR/../start.sh"
# sudoers-Regel fürs Power-Menü der Admin-Karte. Erst mit visudo prüfen - eine
# kaputte Datei in /etc/sudoers.d würde sudo komplett lahmlegen. Zielname ohne
# Punkt, sonst ignoriert sudo die Datei.
sudo visudo -cf "$DIR/slotmachine-power.sudoers"
sudo install -m 0440 -o root -g root "$DIR/slotmachine-power.sudoers" /etc/sudoers.d/slotmachine-power
# Touch-Eingabe passend zur Bilddrehung kalibrieren (siehe Kommentar in der
# Regel). Greift beim Kiosk-Neustart unten, da cage das Gerät neu einliest.
sudo install -m 0644 "$DIR/99-slotmachine-touch.rules" /etc/udev/rules.d/99-slotmachine-touch.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=input --action=change
sudo cp "$DIR/$SERVICE" "$DIR/$TOUCH_SERVICE" /etc/systemd/system/
sudo systemctl daemon-reload
# Autostart beim Booten sicherstellen (macht nichts, wenn schon aktiviert)
sudo systemctl enable "$SERVICE" "$TOUCH_SERVICE"
# Touch-Fix sofort einmal laufen lassen (falls Touch gerade fehlt)
sudo systemctl start "$TOUCH_SERVICE" || true
sudo systemctl restart "$SERVICE"

echo "Neu gestartet. Logs: sudo journalctl -t slotmaschine -f"
