"""Hebel/Button-Input über gpiozero, mit Mock-Fallback für Entwicklung am PC."""

import logging
from typing import Callable

logger = logging.getLogger(__name__)


class GPIOHandler:
    def __init__(self, pin: int, on_pull: Callable[[], None]):
        self.on_pull = on_pull
        self._mock = False
        self.button = None

        try:
            from gpiozero import Button

            self.button = Button(pin)
            self.button.when_pressed = self._trigger
            logger.info("GPIO aktiv auf Pin %s", pin)
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
