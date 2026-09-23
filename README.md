# Raspberry Pi Slotmaschine

Spaß-Slotmaschine für einen Freund. Python/Flask-Backend (State Machine, GPIO,
Zufallslogik) + HTML/JS-Frontend (Animationen, Sound), verbunden über
WebSocket (Flask-SocketIO).

Umgesetzt gemäß `../slotmaschine-plan.md`: Phase 1 (Backend-Grundgerüst) und
Phase 2 (Frontend-Grundgerüst) sind fertig, jeweils mit Mock-GPIO bzw.
Platzhalter-Assets, damit alles am PC entwickelt/getestet werden kann, bevor
es auf den Pi kommt. Phase 3 (finale Assets) und Phase 4 (Pi-Deployment)
folgen später.

## Setup (Entwicklung am PC)

```bash
cd slotmachine
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

`gpiozero` lässt sich ohne echte GPIO-Hardware i.d.R. nicht importieren -
das ist erwartet: `gpio_handler.py` fällt dann automatisch in den Mock-Modus.

## Starten

```bash
cd backend
python app.py
```

Server läuft auf `http://localhost:5000` und liefert dort auch das Frontend
aus.

**Debug-Modus:** über die Umgebungsvariable `SLOT_DEBUG` steuerbar
(`SLOT_DEBUG=1` an, `SLOT_DEBUG=0` aus). Ist sie nicht gesetzt, ist der
Debug-Modus automatisch an, wenn GPIO im Mock-Modus läuft (PC), und aus auf
dem Pi mit echter Hardware. Im Debug-Modus wird die Stage in Originalgröße
(800x480) mit Debug-Panel darunter angezeigt, sonst ohne Panel und auf den
gesamten Viewport skaliert (Seitenverhältnis bleibt erhalten).

```bash
SLOT_DEBUG=0 python backend/app.py   # Vollbild-Ansicht wie auf dem Pi testen
SLOT_DEBUG=1 ./start.sh              # Debug-Panel auch auf dem Pi (start.sh setzt sonst SLOT_DEBUG=0)
```

**Pi OS Lite (ohne Desktop):** `start.sh` startet Chromium über den
Wayland-Kiosk-Compositor `cage` (`sudo apt install cage chromium-browser`).
Das Script braucht eine aktive Konsolen-Session auf dem Pi, per SSH oder mit
`sudo` klappt es nicht. Für den Betrieb (und Autostart beim Booten) den
Service aus `deploy/slotmachine-kiosk.service` einrichten, Anleitung steht in
der Datei.
Die Bildschirm-Drehung steuert `SLOT_ROTATION` (`normal`, `90`, `180`,
`270`; Standard `90`, im Service als `Environment=` gesetzt, braucht
`sudo apt install wlr-randr`).

Unter Windows (PowerShell) wird die Variable so gesetzt:

```powershell
$env:SLOT_DEBUG="0"; python backend/app.py
Remove-Item Env:SLOT_DEBUG            # wieder auf Automatik zurücksetzen
```

## Testen

**Backend (Phase 1, ohne Frontend):**

```bash
cd backend
python app.py                # Terminal 1
python test_manual.py        # Terminal 2 - Hebel per Enter ziehen, Events werden geloggt
```

**Frontend (Phase 2):** Browser öffnen unter `http://localhost:5000`,
Leertaste drückt den (Mock-)Hebel. Über die Debug-Buttons unten im Fenster
lässt sich jedes Event aus `frontend/event_media_map.json` manuell auslösen.
Der Debug-Slider "Multiplikator-Chance" setzt `chance_per_symbol` (siehe
`backend/multiplier_config.json`) zur Laufzeit hoch/runter (0-100%), ohne die
Datei anzufassen - praktisch, um beim Testen gezielt mehr (oder auch mal gar
keine) Multiplikatoren pro Spin zu bekommen. Wirkt nur im GPIO-Mock-Modus
(`backend/app.py`, Event `debug_set_multiplier_chance`) und gilt bis zum
nächsten Server-Neustart, dann greift wieder der Wert aus der JSON-Datei.

Da noch keine echten Bild-/Sound-Assets vorhanden sind, zeigt das Frontend
Platzhalter (graue Kacheln mit Symbolnamen als Text, keine Sounds). Das
Spiel ist damit voll funktionsfähig testbar, sieht/klingt aber erst nach
Phase 3 (Assets) wie eine echte Slotmaschine.

