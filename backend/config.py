"""Zentrale Konstanten für Balancing und Timing."""

SYMBOLS = ["cherry", "lemon", "bell", "star", "seven"]
WEIGHTS = [40, 30, 15, 10, 5]

GRID_COLS = 5
GRID_ROWS = 3

# Auszahlung je Symbol für 3/4/5 gleiche Symbole in Folge von links auf einer
# Payline (siehe PAYLINES). Fehlende Einträge (z.B. nur 2 Treffer) zahlen nichts.
PAYOUTS = {
    "cherry": {3: 5, 4: 12, 5: 40},
    "lemon": {3: 8, 4: 20, 5: 60},
    "bell": {3: 15, 4: 40, 5: 120},
    "star": {3: 30, 4: 80, 5: 250},
    "seven": {3: 100, 4: 300, 5: 1000},
}

# 5 feste Gewinnlinien über das 5x3-Feld, als (spalte, reihe)-Koordinaten von
# links nach rechts (reihe 0 = oben, reihe 2 = unten): obere/mittlere/untere
# Reihe sowie V- und Lambda-Form. Jede Linie wird unabhängig ausgewertet und
# gewonnene Linien werden zum Gesamtgewinn aufsummiert.
PAYLINES = [
    [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)],  # mittlere Reihe
    [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0)],  # obere Reihe
    [(0, 2), (1, 2), (2, 2), (3, 2), (4, 2)],  # untere Reihe
    [(0, 0), (1, 1), (2, 2), (3, 1), (4, 0)],  # V-Form
    [(0, 2), (1, 1), (2, 0), (3, 1), (4, 2)],  # Lambda-Form (umgekehrtes V)
]

SPIN_DURATION_MS = [1200, 1500, 1800, 2100, 2400]  # pro Spalte, damit sie nacheinander stoppen
SPIN_COST = 10
STARTING_CREDITS = 100

# Balancing für das Multiplikator-Feature (Chance/Werte/Gewichte/Kombinationslogik)
# liegt in dieser JSON-Datei statt hier in Python, damit es sich ohne Codeänderung
# tunen lässt (siehe reels.py: roll_multipliers/evaluate_lines).
MULTIPLIER_CONFIG_FILE = "multiplier_config.json"

GPIO_LEVER_PIN = 17

CREDITS_FILE = "credits.json"
