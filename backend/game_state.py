"""State-Machine für den Spielablauf.

Jede Zustandsänderung ruft den emit-Callback auf, den app.py an SocketIO bindet.
"""

import threading
from enum import Enum, auto
from typing import Callable

import config
from accounts import AccountManager
from reels import collect_multiplier_hits, evaluate_lines, roll_multipliers, spin


class State(Enum):
    IDLE = auto()
    SPINNING = auto()
    EVALUATING = auto()
    PAYOUT = auto()


EmitCallback = Callable[[str, dict], None]


class GameState:
    def __init__(self, accounts: AccountManager, emit: EmitCallback):
        self.state = State.IDLE
        self.accounts = accounts
        self.emit = emit
        self._timer: threading.Timer | None = None
        self._pending_result: list[list[str]] = []
        self._pending_multipliers: list[list[int | None]] = []
        # Karte, die den laufenden Spin bezahlt hat - bekommt auch den Gewinn,
        # selbst wenn während des Spins eine andere Karte aufgelegt wird.
        self._spin_uid: str | None = None

    def pull_lever(self) -> None:
        if self.state != State.IDLE:
            return
        uid = self.accounts.active_uid
        if uid is None:
            self.emit("error", {"message": "Keine aktive Karte - bitte Karte auflegen"})
            return
        if not self.accounts.deduct(uid, config.SPIN_COST):
            self.emit("error", {"message": "Keine Credits mehr - Karte erneut auflegen zum Aufladen"})
            return

        self._spin_uid = uid
        self._emit_credits(uid)

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
        uid = self._spin_uid
        if win > 0:
            self.accounts.add(uid, win)
        self.emit("payout", {"amount": win, "credits": self.accounts.balance(uid)})
        self._emit_credits(uid)

        self._set_state(State.IDLE)

    def _emit_credits(self, uid: str) -> None:
        # Anzeige zeigt immer die aktive Karte - wurde während des Spins
        # gewechselt, nicht mit dem Guthaben der alten Karte überschreiben.
        if uid == self.accounts.active_uid:
            self.emit("credits_update", {"credits": self.accounts.balance(uid), "uid": uid})

    def _set_state(self, new_state: State) -> None:
        self.state = new_state
        self.emit("state_update", {"state": new_state.name})