Beim Laden der Seite erscheint kurz ein Ladescreen mit dem Book-of-Ra-Logo
(`frontend/assets/sprites/book_of_rah_logo.jpg`) samt Spinner, mindestens
`MIN_LOADING_SCREEN_MS` (Default 2500ms, `frontend/js/main.js`) lang - auch
wenn alle Assets schneller fertig geladen sind. Danach blendet er sanft aus.

## Fehlende Assets (Phase 3, noch zu ergänzen)

- `frontend/assets/frame/frame.png` - Rahmenbild, 800×480. Sobald vorhanden,
  Ausschnitt-Koordinaten in `frontend/js/config.js` (`REEL_WINDOW`) eintragen.
- `frontend/assets/sprites/{cherry,lemon,bell,star,seven}.png` - Symbolbilder,
  quadratisch (empfohlen 140×140px), transparenter Hintergrund.
- `frontend/assets/overlays/` - `win_small.webm`, `win_jackpot.webm`,
  `lose.gif`, `idle_attract.gif`, `lever_flash.png` (siehe
  `event_media_map.json`, dort auch beliebig erweiterbar).
- `frontend/assets/audio/` - `lever.mp3`, `reel_stop.mp3`, `win_small.mp3`,
  `win_jackpot.mp3`, `lose.mp3`.

## Greenscreen-Videos zu transparenten GIFs konvertieren

Für Events wie `sausage_knife` (`frontend/assets/overlays/sausage_knife.gif`,
aus `sausage_knife.mp4` erzeugt) per `ffmpeg` (`scoop install ffmpeg`):

```bash
ffmpeg -i input.mp4 -filter_complex "
  [0:v]fps=15,chromakey=0x00ff00:0.18:0.12,despill=type=green:mix=0.5,format=rgba,split[s0][s1];
  [s0]palettegen=reserve_transparent=1:transparency_color=ffffff[p];
  [s1][p]paletteuse=alpha_threshold=128
" -loop 0 output.gif
```

`0x00ff00` ist die Chroma-Farbe (bei anderem Grünton anpassen), die beiden
Zahlen danach sind `similarity`/`blend` für den Keying-Toleranzbereich. Bei
Grünsaum an Kanten `despill`-`mix` erhöhen oder `similarity` leicht senken.
Ergebnis vor dem Einbauen prüfen, z.B. über Magenta legen:
`ffmpeg -f lavfi -i color=c=magenta:s=WxH -i output.gif -filter_complex overlay -frames:v 1 check.png`
(prüft nur den ersten Frame - für weitere Frames einzeln mit
`ffmpeg -i output.gif frame_%03d.png` extrahieren und einzeln prüfen, statt
`select=eq(n,N)` mit `overlay` in einem Aufruf zu kombinieren, das liefert je
nach ffmpeg-Version falsche/leere Frames).

So auch `sniper_shoot.gif` aus `sniper.gif` erzeugt (Chroma-Farbe `0x00d600`,
`similarity` 0.20) - Quelle für `"sniper_count"` weiter unten.

## Walzenfeld & Gewinnregeln

Das Feld hat **5 Spalten x 3 Reihen** (`GRID_COLS`/`GRID_ROWS` in
`backend/config.py`, muss mit denselben Konstanten in
`frontend/js/config.js` übereinstimmen). Gewertet werden **5 feste
Paylines** (`PAYLINES` in `backend/config.py`): obere, mittlere und
untere Reihe sowie eine V- und eine Lambda-Form (Λ) quer über die
Reihen. Jede Payline wird unabhängig ausgewertet - mehrere Paylines
können in einem Spin gleichzeitig gewinnen, die Beträge werden addiert.

Pro Payline zählt, wie viele gleiche Symbole **von links ausgehend in
Folge** liegen (klassische Slot-Logik); ab 3 gibt es eine Auszahlung,
die Höhe hängt vom Symbol und der Anzahl (3/4/5) ab (`PAYOUTS` in
`backend/config.py`). Seltenere Symbole (`WEIGHTS`) zahlen deutlich
mehr - `seven` ist das Jackpot-Symbol: schon 3x seven auf einer Payline
erreicht `JACKPOT_THRESHOLD` (`frontend/js/socket.js`) und löst die
Jackpot-Animation aus.

## Gewinn-Multiplikatoren

