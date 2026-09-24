"""Manueller Test: verbindet per SocketIO-Client, zieht den Hebel bzw.
simuliert NFC-Kartenscans (Mock-Modus) und protokolliert alle Events.

Nutzung:
    1. Server starten:  python app.py
    2. In zweitem Terminal: python test_manual.py

Befehle:
    <Enter>      Hebel ziehen
    c <UID>      Karte <UID> auflegen (z.B. "c MOCK01"; zweimal = +100)
    a            alle Konten anzeigen
    q            beenden
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


@sio.on("account_created")
def on_account_created(data):
    print(f"[account_created] {data}")


@sio.on("account_login")
def on_account_login(data):
    print(f"[account_login] {data}")


@sio.on("account_topup")
def on_account_topup(data):
    print(f"[account_topup] {data}")


@sio.on("debug_accounts")
def on_debug_accounts(data):
    print(f"[debug_accounts] aktiv={data['active_uid']}")
    for uid, acc in data["accounts"].items():
        print(f"    {uid:>20}: {acc['credits']}")


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
