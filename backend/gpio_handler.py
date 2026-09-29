"""Hebel/Button-Input über gpiozero, mit Mock-Fallback für Entwicklung am PC."""

import logging
from typing import Callable

logger = logging.getLogger(__name__)


class GPIOHandler:
    def __init__(self, pin: int, on_pull: Callable[[], None], active_high: bool = False):
        self.on_pull = on_pull
        self._mock = False
        self.button = None

        try:
            from gpiozero import Button

            # active_high: interner Pull-down, gedrückt = HIGH (Grove-Module)
            self.button = Button(pin, pull_up=not active_high, bounce_time=0.05)
            self.button.when_pressed = self._trigger
            logger.info("GPIO aktiv auf Pin %s (%s)", pin, "active-high" if active_high else "active-low")
        except Exception as exc:
            self._mock = True
            logger.info(
                "gpiozero/Hardware nicht verfügbar (%s) - Mock-Modus aktiv. "
                "Hebelzug per POST /debug/pull oder SocketIO-Event 'debug_pull_lever' simulieren.",
                exc,
            )

    def _trigger(self) -> None:
        self.on_pull()

    @property
    def is_mock(self) -> bool:
        return self._mock

    def trigger_mock(self) -> None:
        if self._mock:
            self.on_pull()