Bei jedem Spin würfelt der Server pro Feld-Position unabhängig, ob dort ein
Multiplikator (x2 bis x7, Standard-Werte/-Gewichte konfigurierbar) sichtbar
wird - unabhängig davon, ob diese Position am Ende Teil einer Gewinnlinie ist
(`backend/reels.py`: `roll_multipliers`). Der Multiplikator wird immer unter
dem betroffenen Symbol in seinem Feld angezeigt, zählt für die Auszahlung
aber nur, wenn die Position Teil der **gewinnenden Kette** einer Payline ist
(die ersten `count` Felder von links, siehe `evaluate_lines`). Haben mehrere
Positionen einer gewinnenden Kette einen Multiplikator, werden sie je nach
`combine_mode` addiert (Default) oder multipliziert; ohne Treffer bleibt der
Gewinn unverändert (Faktor 1).

Ablauf im Frontend (`frontend/js/socket.js`, Event `spin_result`):

1. Walzen stoppen.
2. Die gewürfelte Zahl (falls vorhanden) blendet unter jedem betroffenen
   Symbol ein (`frontend/js/multipliers.js`, kurze Einblendung, kein Pool -
   nur Anzeige, keine große Animation).
3. Gewinnlinie(n) werden eingezeichnet (`showWinningLines`).
4. **Pro Multiplikator, der Teil einer gewinnenden Kette ist** (siehe
   `collect_multiplier_hits` in `backend/reels.py`), wird **eine eigene
   Overlay-Animation nacheinander** gezeigt - z.B. wurden zwei Multiplikatoren
   in Gewinnlinien getroffen, laufen zwei Animationen hintereinander ab.
   Das läuft über das ganz normale Event-System aus `event_media_map.json`:
   Das Event heißt `multiplier_hit` und ist (wie `spin_animation`) ein Pool -
   bei jedem Treffer wird zufällig eine Variante gewählt (Bild/GIF/Video +
   `anim`, alle bereits dokumentierten Animationstypen inkl. `flyby`,
   `chest_reveal`, `coin_rain_reveal` erlaubt). Erst wenn alle Treffer-Overlays
   durchgelaufen sind, geht es weiter.
5. Erst danach erscheinen Gewinn-/Verlust-Overlay und Auszahlung.

Technisch macht das `showEventSequence(eventName, count)` in
`frontend/js/effects.js`: ruft `showEvent("multiplier_hit")` `count`-mal auf
und wartet nach jedem Aufruf, bis die jeweilige Animation/das Video/GIF
wirklich fertig ist, bevor die nächste startet.

Vollständig ohne Codeänderung konfigurierbar:

- `backend/multiplier_config.json` - Balancing: `enabled`,
  `chance_per_symbol` (Wahrscheinlichkeit 0-1 pro Feld-Position),
  `values`/`weights` (mögliche Multiplikator-Werte und ihre Gewichtung,
  gleiche Reihenfolge), `combine_mode` (`"sum"` oder `"product"`).
- `frontend/multiplier_config.json` - Optik/Timing der kleinen Zahl unter dem
  Symbol: `enabled`, `duration_ms`/`stagger_ms` (Einblendtiming), `font_size_px`,
  `color`, `glow_color`, `label_format` (Platzhalter `{value}`, z.B.
  `"x{value}"`), `offset_y_px` (Abstand vom unteren Feldrand).
- `frontend/event_media_map.json`, Eintrag `"multiplier_hit"` - der
  **Animations-Pool** für die Treffer-Overlays, genau wie jedes andere Event
  (siehe Abschnitt unten): beliebig viele Varianten mit `type`
  (`image`/`gif`/`video`), `src`, `anim` (`pop_scale`, `drop_bounce`,
  `slide_up_fade`, `flyby`, `chest_reveal`, `coin_rain_reveal`, `sniper_count`
  oder ganz ohne `anim` mit fixem `duration_ms`), `position`, `weight`.
  Mitgeliefert sind zwei Platzhalter-Varianten sowie `sniper_count` mit dem
  echten `assets/overlays/sniper_shoot.gif` (Zielfernrohr, das pro Treffer so
  oft "schießt" wie der Multiplikator-Wert - siehe `"sniper_count"` unten).

## Konfiguration

- Balancing (Symbole, Gewichte, Walzenfeld, Paylines, Auszahlungen,
  Timing, Startguthaben, GPIO-Pin): `backend/config.py`
