"""Flask + SocketIO Setup. Liefert das Frontend aus und verdrahtet GPIO/NFC/State-Machine mit SocketIO."""

import os

from flask import Flask, Response, jsonify
from flask_socketio import SocketIO

import config
import reels
from accounts import AccountManager
from game_state import GameState
from gpio_handler import GPIOHandler
from nfc_handler import NFCHandler

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
socketio = SocketIO(app, cors_allowed_origins="*")

account_manager = AccountManager()


def emit_event(event: str, payload: dict) -> None:
    socketio.emit(event, payload)


# Karten-Event -> SocketIO-Event fürs Frontend (socket.js).
NFC_EVENTS = {
    "created": "account_created",
    "logged_in": "account_login",
    "topped_up": "account_topup",
}


def emit_credits() -> None:
    socketio.emit(
        "credits_update",
        {"credits": account_manager.get_active_credits(), "uid": account_manager.active_uid, "bet": config.SPIN_COST},
    )


def handle_card_scan(uid: str) -> None:
    event_type, credits = account_manager.handle_card(uid)
    payload = {"uid": uid, "credits": credits}
    if event_type == "topped_up":
        payload["amount"] = config.NFC_TOPUP_AMOUNT
    socketio.emit(NFC_EVENTS[event_type], payload)
    emit_credits()


game = GameState(account_manager, emit_event)
gpio = GPIOHandler(config.GPIO_LEVER_PIN, game.pull_lever)
nfc = NFCHandler(handle_card_scan)


def _resolve_debug_mode() -> bool:
    raw = os.environ.get(config.DEBUG_ENV_VAR, "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return gpio.is_mock


DEBUG_MODE = _resolve_debug_mode()


@app.route("/")
def index():
    # Debug-Modus als Klasse am <body> mitgeben, damit CSS/JS schon beim
    # ersten Rendern wissen, ob Debug-Panel oder Vollbild-Skalierung aktiv ist.
    with open(os.path.join(FRONTEND_DIR, "index.html"), encoding="utf-8") as f:
        html = f.read()
    if DEBUG_MODE:
        html = html.replace("<body>", '<body class="debug-mode">', 1)
    return Response(html, mimetype="text/html")


@app.route("/debug/pull", methods=["POST"])
def debug_pull():
    if not gpio.is_mock:
        return jsonify({"error": "GPIO ist aktiv, Debug-Route deaktiviert"}), 403
    gpio.trigger_mock()
    return jsonify({"ok": True})


@app.route("/state", methods=["GET"])
def get_state():
    return jsonify(
        {"state": game.state.name, "active_uid": account_manager.active_uid, "credits": account_manager.get_active_credits()}
    )


@app.route("/debug/accounts", methods=["GET"])
def debug_accounts():
    if not DEBUG_MODE:
        return jsonify({"error": "Nur im Debug-Modus"}), 403
    return jsonify({"active_uid": account_manager.active_uid, "accounts": account_manager.accounts})


@app.route("/debug/nfc/<uid>", methods=["POST"])
def debug_nfc_scan_route(uid):
    if not nfc.is_mock:
        return jsonify({"error": "NFC-Reader ist aktiv, Debug-Route deaktiviert"}), 403
    nfc.trigger_mock(uid.upper())
    return jsonify({"ok": True, "active_uid": account_manager.active_uid, "credits": account_manager.get_active_credits()})


@socketio.on("connect")
def handle_connect():
    socketio.emit("state_update", {"state": game.state.name})
    emit_credits()
    socketio.emit("debug_multiplier_chance_update", {"chance": reels.get_effective_multiplier_chance()})


@socketio.on("debug_pull_lever")
def handle_debug_pull_lever():
    if gpio.is_mock:
        gpio.trigger_mock()


# VORÜBERGEHEND: Spin per Bildschirm-Tipp (siehe config.TAP_TO_SPIN).
@socketio.on("tap_pull_lever")
def handle_tap_pull_lever():
    if config.TAP_TO_SPIN:
        game.pull_lever()


@socketio.on("debug_add_credits")
def handle_debug_add_credits(data=None):
    if not gpio.is_mock:
        return
    uid = account_manager.active_uid
    if uid is None:
        socketio.emit("error", {"message": "Keine aktive Karte - erst Karte auflegen"})
        return
    amount = int((data or {}).get("amount", 100))
    account_manager.add(uid, amount)
    emit_credits()


@socketio.on("debug_nfc_scan")
def handle_debug_nfc_scan(data=None):
    uid = str((data or {}).get("uid", "")).strip().upper()
    if nfc.is_mock and uid:
        nfc.trigger_mock(uid)


@socketio.on("debug_accounts")
def handle_debug_accounts():
    if DEBUG_MODE:
        socketio.emit("debug_accounts", {"active_uid": account_manager.active_uid, "accounts": account_manager.accounts})


@socketio.on("debug_set_multiplier_chance")
def handle_debug_set_multiplier_chance(data=None):
    if not gpio.is_mock:
        return
    chance = max(0.0, min(1.0, float((data or {}).get("chance", 0))))
    reels.set_debug_multiplier_chance(chance)
    socketio.emit("debug_multiplier_chance_update", {"chance": chance})


if __name__ == "__main__":
    # Mit Flask-Reloader (Debug-Modus) läuft dieser Block im Überwachungs- und
    # im eigentlichen Server-Prozess - den Reader nur im Server-Prozess pollen.
    if not DEBUG_MODE or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        nfc.start()
    # Flask-Debug (Auto-Reloader mit zweitem Prozess) nur im Debug-Modus - sonst
    # würde der Reloader u.a. den GPIO-Pin doppelt belegen.
    socketio.run(app, host="0.0.0.0", port=5000, debug=DEBUG_MODE, allow_unsafe_werkzeug=True)
