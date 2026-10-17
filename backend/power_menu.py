"""Admin-Karte: Pi sicher herunterfahren bzw. neu starten - ohne extra Knopf.

Ablauf:
- Admin-Karte auflegen -> Menü "Herunterfahren?" erscheint.
- Karte ADMIN_REBOOT_HOLD_SEC liegen lassen -> Menü wechselt auf "Neu starten?".
- Hebel ziehen bestätigt die gerade angezeigte Aktion.
- Ohne Hebelzug schließt sich das Menü nach ADMIN_CONFIRM_TIMEOUT_SEC von
  selbst (Tipp auf den Bildschirm bricht sofort ab).

Ausgeführt wird "sudo -n systemctl poweroff/reboot" - dafür braucht der
Kiosk-User die sudoers-Regel aus deploy/slotmachine-power.sudoers (installiert
deploy/update-service.sh). Im dry_run (PC, NFC-Mock) wird nur geloggt.
"""

import logging
import subprocess
import threading
from typing import Callable

import config

logger = logging.getLogger(__name__)

EmitCallback = Callable[[str, dict], None]

COMMANDS = {
    "shutdown": ["sudo", "-n", "/usr/bin/systemctl", "poweroff"],
    "reboot": ["sudo", "-n", "/usr/bin/systemctl", "reboot"],
}


class PowerMenu:
    def __init__(self, emit: EmitCallback, dry_run: bool):
        self.emit = emit
        self.dry_run = dry_run
        # NFC-Thread (open/card_held), GPIO-Thread (confirm) und Timeout-Timer
        # greifen parallel zu.
        self._lock = threading.Lock()
        self.action: str | None = None  # None = Menü geschlossen
        self._timer: threading.Timer | None = None
        self._executing = False

    @property
    def is_open(self) -> bool:
        return self.action is not None

    def open(self) -> None:
        """Admin-Karte neu aufgelegt -> Menü (erneut) auf "Herunterfahren"."""
        with self._lock:
            if not self._executing:
                self._set_action("shutdown")

    def card_held(self, held_sec: float) -> None:
        """Admin-Karte liegt weiter auf dem Reader (seit held_sec Sekunden)."""
        with self._lock:
            if self.action == "shutdown" and held_sec >= config.ADMIN_REBOOT_HOLD_SEC:
                self._set_action("reboot")

    def cancel(self) -> None:
        with self._lock:
            if self.action is not None and not self._executing:
                self._close()

    def confirm(self) -> bool:
        """Hebelzug. True = vom Menü verbraucht (kein Spin), False = Menü zu."""
        with self._lock:
            if self._executing:
                return True
            if self.action is None:
                return False
            action = self.action
            self._cancel_timer()
            self._executing = True
        self.emit("power_executing", {"action": action})
        self._run(action)
        return True

    def _run(self, action: str) -> None:
        cmd = COMMANDS[action]
        if self.dry_run:
            logger.info("Power-Menü (dry run, NFC-Mock): würde '%s' ausführen", " ".join(cmd))
            self._reset_after_run()
            return
        logger.info("Power-Menü: führe '%s' aus", " ".join(cmd))
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.error("Power-Menü: '%s' fehlgeschlagen: %s", " ".join(cmd), exc)
            self._fail()
            return
        if result.returncode != 0:
            logger.error(
                "Power-Menü: '%s' fehlgeschlagen (Exit %s): %s - sudoers-Regel eingerichtet? "
                "(siehe deploy/slotmachine-power.sudoers)",
                " ".join(cmd),
                result.returncode,
                result.stderr.strip(),
            )
            self._fail()

    def _fail(self) -> None:
        self._reset_after_run()
        self.emit("error", {"message": "Herunterfahren fehlgeschlagen – siehe Log"})

    def _reset_after_run(self) -> None:
        with self._lock:
            self._executing = False
            self._close()

    # --- Nur mit gehaltenem self._lock aufrufen ---

    def _set_action(self, action: str) -> None:
        self.action = action
        self._cancel_timer()
        self._timer = threading.Timer(config.ADMIN_CONFIRM_TIMEOUT_SEC, self.cancel)
        self._timer.daemon = True
        self._timer.start()
        self.emit(
            "power_menu",
            {
                "action": action,
                "timeout": config.ADMIN_CONFIRM_TIMEOUT_SEC,
                "reboot_hold": config.ADMIN_REBOOT_HOLD_SEC,
            },
        )

    def _close(self) -> None:
        self.action = None
        self._cancel_timer()
        self.emit("power_menu", {"action": None})

    def _cancel_timer(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
