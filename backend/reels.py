"""Symbol-Ziehung und Gewinnauswertung. Unit-testbar ohne Flask/GPIO."""

import json
import os
import random

import config

# Debug-Override für chance_per_symbol (z.B. über den Debug-Slider im
# Frontend gesetzt), damit man beim Testen mehr/weniger Multiplikatoren pro
# Spin bekommt, ohne backend/multiplier_config.json anzufassen. None = kein
# Override, es gilt der Wert aus der JSON-Datei. Lebt nur für die Laufzeit
# des Prozesses (kein Neustart-Schutz nötig, ist reines Debug-Feature).
_debug_chance_override: float | None = None


def set_debug_multiplier_chance(value: float | None) -> None:
    """Setzt/löscht den Debug-Override für chance_per_symbol. `value=None`
    setzt zurück auf den Wert aus multiplier_config.json."""
    global _debug_chance_override
    _debug_chance_override = None if value is None else max(0.0, min(1.0, value))


def get_effective_multiplier_chance() -> float:
    """Aktuell wirksame chance_per_symbol: Debug-Override falls gesetzt,
    sonst der Wert aus multiplier_config.json - für die Anzeige im Frontend
    (Debug-Slider) beim Verbinden."""
    if _debug_chance_override is not None:
        return _debug_chance_override
    return _load_multiplier_config().get("chance_per_symbol", 0.0)


def _load_multiplier_config() -> dict:
    """Lädt backend/multiplier_config.json bei jedem Aufruf neu (billige Datei,
    kein Caching nötig), damit Balancing-Änderungen ohne Server-Neustart
    wirksam werden. Fehlt die Datei oder ist sie kaputt, ist das Feature aus."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), config.MULTIPLIER_CONFIG_FILE)
    defaults = {
        "enabled": False,
        "chance_per_symbol": 0.0,
        "values": [],
        "weights": [],
        "combine_mode": "sum",
    }
    try:
        with open(path, "r", encoding="utf-8") as f:
            defaults.update(json.load(f))
    except (OSError, json.JSONDecodeError):
        pass
    return defaults


def spin() -> list[list[str]]:
    """Zieht das 5x3-Walzenfeld: Liste von GRID_ROWS Reihen à GRID_COLS Symbole
    (grid[reihe][spalte]), jede Position unabhängig gewichtet gezogen."""
    return [
        random.choices(config.SYMBOLS, weights=config.WEIGHTS, k=config.GRID_COLS)
        for _ in range(config.GRID_ROWS)
    ]


def roll_multipliers() -> list[list[int | None]]:
    """Würfelt unabhängig pro Feld-Position, ob dort ein Gewinn-Multiplikator
    sichtbar wird (Chance/Werte/Gewichte aus multiplier_config.json). Gleiche
    Form wie das Symbolfeld (grid[reihe][spalte]); None = kein Multiplikator.
    Ein gewürfelter Multiplikator zählt für die Auszahlung nur, wenn die Position
    Teil einer gewinnenden Payline-Kette ist (siehe evaluate_lines) - unabhängig
    davon wird er aber immer im Frontend unter dem Symbol angezeigt."""
    cfg = _load_multiplier_config()
    values = cfg.get("values") or []
    weights = cfg.get("weights") or [1] * len(values)
    chance = get_effective_multiplier_chance()
    enabled = bool(cfg.get("enabled")) and bool(values)

    grid: list[list[int | None]] = []
    for _ in range(config.GRID_ROWS):
        row: list[int | None] = []
        for _ in range(config.GRID_COLS):
            if enabled and random.random() < chance:
                row.append(random.choices(values, weights=weights)[0])
            else:
                row.append(None)
        grid.append(row)
    return grid


def _combine_multipliers(values: list[int], mode: str) -> int:
    """Kombiniert alle Multiplikatoren einer gewinnenden Kette zu einem
    Linien-Multiplikator. Ohne Treffer (keine Position der Kette hat einen
    Multiplikator) bleibt der Gewinn unverändert (Faktor 1)."""
    if not values:
        return 1
    if mode == "product":
        result = 1
        for value in values:
            result *= value
        return result
    return sum(values)  # "sum" (Default) - jeder Treffer-Multiplikator zählt für sich


def evaluate_lines(
    grid: list[list[str]], multipliers: list[list[int | None]] | None = None
) -> list[dict]:
    """Wertet jede Payline (config.PAYLINES) aus und gibt Details zu allen
    gewinnenden Linien zurück, u.a. für die Gewinnlinien-Anzeige im Frontend:
    [{"line", "symbol", "count", "base_win", "multiplier", "win",
    "multiplier_hits"}, ...] (nur Linien mit win > 0). `multipliers` (siehe
    roll_multipliers) wird nur für die tatsächlich zählenden ersten `count`
    Positionen der Linie berücksichtigt. `multiplier_hits` listet genau diese
    Treffer als [{"row", "col", "value"}, ...] - für collect_multiplier_hits
    bzw. die Overlay-Animationssequenz im Frontend (siehe socket.js)."""
    combine_mode = _load_multiplier_config().get("combine_mode", "sum")

    results = []
    for line_index, line in enumerate(config.PAYLINES):
        symbols = [grid[row][col] for col, row in line]
        first = symbols[0]
        count = 1
        for symbol in symbols[1:]:
            if symbol != first:
                break
            count += 1
        base_win = config.PAYOUTS.get(first, {}).get(count, 0)
        if base_win <= 0:
            continue

        applied = []
        hit_positions = []
        if multipliers:
            for col, row in line[:count]:
                value = multipliers[row][col]
                if value:
                    applied.append(value)
                    hit_positions.append({"row": row, "col": col, "value": value})
        line_multiplier = _combine_multipliers(applied, combine_mode)

        results.append(
            {
                "line": line_index,
                "symbol": first,
                "count": count,
                "base_win": base_win,
                "multiplier": line_multiplier,
                "win": base_win * line_multiplier,
                "multiplier_hits": hit_positions,
            }
        )
    return results


def collect_multiplier_hits(winning_lines: list[dict]) -> list[dict]:
    """Sammelt alle einzigartigen Multiplikator-Treffer (Feld-Positionen mit
    Multiplikator, die Teil einer gewinnenden Kette sind) über alle gewinnenden
    Linien hinweg - dieselbe Position zählt nur einmal, auch wenn sie z.B.
    gleichzeitig auf der mittleren Reihe und der V-Form gewinnt. Ergebnis:
    [{"row", "col", "value"}, ...]. Die Anzahl steuert im Frontend, wie viele
    Overlay-Animationen nacheinander gezeigt werden (eine pro Treffer)."""
    seen = set()
    hits = []
    for line in winning_lines:
        for hit in line.get("multiplier_hits", []):
            key = (hit["row"], hit["col"])
            if key not in seen:
                seen.add(key)
                hits.append(hit)
    return hits


def evaluate(grid: list[list[str]], multipliers: list[list[int | None]] | None = None) -> int:
    """Summiert die Gewinne aller Paylines für das Walzenfeld."""
    return sum(line["win"] for line in evaluate_lines(grid, multipliers))
