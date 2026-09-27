#!/usr/bin/env bash
# Bindet den Goodix-Touch-Treiber des DSI-Displays neu, falls er beim Booten
# fehlgeschlagen ist. Der Touch-Chip ist beim ersten Probe (~11s nach Boot)
# oft noch nicht bereit ("I2C communication failure: -5"), dann gibt es kein
# Touch-Eingabegerät. Ein erneutes Binden klappt danach zuverlässig.
# Läuft als root über deploy/slotmachine-touch.service.

DEVICE="${TOUCH_I2C_DEVICE:-10-005d}"
DRIVER_DIR=/sys/bus/i2c/drivers/Goodix-TS
ATTEMPTS=15

for i in $(seq 1 "$ATTEMPTS"); do
  if [ -e "$DRIVER_DIR/$DEVICE" ]; then
    echo "Touch-Treiber für $DEVICE gebunden (Versuch $i)."
    exit 0
  fi
  if [ -e "/sys/bus/i2c/devices/$DEVICE" ] && [ -e "$DRIVER_DIR/bind" ]; then
    echo "Touch $DEVICE nicht gebunden - binde neu (Versuch $i/$ATTEMPTS) ..."
    echo "$DEVICE" > "$DRIVER_DIR/bind" 2>/dev/null || true
  fi
  sleep 2
done

echo "Touch-Treiber für $DEVICE konnte nicht gebunden werden." >&2
exit 1
