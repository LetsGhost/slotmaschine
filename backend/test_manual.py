"""Manueller Test für Phase 1: verbindet per SocketIO-Client, zieht den Hebel
(Mock-Modus) und protokolliert alle Events in der Konsole.

Nutzung:
    1. Server starten:  python app.py
    2. In zweitem Terminal: python test_manual.py
"""

import socketio

sio = socketio.Client()


@sio.event
def connect():
    print("[connect] verbunden mit Server")


@sio.on("state_update")
def on_state_update(data):
    print(f"[state_update] {data}")


@sio.on("spin_result")
def on_spin_result(data):
    print(f"[spin_result] {data}")


@sio.on("payout")
def on_payout(data):
    print(f"[payout] {data}")


@sio.on("credits_update")
def on_credits_update(data):
    print(f"[credits_update] {data}")


@sio.on("error")
def on_error(data):
    print(f"[error] {data}")


if __name__ == "__main__":
    sio.connect("http://localhost:5000")
    input("Verbunden. Enter drücken, um den Hebel zu ziehen (mehrfach möglich), 'q' zum Beenden.\n")
    while True:
        cmd = input("> ")
        if cmd.strip().lower() == "q":
            break
        sio.emit("debug_pull_lever")
    sio.disconnect()
