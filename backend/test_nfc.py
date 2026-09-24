"""Automatische Tests für Phase 5 (NFC-Kartenkonten), ohne Hardware und ohne Server.

Nutzung:
    cd backend
    python -m unittest test_nfc -v
"""

import os
import tempfile
import unittest
from unittest import mock

import config
from accounts import AccountManager
from game_state import GameState, State
from nfc_handler import CardDebouncer


class TempAccountsMixin:
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        os.remove(self.path)
        self.accounts = AccountManager(self.path)

    def tearDown(self):
        if os.path.exists(self.path):
            os.remove(self.path)


class AccountFlowTest(TempAccountsMixin, unittest.TestCase):
    def test_full_card_flow(self):
        self.assertEqual(self.accounts.handle_card("A"), ("created", 0))
        self.assertEqual(self.accounts.handle_card("A"), ("topped_up", config.NFC_TOPUP_AMOUNT))
        self.assertEqual(self.accounts.handle_card("B"), ("created", 0))
        self.assertEqual(self.accounts.active_uid, "B")
        # Zurück auf A: Login, kein Aufladen
        self.assertEqual(self.accounts.handle_card("A"), ("logged_in", config.NFC_TOPUP_AMOUNT))
        self.assertEqual(self.accounts.handle_card("A"), ("topped_up", 2 * config.NFC_TOPUP_AMOUNT))

    def test_persistence_without_active_card(self):
        self.accounts.handle_card("A")
        self.accounts.handle_card("A")
        reloaded = AccountManager(self.path)
        self.assertEqual(reloaded.balance("A"), config.NFC_TOPUP_AMOUNT)
        self.assertIsNone(reloaded.active_uid)
        self.assertIsNone(reloaded.get_active_credits())
        # Nach Neustart: erstes Auflegen ist Login, nicht Aufladen
        self.assertEqual(reloaded.handle_card("A"), ("logged_in", config.NFC_TOPUP_AMOUNT))

    def test_deduct_refuses_overdraft(self):
        self.accounts.handle_card("A")
        self.assertFalse(self.accounts.deduct("A", 1))
        self.assertFalse(self.accounts.deduct("UNKNOWN", 1))

    def test_corrupt_file_starts_empty(self):
        with open(self.path, "w") as f:
            f.write("{kaputt")
        self.assertEqual(AccountManager(self.path).accounts, {})


class DebouncerTest(unittest.TestCase):
    def feed_all(self, polls):
        d = CardDebouncer(debounce_sec=1.5)
        return [d.feed(uid, t) for t, uid in polls]

    def test_card_left_on_reader_counts_once(self):
        polls = [(t * 0.2, "A") for t in range(50)]  # 10s liegen lassen
        self.assertEqual([u for u in self.feed_all(polls) if u], ["A"])

    def test_short_read_dropouts_do_not_retrigger(self):
        polls = [(0.0, "A"), (0.2, None), (0.4, None), (0.6, "A"), (0.8, "A")]
        self.assertEqual([u for u in self.feed_all(polls) if u], ["A"])

    def test_remove_and_replace_counts_twice(self):
        polls = [(0.0, "A"), (0.2, None), (2.0, None), (2.2, "A")]
        self.assertEqual([u for u in self.feed_all(polls) if u], ["A", "A"])

    def test_card_swap_counts_immediately(self):
        polls = [(0.0, "A"), (0.2, "B"), (0.4, "A")]
        self.assertEqual([u for u in self.feed_all(polls) if u], ["A", "B", "A"])


class GameStateNfcTest(TempAccountsMixin, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.events = []
        self.game = GameState(self.accounts, lambda e, p: self.events.append((e, p)))
        # Timer nicht wirklich starten - _on_spin_complete wird manuell aufgerufen.
        patcher = mock.patch("game_state.threading.Timer")
        patcher.start()
        self.addCleanup(patcher.stop)

    def errors(self):
        return [p["message"] for e, p in self.events if e == "error"]

    def test_no_active_card_blocks_spin(self):
        self.game.pull_lever()
        self.assertEqual(self.game.state, State.IDLE)
        self.assertIn("Keine aktive Karte", self.errors()[0])

    def test_zero_credits_blocks_spin(self):
        self.accounts.handle_card("A")
        self.game.pull_lever()
        self.assertEqual(self.game.state, State.IDLE)
        self.assertIn("Keine Credits", self.errors()[0])

    def test_spin_deducts_from_active_card(self):
        self.accounts.handle_card("A")
        self.accounts.handle_card("A")
        self.game.pull_lever()
        self.assertEqual(self.game.state, State.SPINNING)
        self.assertEqual(self.accounts.balance("A"), config.NFC_TOPUP_AMOUNT - config.SPIN_COST)

    def test_win_goes_to_card_that_paid_even_after_swap(self):
        self.accounts.handle_card("A")
        self.accounts.handle_card("A")
        self.accounts.handle_card("B")
        self.accounts.handle_card("A")
        self.game.pull_lever()
        self.accounts.handle_card("B")  # Kartenwechsel mitten im Spin
        with mock.patch("game_state.evaluate_lines", return_value=[{"win": 50}]), \
             mock.patch("game_state.collect_multiplier_hits", return_value=[]):
            self.game._on_spin_complete()
        self.assertEqual(self.accounts.balance("A"), config.NFC_TOPUP_AMOUNT - config.SPIN_COST + 50)
        self.assertEqual(self.accounts.balance("B"), 0)
        # Bei der Auszahlung kein credits_update für die inzwischen inaktive
        # Karte A - das einzige stammt vom Spin-Start.
        credit_updates = [p for e, p in self.events if e == "credits_update"]
        self.assertEqual(len(credit_updates), 1)
        self.assertEqual(self.game.state, State.IDLE)


if __name__ == "__main__":
    unittest.main()
