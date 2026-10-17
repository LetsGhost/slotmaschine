"""Tests fürs Power-Menü der Admin-Karte (power_menu.py), ohne Hardware.

Nutzung:
    cd backend
    python -m unittest test_power_menu -v
"""

import unittest
from unittest import mock

import config
from nfc_handler import CardDebouncer
from power_menu import PowerMenu


class PowerMenuTest(unittest.TestCase):
    def setUp(self):
        self.events = []
        self.menu = PowerMenu(lambda event, payload: self.events.append((event, payload)), dry_run=False)
        run = mock.patch("power_menu.subprocess.run", return_value=mock.Mock(returncode=0, stderr=""))
        self.run = run.start()
        self.addCleanup(run.stop)
        self.addCleanup(self.menu._cancel_timer)

    def test_lever_without_menu_is_not_consumed(self):
        self.assertFalse(self.menu.confirm())
        self.run.assert_not_called()

    def test_place_and_pull_shuts_down(self):
        self.menu.open()
        self.assertEqual(self.menu.action, "shutdown")
        self.assertTrue(self.menu.confirm())
        self.assertEqual(self.run.call_args.args[0][-1], "poweroff")

    def test_hold_switches_to_reboot(self):
        self.menu.open()
        self.menu.card_held(config.ADMIN_REBOOT_HOLD_SEC - 0.1)
        self.assertEqual(self.menu.action, "shutdown")
        self.menu.card_held(config.ADMIN_REBOOT_HOLD_SEC)
        self.assertEqual(self.menu.action, "reboot")
        self.menu.confirm()
        self.assertEqual(self.run.call_args.args[0][-1], "reboot")

    def test_hold_without_open_menu_does_nothing(self):
        self.menu.card_held(60)
        self.assertIsNone(self.menu.action)

    def test_cancel_closes_menu(self):
        self.menu.open()
        self.menu.cancel()
        self.assertIsNone(self.menu.action)
        self.assertEqual(self.events[-1], ("power_menu", {"action": None}))
        self.assertFalse(self.menu.confirm())

    def test_failed_command_reopens_for_play(self):
        self.run.return_value = mock.Mock(returncode=1, stderr="sudo: a password is required")
        self.menu.open()
        self.assertTrue(self.menu.confirm())
        self.assertIsNone(self.menu.action)
        self.assertEqual(self.events[-1][0], "error")
        # Danach spielt der Hebel wieder normal.
        self.assertFalse(self.menu.confirm())

    def test_dry_run_never_calls_systemctl(self):
        self.menu.dry_run = True
        self.menu.open()
        self.menu.confirm()
        self.run.assert_not_called()


class DebouncerHoldTest(unittest.TestCase):
    def test_held_sec_counts_from_placement(self):
        d = CardDebouncer(debounce_sec=1.5)
        d.feed("ADMIN", 10.0)
        d.feed("ADMIN", 13.0)
        self.assertAlmostEqual(d.held_sec(), 3.0)
        # Lesaussetzer zählt nicht als gehalten
        d.feed(None, 14.0)
        self.assertAlmostEqual(d.held_sec(), 3.0)


if __name__ == "__main__":
    unittest.main()
