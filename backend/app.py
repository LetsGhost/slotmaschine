"""Flask + SocketIO Setup. Liefert das Frontend aus und verdrahtet GPIO/State-Machine mit SocketIO."""

import os

from flask import Flask, jsonify, send_from_directory
from flask_socketio import SocketIO

import config
import reels
from credits import CreditManager
from game_state import GameState
from gpio_handler import GPIOHandler

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
socketio = SocketIO(app, cors_allowed_origins="*")

credit_manager = CreditManager()


def emit_event(event: str, payload: dict) -> None:
    socketio.emit(event, payload)


game = GameState(credit_manager, emit_event)
gpio = GPIOHandler(config.GPIO_LEVER_PIN, game.pull_lever)


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/debug/pull", methods=["POST"])
def debug_pull():
    if not gpio.is_mock:
        return jsonify({"error": "GPIO ist aktiv, Debug-Route deaktiviert"}), 403
    gpio.trigger_mock()
    return jsonify({"ok": True})


@app.route("/state", methods=["GET"])
def get_state():
    return jsonify({"state": game.state.name, "credits": credit_manager.balance()})


@socketio.on("connect")
def handle_connect():
    socketio.emit("state_update", {"state": game.state.name})
    socketio.emit("credits_update", {"credits": credit_manager.balance()})
    socketio.emit("debug_multiplier_chance_update", {"chance": reels.get_effective_multiplier_chance()})


@socketio.on("debug_pull_lever")
def handle_debug_pull_lever():
    if gpio.is_mock:
        gpio.trigger_mock()


@socketio.on("debug_add_credits")
def handle_debug_add_credits(data=None):
    if not gpio.is_mock:
        return
    amount = int((data or {}).get("amount", 100))
    credit_manager.add(amount)
    socketio.emit("credits_update", {"credits": credit_manager.balance()})


@socketio.on("debug_set_multiplier_chance")
def handle_debug_set_multiplier_chance(data=None):
    if not gpio.is_mock:
        return
    chance = max(0.0, min(1.0, float((data or {}).get("chance", 0))))
    reels.set_debug_multiplier_chance(chance)
    socketio.emit("debug_multiplier_chance_update", {"chance": chance})


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