- Multiplikator-Balancing: `backend/multiplier_config.json` (siehe oben)
- Display-/Reel-Layout, Symbol→Bild-Zuordnung: `frontend/js/config.js`
- Multiplikator-Anzeige/-Timing: `frontend/multiplier_config.json` (siehe oben)
- Event→Media-Zuordnung (Bilder/GIFs/Videos bei Events):
  `frontend/event_media_map.json`. Optional pro Event ein `"anim"`-Feld
  setzen; verfügbare Werte (definiert in `frontend/js/effects.js`,
  `ANIMATIONS`):
  - `"drop_bounce"` - fällt von oben rein, federt kurz nach, fliegt am
    Ende wieder nach oben raus.
  - `"pop_scale"` - wächst mit Überschwinger aus der Mitte (elastic pop),
    verschwindet durch Aufblähen+Fade.
  - `"slide_up_fade"` - subtiles Hochgleiten+Einblenden, faded dezent nach
    oben weg.

  Timing je Event über `fly_in_ms`/`hold_ms`/`fly_out_ms` einstellbar
  (Defaults 350/1200/350ms). So lässt sich jede Animation auf jedes
  beliebige Event (Gewinn, Verlust, eigene Events) legen, ohne Code zu
  ändern.

  **Zusammengesetzte Animation `"flyby"`:** Schwebt von links rein, dreht
  sich 1-2 mal um die eigene Achse, schwebt dann sanft (Hover-Bobbing) und
  fliegt am Ende nach rechts weg. Eigene Felder (alle optional):
  `fly_in_ms` (Default 350), `spin_ms` (Default 500), `spin_turns`
  (Default: zufällig 1 oder 2 volle Umdrehungen), `hold_ms` (Hover-Dauer,
  Default 1200), `hover_amplitude` (Hub in %, Default 6),
  `hover_cycle_ms` (Dauer einer Hover-Schwingung, Default 900),
  `fly_out_ms` (Default 350). Siehe `flyby_demo` als Beispiel.

  **Zusammengesetzte Animation `"chest_reveal"`:** Kiste (`src`) erscheint
  episch mit rotierendem Lichtstrahlen-Glow, wackelt kurz beim Öffnen und
  zeigt dann für sehr kurze Zeit ein Überraschungsbild (`reveal_src`), das
  aus der Kiste herauspoppt, bevor alles zusammen wegfaded. Eigene Felder:
  `reveal_src` (das Überraschungsbild - Pfad muss selbst als Datei
  angelegt werden, sonst erscheint ein `?`-Platzhalter), `chest_open_src`
  (optionaler Sprite-Wechsel beim Öffnen), `appear_ms` (Default 700),
  `open_delay_ms` (Default 400), `open_ms` (Default 250), `reveal_ms`
  (Default 500 - bewusst kurz gehalten), `fade_out_ms` (Default 300),
  `reveal_scale` (Default 1.15). Siehe `chest_reveal_demo` als Beispiel
  (referenziert `assets/overlays/female-middle-finger-hand.jpg` - diese
  Datei noch selbst in den Ordner legen).

  **Zusammengesetzte Animation `"coin_rain_reveal"`:** Erst regnen viele
  Münzen über den Bildschirm, danach wächst das Hauptbild (`src`) in der
  Bildschirmmitte von klein auf groß, hält kurz und verschwindet wieder.
  Eigene Felder (alle optional): `coin_src` (Münzbild, Default
  `assets/overlays/coin_placeholder.svg`), `coin_count` (Default 24),
  `rain_duration_ms` (Default 1800), `reveal_delay_ms` (Default =
  `rain_duration_ms`, also Bild erscheint erst nach dem Regen), `grow_ms`
  (Default 500), `hold_ms` (Default 1500), `fade_out_ms` (Default 400).
  Siehe `coin_rain_reveal_demo` als Beispiel.

  **Zusammengesetzte Animation `"sniper_count"`:** Zielfernrohr-Animation
  (`src`, standardmäßig `assets/overlays/sniper_shoot.gif` - per Chromakey
  aus `sniper.gif` freigestellt, siehe Abschnitt "Greenscreen-Videos..."
  oben), die pro Aufruf genau so viele Ziel-und-Schuss-Zyklen nacheinander
  abspielt wie der Kontext an Wert mitgibt - beim `"multiplier_hit"`-Event
  ist das der tatsächliche Multiplikator-Wert (siehe `collect_multiplier_hits`
  in `backend/reels.py` und `showEventSequence` in `frontend/js/effects.js`):
  bei einem x3-Treffer laufen 3 Zyklen, deren Ziel-Label dabei hochzählt
  (erst x1, dann x2, dann x3 wird "abgeschossen"). Für einen manuellen Test
  ohne Kontext (z.B. über die Debug-Buttons) lässt sich der Wert fix über
  `value` in der JSON setzen. Eigene Felder (alle optional):
  `shot_duration_ms` (Dauer eines Zyklus, Default 700), `gap_ms` (Pause
  zwischen zwei Zyklen, Default 150), `aim_in_ms` (Einblendzeit des
  Ziel-Labels, Default 120), `shoot_delay_ms` (Zeitpunkt des "Treffers"
  innerhalb eines Zyklus, Default 420 - muss kleiner als `shot_duration_ms`
  sein), `target_position` (eigene Position/Größe für das Ziel-Label,
  Default: `position`), `target_font_size_px` (Default 40), `target_color`
  (Default `#ffffff`), `target_hit_color` (Farbe beim Treffer, Default
  `#ff5252`), `label_format` (Platzhalter `{value}`, Default `"x{value}"`),
  `screen_shake` (kurzes Wackeln beim Treffer, Default `true`),
  `muzzle_flash` (kurzer weißer Blitz beim Treffer, Default `true`). Siehe
  `sniper_count_demo` als Beispiel (fester Wert `3`).

  **Zufalls-Pool:** Alle Spiel-Events (außer den `*_demo`-Einträgen)
  sind als `{ "anim_pool": [ ... ] }` angelegt - bei jedem `showEvent()`-Aufruf wird zufällig eine Variante
  aus dem Pool gewählt (optional gewichtet über `"weight"`, Default 1).
  Für weitere Animationen einfach Einträge im Pool ergänzen. Ältere
  Schreibweisen (einzelnes Objekt oder reines Array) funktionieren
  weiterhin. Siehe `anim_pool_demo` als Beispiel.

  **Gewinnbetrag:** Bei `win_small` und `win_jackpot` wird der ausgezahlte
  Betrag am unteren Rand des Bildes der gewählten Variante eingeblendet und
  bewegt sich mit deren `anim` mit. Optional pro Variante: `amount_format`
  (Platzhalter `{amount}`, Default `"+{amount}"`), `amount_bottom_px`
  (Abstand zum unteren Bildrand, Default 10), `amount_font_size_px`
  (Default 48), `amount_color` (Default `#ffd700`).

  **Extra-Animation während des Spinnens:** Das Event `spin_animation`
  (ebenfalls ein Pool, aktuell mit `sausage_knife` befüllt - beliebig um
  weitere Varianten erweiterbar) wird in `frontend/js/socket.js` beim
  Spin-Start mit einer Wahrscheinlichkeit von `SPIN_EXTRA_CHANCE` (Default
  0.3 = 30%) angezeigt, während die Walzen sich drehen, und garantiert
  wieder entfernt, sobald das Spin-Ergebnis eintrifft (`clearEvent`) -
  überlappt also nie mit Gewinn-/Verlust-Overlays. `duration_ms` ist
  bewusst `null`: die Laufzeit richtet sich nicht nach einer festen
  Millisekundenzahl, sondern exakt nach der tatsächlichen Spin-Dauer
  (`backend/config.py`, `SPIN_DURATION_MS`) - ändert sich die dort, passt
  sich die Animation automatisch an, ohne dass hier etwas nachgezogen
  werden muss. Position bewusst unterhalb des Walzenfensters
  (`REEL_WINDOW` in `frontend/js/config.js`), damit die Symbole beim
  Spinnen sichtbar bleiben.

  Testbeispiele über die Debug-Buttons im Frontend auslösbar:
  `flyby_demo`, `drop_bounce_demo`, `pop_scale_demo`, `slide_up_fade_demo`,
  `coin_rain_reveal_demo`, `sniper_count_demo` (fester Wert `3` - über den
  Button also ohne Multiplikator-Treffer testbar),
  `anim_pool_demo` (Pool-Events sind im Debug-Panel mit 🎲 markiert).

## Projektstruktur

Siehe `../slotmaschine-plan.md`, Abschnitt 0.
