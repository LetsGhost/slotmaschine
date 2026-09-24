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

# Balancing für das Multiplikator-Feature (Chance/Werte/Gewichte/Kombinationslogik)
# liegt in dieser JSON-Datei statt hier in Python, damit es sich ohne Codeänderung
# tunen lässt (siehe reels.py: roll_multipliers/evaluate_lines).
MULTIPLIER_CONFIG_FILE = "multiplier_config.json"

GPIO_LEVER_PIN = 17

# Debug-Modus (Debug-Panel sichtbar, Stage in Originalgröße statt auf den
# Viewport skaliert). Gesteuert über die Umgebungsvariable SLOT_DEBUG
# (1/true/yes/on bzw. 0/false/no/off). Nicht gesetzt => automatisch an, wenn
# GPIO im Mock-Modus läuft (PC), aus auf dem Pi mit echter Hardware.
DEBUG_ENV_VAR = "SLOT_DEBUG"

# VORÜBERGEHEND: Tippen auf den Bildschirm löst einen Spin aus (auch mit echter
# GPIO-Hardware), solange der Hebel noch nicht verbaut ist. Zum Entfernen auf
# False setzen (oder Handler "tap_pull_lever" in app.py + Listener in
# frontend/js/socket.js löschen).
TAP_TO_SPIN = True

# NFC-Kartenkonten (siehe accounts.py / nfc_handler.py). Guthaben pro Karten-UID,
# relativ zum backend-Ordner gespeichert.
ACCOUNTS_FILE = "accounts.json"
NFC_TOPUP_AMOUNT = 100
# Solange muss eine Karte vom Reader weg sein, bevor erneutes Auflegen wieder
# zählt - verhindert Mehrfach-Aufladen bei liegen gelassener Karte bzw. kurzen
# Lesaussetzern.
NFC_DEBOUNCE_SEC = 1.5
NFC_POLL_INTERVAL_SEC = 0.2
NFC_READ_TIMEOUT_SEC = 0.5
