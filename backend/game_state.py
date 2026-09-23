"""State-Machine für den Spielablauf.

Jede Zustandsänderung ruft den emit-Callback auf, den app.py an SocketIO bindet.
"""

import threading
from enum import Enum, auto
from typing import Callable

import config
from credits import CreditManager
from reels import collect_multiplier_hits, evaluate_lines, roll_multipliers, spin


class State(Enum):
    IDLE = auto()
    SPINNING = auto()
    EVALUATING = auto()
    PAYOUT = auto()


EmitCallback = Callable[[str, dict], None]


class GameState:
    def __init__(self, credit_manager: CreditManager, emit: EmitCallback):
        self.state = State.IDLE
        self.credits = credit_manager
        self.emit = emit
        self._timer: threading.Timer | None = None
        self._pending_result: list[list[str]] = []
        self._pending_multipliers: list[list[int | None]] = []

    def pull_lever(self) -> None:
        if self.state != State.IDLE:
            return
        if self.credits.balance() < config.SPIN_COST:
            self.emit("error", {"message": "Keine Credits mehr"})
            return

        self.credits.subtract(config.SPIN_COST)
        self.emit("credits_update", {"credits": self.credits.balance()})

        self._set_state(State.SPINNING)
        self._pending_result = spin()
        self._pending_multipliers = roll_multipliers()

        delay_s = max(config.SPIN_DURATION_MS) / 1000.0
        self._timer = threading.Timer(delay_s, self._on_spin_complete)
        self._timer.daemon = True
        self._timer.start()

    def _on_spin_complete(self) -> None:
        self._set_state(State.EVALUATING)
        winning_lines = evaluate_lines(self._pending_result, self._pending_multipliers)
        win = sum(line["win"] for line in winning_lines)
        self.emit(
            "spin_result",
            {
                "reels": self._pending_result,
                "multipliers": self._pending_multipliers,
                "multiplier_hits": collect_multiplier_hits(winning_lines),
                "win": win,
                "winning_lines": winning_lines,
            },
        )

        self._set_state(State.PAYOUT)
        if win > 0:
            self.credits.add(win)
        self.emit("payout", {"amount": win, "credits": self.credits.balance()})
        self.emit("credits_update", {"credits": self.credits.balance()})

        self._set_state(State.IDLE)

    def _set_state(self, new_state: State) -> None:
        self.state = new_state
        self.emit("state_update", {"state": new_state.name})
