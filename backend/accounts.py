"""NFC-Kartenkonten: Guthaben pro Karten-UID mit JSON-Persistenz.

Ersetzt die alte globale credits.py. Die aktive Karte (active_uid) lebt nur im
Arbeitsspeicher - nach einem Neustart muss die Karte einmal neu aufgelegt
werden, bevor gespielt werden kann.
"""

import json
import os
import threading

import config

ACCOUNTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), config.ACCOUNTS_FILE)


class AccountManager:
    def __init__(self, path: str | None = None):
        self.path = path or ACCOUNTS_PATH
        # NFC-Thread (handle_card) und Spin-Timer (add) schreiben parallel.
        self._lock = threading.RLock()
        self.accounts: dict[str, dict] = self._load()  # { uid: {"credits": int} }
        self.active_uid: str | None = None

    def _load(self) -> dict:
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    return data
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _save(self) -> None:
        # Erst in Temp-Datei schreiben und dann atomar ersetzen, damit ein
        # Stromausfall am Pi nie eine halb geschriebene accounts.json hinterlässt.
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.accounts, f, indent=2)
        os.replace(tmp, self.path)

    def handle_card(self, uid: str) -> tuple[str, int]:
        """Verarbeitet einen erkannten Kartenscan. Gibt (event_type, credits) zurück:
        - "created"   -> neues Konto angelegt (0 Credits), sofort aktiv
        - "logged_in" -> bekannte, bisher nicht aktive Karte wird aktiv (kein Aufladen)
        - "topped_up" -> dieselbe, bereits aktive Karte erneut aufgelegt (+NFC_TOPUP_AMOUNT)
        """
        with self._lock:
            if uid not in self.accounts:
                self.accounts[uid] = {"credits": 0}
                self._save()
                self.active_uid = uid
                return "created", 0

            if self.active_uid == uid:
                self.accounts[uid]["credits"] += config.NFC_TOPUP_AMOUNT
                self._save()
                return "topped_up", self.accounts[uid]["credits"]

            self.active_uid = uid
            return "logged_in", self.accounts[uid]["credits"]

    def get_active_credits(self) -> int | None:
        with self._lock:
            if self.active_uid is None:
                return None
            return self.accounts[self.active_uid]["credits"]

    def balance(self, uid: str) -> int:
        with self._lock:
            return self.accounts.get(uid, {}).get("credits", 0)

    def deduct(self, uid: str, amount: int) -> bool:
        with self._lock:
            if uid not in self.accounts or self.accounts[uid]["credits"] < amount:
                return False
            self.accounts[uid]["credits"] -= amount
            self._save()
            return True

    def add(self, uid: str, amount: int) -> bool:
        # Explizite UID statt "aktive Karte": Wird während eines Spins die Karte
        # gewechselt, muss der Gewinn trotzdem auf die Karte, die gesetzt hat.
        with self._lock:
            if uid not in self.accounts:
                return False
            self.accounts[uid]["credits"] += amount
            self._save()
            return True
