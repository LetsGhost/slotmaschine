#!/usr/bin/env bash
# Startet den Flask-Server und öffnet das Frontend danach automatisch
# im Vollbild-/Kiosk-Modus im Browser (gedacht für den Raspberry Pi).

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Bitte nicht mit sudo/als root starten (cage/Chromium brauchen eine normale User-Session)." >&2
  exit 1
fi

# Auf dem Pi ohne Debug-Modus starten (Vollbild, kein Debug-Panel).
# Überschreibbar mit: SLOT_DEBUG=1 ./start.sh
export SLOT_DEBUG="${SLOT_DEBUG:-0}"

# Drehung des Bildschirms unter cage (Pi OS Lite): normal, 90, 180 oder 270.
# Wird hochkant/falsch herum angezeigt -> anderen Wert probieren.
# Braucht wlr-randr (sudo apt install wlr-randr).
SLOT_ROTATION="${SLOT_ROTATION:-270}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:5000"
VENV_PY="$DIR/venv/bin/python"
PYTHON="$([ -x "$VENV_PY" ] && echo "$VENV_PY" || echo "python3")"

# Mauszeiger ausblenden: cage (und Chromium) zeichnen den Zeiger selbst, CSS
# "cursor: none" hilft bei reinem Touch-Betrieb nicht. Daher ein unsichtbares
# Cursor-Theme erzeugen und per XCURSOR_THEME aktivieren. Standard: aus im
# Debug-Modus, sonst an. Überschreibbar mit SLOT_HIDE_CURSOR=0/1.
if [ "$SLOT_DEBUG" = "1" ]; then
  SLOT_HIDE_CURSOR="${SLOT_HIDE_CURSOR:-0}"
else
  SLOT_HIDE_CURSOR="${SLOT_HIDE_CURSOR:-1}"
fi
if [ "$SLOT_HIDE_CURSOR" = "1" ]; then
  CURSOR_ICONS_DIR="$HOME/.local/share/icons"
  if "$PYTHON" "$DIR/deploy/make_invisible_cursor.py" "$CURSOR_ICONS_DIR/slot-invisible"; then
    export XCURSOR_THEME=slot-invisible
    export XCURSOR_SIZE=24
    export XCURSOR_PATH="$CURSOR_ICONS_DIR:$HOME/.icons:/usr/share/icons:/usr/share/pixmaps"
  else
    echo "Unsichtbares Cursor-Theme konnte nicht erzeugt werden - Zeiger bleibt sichtbar." >&2
  fi
fi

# Server im Hintergrund starten
"$PYTHON" "$DIR/backend/app.py" &
SERVER_PID=$!

# Beim Beenden des Scripts (Strg+C, Browser zu, etc.) Server mit stoppen
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Warten, bis der Server erreichbar ist
echo "Warte auf Server unter $URL ..."
until curl -s -o /dev/null "$URL"; do
  sleep 0.5
done

# Browser passend zur verfügbaren Installation im Kiosk-/Vollbildmodus öffnen
if command -v chromium-browser >/dev/null 2>&1; then
  BROWSER=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
  BROWSER=chromium
elif command -v google-chrome >/dev/null 2>&1; then
  BROWSER=google-chrome
else
  echo "Kein Chromium/Chrome gefunden - bitte installieren: sudo apt install chromium-browser" >&2
  exit 1
fi

BROWSER_FLAGS=(
  --kiosk
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --no-first-run
  --password-store=basic
  --incognito
  # Hintergrundmusik ohne vorheriges Tippen starten (siehe frontend/js/sound.js)
  --autoplay-policy=no-user-gesture-required
)

if [ -n "${WAYLAND_DISPLAY:-}" ] || [ -n "${DISPLAY:-}" ]; then
  # Es läuft bereits eine grafische Oberfläche (Desktop-Image oder PC)
  "$BROWSER" "${BROWSER_FLAGS[@]}" "$URL"
elif command -v cage >/dev/null 2>&1; then
  # Pi OS Lite ohne Desktop: Chromium im Wayland-Kiosk-Compositor cage starten.
  # Braucht eine aktive Konsolen-Session (am Pi auf tty1 angemeldet oder
  # deploy/slotmachine-kiosk.service) - per SSH gibt es keinen Bildschirm-Zugriff.
  if [ -n "${SSH_CONNECTION:-}" ]; then
    echo "Per SSH kann cage den Bildschirm nicht übernehmen. Stattdessen:" >&2
    echo "  sudo systemctl restart slotmachine-kiosk.service" >&2
    echo "(Einrichtung siehe deploy/slotmachine-kiosk.service)" >&2
    exit 1
  fi
  if [ "$SLOT_ROTATION" != "normal" ] && ! command -v wlr-randr >/dev/null 2>&1; then
    echo "wlr-randr fehlt - Bildschirm wird nicht gedreht (sudo apt install wlr-randr)." >&2
  fi
  # Innerhalb von cage erst alle Ausgaben drehen, dann Chromium starten.
  cage -- bash -c '
    rotation="$1"; shift
    if [ "$rotation" != "normal" ] && command -v wlr-randr >/dev/null 2>&1; then
      for output in $(wlr-randr | grep -E "^[^ ]" | cut -d" " -f1); do
        wlr-randr --output "$output" --transform "$rotation"
      done
    fi
    exec "$@"
  ' _ "$SLOT_ROTATION" "$BROWSER" "${BROWSER_FLAGS[@]}" --ozone-platform=wayland "$URL"
else
  echo "Keine grafische Oberfläche gefunden. Auf Pi OS Lite cage installieren:" >&2
  echo "  sudo apt install cage" >&2
  exit 1
fi

# Wenn der Browser geschlossen wird, läuft das Script weiter und
# stoppt (via trap) den Server automatisch mit.
