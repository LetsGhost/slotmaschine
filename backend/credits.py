"""Credit-Verwaltung mit JSON-Persistenz über Neustarts hinweg."""

import json
import os

import config


class CreditManager:
    def __init__(self, path: str | None = None):
        self.path = path or config.CREDITS_FILE
        self._credits = self._load()

    def _load(self) -> int:
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return int(data.get("credits", config.STARTING_CREDITS))
            except (json.JSONDecodeError, OSError, ValueError):
                pass
        return config.STARTING_CREDITS

    def _save(self) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump({"credits": self._credits}, f)

    def balance(self) -> int:
        return self._credits

    def add(self, amount: int) -> int:
        self._credits += amount
        self._save()
        return self._credits

    def subtract(self, amount: int) -> int:
        self._credits = max(0, self._credits - amount)
        self._save()
        return self._credits
