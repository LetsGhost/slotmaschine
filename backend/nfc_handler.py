"""NFC-Kartenleser (PN532 über I2C), mit Mock-Fallback für Entwicklung am PC.

Im Mock-Modus kommen Kartenscans über das SocketIO-Event 'debug_nfc_scan'
(siehe app.py) statt vom Reader.
"""

import logging
import threading
import time
from typing import Callable

import config

logger = logging.getLogger(__name__)


class CardDebouncer:
    """Macht aus dem kontinuierlichen Polling einzelne "Karte aufgelegt"-Events.

    Eine liegen gelassene Karte zählt genau einmal. Erst wenn der Reader die
    Karte länger als NFC_DEBOUNCE_SEC nicht mehr sieht, gilt sie als entfernt -
    kurze Lesaussetzer während des Auflegens lösen also kein zweites Event aus.
    Eine andere Karte zählt sofort.
    """

    def __init__(self, debounce_sec: float = config.NFC_DEBOUNCE_SEC):
        self.debounce_sec = debounce_sec
        self.present_uid: str | None = None
        self.last_seen = 0.0

    def feed(self, uid: str | None, now: float) -> str | None:
        """Gibt die UID zurück, wenn dieser Poll als neues Auflegen zählt, sonst None."""
        if uid is None:
            if self.present_uid is not None and now - self.last_seen > self.debounce_sec:
                self.present_uid = None
            return None
        if uid == self.present_uid:
            self.last_seen = now
            return None
        self.present_uid = uid
        self.last_seen = now
        return uid


def format_uid(raw: bytes | bytearray) -> str:
    return ":".join(f"{b:02X}" for b in raw)


class NFCHandler:
    def __init__(self, on_scan: Callable[[str], None]):
        self.on_scan = on_scan
        self._mock = False
        self.pn532 = None
        self._thread: threading.Thread | None = None

        try:
            import board
            import busio
            from adafruit_pn532.i2c import PN532_I2C

            i2c = busio.I2C(board.SCL, board.SDA)
            self.pn532 = PN532_I2C(i2c, debug=False)
            self.pn532.SAM_configuration()
            logger.info("PN532 NFC-Reader aktiv (I2C)")
        except Exception as exc:
            self._mock = True
            logger.info(
                "PN532/Hardware nicht verfügbar (%s) - NFC-Mock-Modus aktiv. "
                "Kartenscan per SocketIO-Event 'debug_nfc_scan' {\"uid\": ...} simulieren.",
                exc,
            )

    @property
    def is_mock(self) -> bool:
        return self._mock

    def start(self) -> None:
        if self._mock or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="nfc-poll", daemon=True)
        self._thread.start()

    def _read_uid(self) -> str | None:
        raw = self.pn532.read_passive_target(timeout=config.NFC_READ_TIMEOUT_SEC)
        return format_uid(raw) if raw else None

    def _loop(self) -> None:
        debouncer = CardDebouncer()
        while True:
            try:
                uid = debouncer.feed(self._read_uid(), time.monotonic())
                if uid:
                    self.on_scan(uid)
            except Exception:
                # Ein I2C-Hänger darf den Poll-Thread nicht dauerhaft beenden.
                logger.exception("Fehler beim Lesen des NFC-Readers")
                time.sleep(1.0)
            time.sleep(config.NFC_POLL_INTERVAL_SEC)

    def trigger_mock(self, uid: str) -> None:
        if self._mock:
            self.on_scan(uid)
