#!/usr/bin/env bash
# Startet den Flask-Server und öffnet das Frontend danach automatisch
# im Vollbild-/Kiosk-Modus im Browser (gedacht für den Raspberry Pi).

set -euo pipefail

# Auf dem Pi ohne Debug-Modus starten (Vollbild, kein Debug-Panel).
# Überschreibbar mit: SLOT_DEBUG=1 ./start.sh
export SLOT_DEBUG="${SLOT_DEBUG:-0}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:5000"
VENV_PY="$DIR/venv/bin/python"
PYTHON="$([ -x "$VENV_PY" ] && echo "$VENV_PY" || echo "python3")"

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
  echo "Kein Chromium/Chrome gefunden - öffne Standardbrowser stattdessen."
  xdg-open "$URL"
  wait "$SERVER_PID"
  exit 0
fi

"$BROWSER" --kiosk --noerrdialogs --disable-infobars --incognito "$URL"

# Wenn der Browser geschlossen wird, läuft das Script weiter und
# stoppt (via trap) den Server automatisch mit.
