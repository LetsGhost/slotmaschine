#!/usr/bin/env bash
# Richtet die Slotmaschine auf einem frisch geflashten Raspberry Pi OS Lite
# (64-bit) komplett ein: Pakete, I2C, Python-venv, Bootbild, Kiosk-/Touch-
# Service und sudoers-Regel fürs Power-Menü. Kann gefahrlos mehrfach laufen.
#
# Ablauf auf der neuen SD-Karte (im Pi Imager User "admin" anlegen, SSH an):
#   sudo apt install -y git
#   git clone https://github.com/LetsGhost/slotmaschine.git ~/slotmaschine
#   cd ~/slotmaschine && ./deploy/setup-pi.sh
#   # Kontostände von der alten Karte zurückspielen (vom PC aus):
#   #   scp accounts.json admin@<pi>:~/slotmaschine/backend/
#   sudo reboot

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Die Services enthalten User und Pfad fest (deploy/slotmachine-*.service).
EXPECTED_USER=admin
EXPECTED_DIR=/home/admin/slotmaschine

step() { echo; echo "==> $*"; }

if [ "$(id -u)" -eq 0 ]; then
  echo "Bitte als User $EXPECTED_USER ohne sudo starten - das Script fragt selbst nach sudo." >&2
  exit 1
fi
if [ "$(id -un)" != "$EXPECTED_USER" ] || [ "$DIR" != "$EXPECTED_DIR" ]; then
  echo "Erwartet: User '$EXPECTED_USER', Projekt unter $EXPECTED_DIR" >&2
  echo "Gefunden: User '$(id -un)', Projekt unter $DIR" >&2
  echo "Sonst User=/Pfade in deploy/slotmachine-*.service und deploy/slotmachine-power.sudoers anpassen." >&2
  exit 1
fi

step "Pakete installieren"
sudo apt-get update
sudo apt-get install -y \
  git curl \
  python3-venv python3-pip python3-lgpio \
  cage chromium wlr-randr \
  i2c-tools libinput-tools \
  plymouth plymouth-themes rpd-plym-splash

step "I2C aktivieren (NFC-Reader PN532, Touch)"
sudo raspi-config nonint do_i2c 0

step "Gruppen für GPIO/I2C/Display/Touch"
for group in gpio i2c video render input; do
  if getent group "$group" >/dev/null; then
    sudo usermod -aG "$group" "$EXPECTED_USER"
  fi
done

step "Python-venv einrichten"
# --system-site-packages: gpiozero braucht das per apt installierte lgpio
if [ ! -x "$DIR/venv/bin/python" ]; then
  python3 -m venv --system-site-packages "$DIR/venv"
fi
"$DIR/venv/bin/pip" install --upgrade pip
"$DIR/venv/bin/pip" install -r "$DIR/requirements.txt"

step "Bootbild statt Textausgabe (cmdline.txt)"
CMDLINE=/boot/firmware/cmdline.txt
[ -f "$CMDLINE.orig" ] || sudo cp "$CMDLINE" "$CMDLINE.orig"
# Kernel-Meldungen von tty1 weg, damit der Kiosk dort sauber startet
sudo sed -i 's/\bconsole=tty1\b/console=tty3/' "$CMDLINE"
for param in quiet splash loglevel=3 logo.nologo vt.global_cursor_default=0 plymouth.ignore-serial-consoles; do
  if ! grep -qE "(^| )$param( |$)" "$CMDLINE"; then
    # cmdline.txt muss eine einzige Zeile bleiben
    sudo sed -i "1 s/\$/ $param/" "$CMDLINE"
  fi
done
sudo plymouth-set-default-theme pix

step "Services und sudoers-Regel installieren"
"$DIR/deploy/update-service.sh"

step "Selbsttest"
if chromium --headless=new --disable-gpu --user-data-dir="$(mktemp -d)" --dump-dom about:blank >/dev/null 2>&1; then
  echo "Chromium startet."
else
  echo "WARNUNG: Chromium startet nicht (Exit $?) - SD-Karte/Installation prüfen." >&2
fi
broken="$(sudo dpkg --verify 2>/dev/null | grep -v ' c /' | grep -v plymouth/themes || true)"
if [ -n "$broken" ]; then
  echo "WARNUNG: Beschädigte Paketdateien:" >&2
  echo "$broken" >&2
else
  echo "Alle Paketdateien in Ordnung."
fi

echo
echo "Fertig. Jetzt neu starten: sudo reboot"
echo "Danach: sudo journalctl -t slotmaschine -f  (erwartet: 'Frontend nach Xs sichtbar.')"
echo "Drehung: SLOT_ROTATION oben in start.sh (Standard 90)."
