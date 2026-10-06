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

# Mauszeiger ausblenden: CSS "cursor: none" hilft bei reinem Touch-Betrieb
# nicht - Chromium setzt beim Laden einen Zeiger, der erst bei einer
# Mausbewegung aktualisiert würde. Daher ein unsichtbares Cursor-Theme unter
# allen Namen anlegen, die geladen werden: "slot-invisible" (XCURSOR_THEME),
# "default" (cage) und "Adwaita" (Chromium über die GTK-Einstellungen). Der
# Nutzer-Icon-Ordner steht in XCURSOR_PATH vor /usr/share/icons und überdeckt
# so die System-Themes. Standard: an (auch im Debug-Modus - am Pi gibt es keine
# Maus). Abschaltbar mit SLOT_HIDE_CURSOR=0.
SLOT_HIDE_CURSOR="${SLOT_HIDE_CURSOR:-1}"
CURSOR_ICONS_DIR="$HOME/.local/share/icons"
CURSOR_THEMES=(slot-invisible default Adwaita)
if [ "$SLOT_HIDE_CURSOR" = "1" ]; then
  cursor_ok=1
  for theme in "${CURSOR_THEMES[@]}"; do
    "$PYTHON" "$DIR/deploy/make_invisible_cursor.py" "$CURSOR_ICONS_DIR/$theme" || cursor_ok=0
  done
  if [ "$cursor_ok" = "1" ]; then
    echo "Mauszeiger ausgeblendet (Cursor-Themes: ${CURSOR_THEMES[*]})."
    export XCURSOR_THEME=slot-invisible
    export XCURSOR_SIZE=24
    export XCURSOR_PATH="$CURSOR_ICONS_DIR:$HOME/.icons:/usr/share/icons:/usr/share/pixmaps"
    # Software-Cursor erzwingen: Manche Pi-Grafiktreiber zeigen über den
    # Hardware-Cursor sonst trotzdem einen Zeiger an.
    export WLR_NO_HARDWARE_CURSORS=1
  else
    echo "Unsichtbares Cursor-Theme konnte nicht erzeugt werden - Zeiger bleibt sichtbar." >&2
  fi
else
  # Zeiger wieder einblenden: nur die von uns angelegten Themes entfernen.
  for theme in "${CURSOR_THEMES[@]}"; do
    if grep -qs "Name=slot-invisible" "$CURSOR_ICONS_DIR/$theme/index.theme"; then
      rm -rf "${CURSOR_ICONS_DIR:?}/$theme"
    fi
  done
  echo "Mauszeiger sichtbar (SLOT_HIDE_CURSOR=0)."
fi

# Neustart-Überwachung: Meldet das Frontend nicht innerhalb dieser Zeit, dass es
# sichtbar auf dem Bildschirm ist (GET /health, siehe frontend/js/main.js),
# beendet sich das Script mit Fehler und systemd startet den Kiosk neu
# (Restart=always). Fängt z.B. weiße Bildschirme nach einem Kaltstart ab.
READY_TIMEOUT_SEC="${SLOT_READY_TIMEOUT_SEC:-90}"
# Solange maximal auf das Display (DRM-Ausgang "connected") warten, bevor cage startet.
DISPLAY_WAIT_SEC="${SLOT_DISPLAY_WAIT_SEC:-30}"

# Server im Hintergrund starten
"$PYTHON" "$DIR/backend/app.py" &
SERVER_PID=$!
BROWSER_PID=""

# Beim Beenden des Scripts (Strg+C, Browser zu, Fehler etc.) Browser und Server mit stoppen
cleanup() {
  [ -n "$BROWSER_PID" ] && kill "$BROWSER_PID" 2>/dev/null || true
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Warten, bis der Server erreichbar ist
echo "Warte auf Server unter $URL ..."
until curl -s -o /dev/null "$URL"; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Backend ist beim Start abgestürzt." >&2
    exit 1
  fi
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

# Nach Stromausfall bleiben Chromiums Profil-Sperrdateien liegen. Bekommt nach
# dem Booten ein anderer Prozess dieselbe PID, hält Chromium das Profil für
# belegt und startet nicht richtig. Es läuft hier immer nur ein Chromium.
for profile in "$HOME/.config/chromium" "$HOME/.config/google-chrome"; do
  rm -f "$profile/SingletonLock" "$profile/SingletonSocket" "$profile/SingletonCookie"
done

# Wartet, bis der Grafiktreiber einen angeschlossenen Bildschirm meldet. Nach
# einem Kaltstart ist das DSI-Display manchmal noch nicht bereit, wenn cage
# startet - dann bleibt der Bildschirm weiß.
wait_for_display() {
  local waited=0
  while [ "$waited" -lt "$DISPLAY_WAIT_SEC" ]; do
    if grep -qx connected /sys/class/drm/card*-*/status 2>/dev/null; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  echo "Kein angeschlossenes Display nach ${DISPLAY_WAIT_SEC}s gefunden - starte trotzdem." >&2
}

if [ -n "${WAYLAND_DISPLAY:-}" ] || [ -n "${DISPLAY:-}" ]; then
  # Es läuft bereits eine grafische Oberfläche (Desktop-Image oder PC)
  "$BROWSER" "${BROWSER_FLAGS[@]}" "$URL" &
  BROWSER_PID=$!
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
  wait_for_display
  # Innerhalb von cage erst alle Ausgaben drehen, dann Chromium starten.
  cage -- bash -c '
    rotation="$1"; shift
    if [ "$rotation" != "normal" ] && command -v wlr-randr >/dev/null 2>&1; then
      for output in $(wlr-randr | grep -E "^[^ ]" | cut -d" " -f1); do
        wlr-randr --output "$output" --transform "$rotation"
      done
    fi
    exec "$@"
  ' _ "$SLOT_ROTATION" "$BROWSER" "${BROWSER_FLAGS[@]}" --ozone-platform=wayland "$URL" &
  BROWSER_PID=$!
else
  echo "Keine grafische Oberfläche gefunden. Auf Pi OS Lite cage installieren:" >&2
  echo "  sudo apt install cage" >&2
  exit 1
fi

# Überwachung: Browser zu -> Script endet (Server stoppt via trap). Backend
# abgestürzt oder Frontend nach READY_TIMEOUT_SEC nicht sichtbar -> Exit mit
# Fehler, systemd startet alles neu.
started=$SECONDS
ready=0
while true; do
  if ! kill -0 "$BROWSER_PID" 2>/dev/null; then
    wait "$BROWSER_PID" && exit 0 || exit $?
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Backend ist abgestürzt - Neustart." >&2
    exit 1
  fi
  if [ "$ready" -eq 0 ]; then
    if curl -s "$URL/health" | grep -q '"frontend_ready": *true'; then
      ready=1
      echo "Frontend nach $((SECONDS - started))s sichtbar."
    elif [ $((SECONDS - started)) -ge "$READY_TIMEOUT_SEC" ]; then
      echo "Frontend nach ${READY_TIMEOUT_SEC}s nicht sichtbar (weißer Bildschirm?) - Neustart." >&2
      exit 1
    fi
  fi
  sleep 2
done
