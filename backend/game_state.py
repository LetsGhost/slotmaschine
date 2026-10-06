"""State-Machine für den Spielablauf.

Jede Zustandsänderung ruft den emit-Callback auf, den app.py an SocketIO bindet.
"""

import logging
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

logger = logging.getLogger(__name__)


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
        self._bet_index = 0
        self._spin_bet = config.SPIN_COST

    def current_bet(self) -> int:
        step = config.BET_STEPS[self._bet_index]
        if step == "all":
            return self.accounts.get_active_credits() or 0
        return step

    def bet_label(self) -> str | int:
        step = config.BET_STEPS[self._bet_index]
        return "ALLES" if step == "all" else step

    def cycle_bet(self) -> None:
        # Während eines Spins bleibt der Einsatz fix.
        if self.state != State.IDLE:
            return
        self._bet_index = (self._bet_index + 1) % len(config.BET_STEPS)
        self.emit("credits_update", {"bet": self.bet_label()})
        # Für den Einsatz-Sound im Frontend (Tonhöhe steigt pro Stufe).
        self.emit("bet_changed", {"index": self._bet_index, "count": len(config.BET_STEPS)})

    def pull_lever(self) -> None:
        if self.state != State.IDLE:
            return
        uid = self.accounts.active_uid
        if uid is None:
            # Frontend zeigt daraufhin den "Karte präsentieren"-Dialog (socket.js).
            self.emit("card_required", {})
            return
        bet = self.current_bet()
        if bet <= 0 or not self.accounts.deduct(uid, bet):
            self.emit("error", {"message": "Keine Credits mehr - Karte erneut auflegen zum Aufladen"})
            return

        self._spin_uid = uid
        self._spin_bet = bet
        self._emit_credits(uid)

        self._set_state(State.SPINNING)
        self._pending_result = spin()
        self._pending_multipliers = roll_multipliers()

        delay_s = max(config.SPIN_DURATION_MS) / 1000.0
        self._timer = threading.Timer(delay_s, self._on_spin_complete)
        self._timer.daemon = True
        self._timer.start()

    def _on_spin_complete(self) -> None:
        # Läuft im Timer-Thread: Eine Exception darf den Zustand nicht auf
        # SPINNING/EVALUATING hängen lassen, sonst ist kein Spin mehr möglich.
        try:
            self._evaluate_and_pay()
        except Exception:
            logger.exception("Fehler beim Auswerten des Spins")
            self._refund_after_error()
        finally:
            if self.state != State.IDLE:
                self._set_state(State.IDLE)

    def _refund_after_error(self) -> None:
        # Nur erstatten, wenn der Gewinn noch nicht gutgeschrieben wurde.
        if self.state == State.PAYOUT or self._spin_uid is None:
            return
        try:
            # Frontend hält damit die noch drehenden Walzen an (socket.js).
            self.emit("spin_aborted", {"reels": self._pending_result})
            self.accounts.add(self._spin_uid, self._spin_bet)
            self._emit_credits(self._spin_uid)
            self.emit("error", {"message": "Fehler beim Spin - Einsatz wurde erstattet"})
        except Exception:
            logger.exception("Einsatz konnte nach Fehler nicht erstattet werden")

    def _evaluate_and_pay(self) -> None:
        self._set_state(State.EVALUATING)
        winning_lines = evaluate_lines(self._pending_result, self._pending_multipliers)
        for line in winning_lines:
            line["win"] = round(line["win"] * self._spin_bet / config.SPIN_COST)
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
        jackpot = win > 0 and win >= self._spin_bet * config.JACKPOT_WIN_FACTOR
        self.emit(
            "payout",
            {"amount": win, "credits": self.accounts.balance(uid), "bet": self._spin_bet, "jackpot": jackpot},
        )
        self._emit_credits(uid)

        self._set_state(State.IDLE)

    def _emit_credits(self, uid: str) -> None:
        # Anzeige zeigt immer die aktive Karte - wurde während des Spins
        # gewechselt, nicht mit dem Guthaben der alten Karte überschreiben.
        if uid == self.accounts.active_uid:
            self.emit("credits_update", {"credits": self.accounts.balance(uid), "uid": uid, "bet": self.bet_label()})

    def _set_state(self, new_state: State) -> None:
        self.state = new_state
        self.emit("state_update", {"state": new_state.name})
