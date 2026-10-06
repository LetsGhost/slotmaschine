"""Erzeugt ein unsichtbares Xcursor-Theme (1x1 transparente Pixel) für den Kiosk.

Den Mauszeiger auf dem Pi zeichnet der Compositor cage, nicht Chromium - CSS
"cursor: none" greift daher erst, wenn der Zeiger über der Seite bewegt wurde,
bei reinem Touch-Betrieb also nie. start.sh ruft dieses Script auf und setzt
XCURSOR_THEME, dann zeichnen cage und Chromium einen transparenten Zeiger.

Aufruf: python3 make_invisible_cursor.py <ziel-ordner>
Legt <ziel-ordner>/cursors/<name> + index.theme an (bestehende Dateien werden überschrieben).
"""

import os
import struct
import sys

# Gängige Cursor-Namen (wlroots/cage nutzt "default" bzw. älter "left_ptr",
# Chromium je nach CSS-Cursor u.a. "pointer"/"hand2"/"text").
CURSOR_NAMES = [
    "default", "left_ptr", "arrow", "top_left_arrow", "pointer", "hand1", "hand2",
    "text", "xterm", "ibeam", "wait", "watch", "progress", "left_ptr_watch",
    "crosshair", "cross", "move", "grab", "grabbing", "fleur", "not-allowed",
    "help", "context-menu", "cell", "all-scroll", "col-resize", "row-resize",
]

XCURSOR_MAGIC = b"Xcur"
IMAGE_TYPE = 0xFFFD0002
NOMINAL_SIZE = 24


def invisible_cursor_bytes() -> bytes:
    file_header = struct.pack("<4sIII", XCURSOR_MAGIC, 16, 0x10000, 1)
    toc = struct.pack("<III", IMAGE_TYPE, NOMINAL_SIZE, 16 + 12)
    # Chunk-Header: size, type, subtype, version, width, height, xhot, yhot, delay
    image = struct.pack("<IIIIIIIII", 36, IMAGE_TYPE, NOMINAL_SIZE, 1, 1, 1, 0, 0, 0)
    pixel = struct.pack("<I", 0)  # ARGB, komplett transparent
    return file_header + toc + image + pixel


def main(target: str) -> None:
    cursors_dir = os.path.join(target, "cursors")
    os.makedirs(cursors_dir, exist_ok=True)
    data = invisible_cursor_bytes()
    for name in CURSOR_NAMES:
        with open(os.path.join(cursors_dir, name), "wb") as f:
            f.write(data)
    with open(os.path.join(target, "index.theme"), "w", encoding="utf-8") as f:
        f.write("[Icon Theme]\nName=slot-invisible\nComment=Unsichtbarer Mauszeiger für den Kiosk\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Aufruf: python3 make_invisible_cursor.py <ziel-ordner>")
    main(sys.argv[1])
