import { startSpin, stopOnSymbol, showWinningLines } from "./reels.js";
import { GRID_COLS, DISPLAY, SPIN_TAP_AREA } from "./config.js";
import { showEvent, showEventSequence, showMultiplierCombo, hideAll, clearEvent, getEventNames } from "./effects.js";
import { playSound, startLoop, setLoopVolume, stopLoop } from "./sound.js";
import { playMultiplierReveals, clearMultipliers } from "./multipliers.js";

const IDLE_TIMEOUT_MS = 30000;
// Wahrscheinlichkeit (0-1), dass beim Spin-Start eine Extra-Animation aus dem
// "spin_animation"-Pool (event_media_map.json) während des Spinnens gezeigt wird.
const SPIN_EXTRA_CHANCE = 0.3;

const socket = io();
const creditsEl = document.getElementById("credits-value");
const betEl = document.getElementById("bet-value");
const winEl = document.getElementById("win-value");
const cardToastEl = document.getElementById("card-toast");
const debugCardEl = document.getElementById("debug-active-card");

// Tonhöhenschritt (Halbtöne) des Einsatz-Sounds pro Einsatzstufe; niedrigste
// Stufe = Originaltonhöhe, bei 8 Stufen endet die höchste ~1 Oktave + Ganzton darüber.
const BET_PITCH_SEMITONES_PER_STEP = 2;

const CARD_TOAST_MS = 2500;
let cardToastTimer = null;

const cardDialogEl = document.getElementById("card-dialog");
// Dialog schließt sich spätestens nach dieser Zeit von selbst.
const CARD_DIALOG_MS = 8000;
let cardDialogTimer = null;
// Aus "credits_update" (uid === null heißt: keine Karte aktiv).
let hasActiveCard = false;

let idleTimer = null;
// Vom "payout"-Event gepuffert und erst gezeigt, nachdem die Multiplikator-
// Animationen durchgelaufen sind (siehe "spin_result"-Handler unten).
let pendingPayout = null;

function revealPendingPayout() {
  const data = pendingPayout;
  pendingPayout = null;
  winEl.textContent = data?.amount ?? 0;
  if (!data || data.amount <= 0) return;
  // Gewinn-Sounds kommen aus event_media_map.json ("sounds" am Event).
  // Jackpot entscheidet der Server relativ zum Einsatz (backend/config.py:
  // JACKPOT_WIN_FACTOR).
  showEvent(data.jackpot ? "win_jackpot" : "win_small");
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  hideAll();
  idleTimer = setTimeout(() => showEvent("idle_attract"), IDLE_TIMEOUT_MS);
}

socket.on("connect", () => {
  resetIdleTimer();
});

socket.on("state_update", (data) => {
  resetIdleTimer();
  if (data.state === "SPINNING") {
    winEl.textContent = 0;
    clearMultipliers();
    startSpin();
    playSound("lever");
    startLoop("spin");
    if (Math.random() < SPIN_EXTRA_CHANCE) {
      showEvent("spin_animation");
    }
  }
});

// Reihenfolge: Walzen stoppen -> Multiplikator-Zahlen unter den Symbolen
// einblenden -> Gewinnlinie(n) einzeichnen -> pro Gewinnlinien-Multiplikator-
// Treffer eine eigene Overlay-Animation aus dem "multiplier_hit"-Pool
// (event_media_map.json), eine nach der anderen -> bei mehreren Treffern das
// Combo-Finale ("multiplier_combo") -> erst danach Auszahlung.
socket.on("spin_result", async (data) => {
  clearEvent("spin_animation");

  // Pro stehender Walze ein Ping; das Spin-Rattern wird mit jeder Walze leiser
  // und verstummt, wenn die letzte steht.
  await stopOnSymbol(data.reels, (col) => {
    playSound("reel_stop");
    const stillSpinning = GRID_COLS - 1 - col;
    if (stillSpinning === 0) {
      stopLoop("spin");
    } else {
      setLoopVolume("spin", stillSpinning / GRID_COLS);
    }
  });
  await playMultiplierReveals(data.multipliers);
  showWinningLines(data.winning_lines);
  await showEventSequence("multiplier_hit", data.multiplier_hits);
  await showMultiplierCombo(data.multiplier_hits);

  revealPendingPayout();
  if (data.win === 0) {
    showEvent("lose");
  }
});

socket.on("payout", (data) => {
  pendingPayout = data;
});

// credits === null heißt: keine Karte aktiv (z.B. nach Server-Neustart).
socket.on("credits_update", (data) => {
  if ("credits" in data) creditsEl.textContent = data.credits ?? "—";
  if (data.bet != null) betEl.textContent = data.bet;
  if ("uid" in data) {
    hasActiveCard = data.uid != null;
    if (hasActiveCard) hideCardDialog();
    if (debugCardEl) debugCardEl.textContent = data.uid ?? "keine";
  }
});

// Einsatz gewechselt (backend/game_state.py: cycle_bet). Nach der höchsten
// Stufe geht es wieder bei der niedrigsten los - dann wieder Originaltonhöhe.
socket.on("bet_changed", (data) => {
  const semitones = data.index * BET_PITCH_SEMITONES_PER_STEP;
  playSound("bet_up", { playbackRate: 2 ** (semitones / 12) });
});

function showCardDialog() {
  if (!cardDialogEl) return;
  cardDialogEl.classList.add("visible");
  clearTimeout(cardDialogTimer);
  cardDialogTimer = setTimeout(hideCardDialog, CARD_DIALOG_MS);
}

function hideCardDialog() {
  clearTimeout(cardDialogTimer);
  cardDialogEl?.classList.remove("visible");
}

function isCardDialogVisible() {
  return cardDialogEl?.classList.contains("visible") ?? false;
}

// Spin-Versuch ohne aktive Karte - kommt auch vom echten Hebel (GPIO), der
// nicht über das Frontend läuft.
socket.on("card_required", () => {
  resetIdleTimer();
  showCardDialog();
});

// Power-Menü der Admin-Karte (backend/power_menu.py): Auflegen = Herunterfahren,
// liegen lassen = Neustart, Hebel bestätigt, Tippen bricht ab.
const powerDialogEl = document.getElementById("power-dialog");
const powerTitleEl = document.getElementById("power-dialog-title");
const powerTextEl = document.getElementById("power-dialog-text");
const powerCountdownEl = document.getElementById("power-dialog-countdown");
let powerCountdownTimer = null;
// Nach dem Bestätigen lässt sich das Menü nicht mehr wegtippen.
let powerExecuting = false;

function isPowerDialogVisible() {
  return powerDialogEl?.classList.contains("visible") ?? false;
}

function showPowerDialog(title, text) {
  if (!powerDialogEl) return;
  powerTitleEl.textContent = title;
  powerTextEl.textContent = text;
  powerDialogEl.classList.add("visible");
}

function stopPowerCountdown() {
  clearInterval(powerCountdownTimer);
  powerCountdownTimer = null;
  if (powerCountdownEl) powerCountdownEl.textContent = "";
}

function startPowerCountdown(seconds) {
  stopPowerCountdown();
  const end = Date.now() + seconds * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    powerCountdownEl.textContent = `Abbruch in ${left} s – Tippen bricht sofort ab`;
  };
  tick();
  powerCountdownTimer = setInterval(tick, 250);
}

socket.on("power_menu", (data) => {
  if (!data.action) {
    // Auch nach dry run (PC) bzw. fehlgeschlagenem Befehl.
    powerExecuting = false;
    stopPowerCountdown();
    powerDialogEl?.classList.remove("visible");
    return;
  }
  resetIdleTimer();
  hideCardDialog();
  if (data.action === "reboot") {
    showPowerDialog("Neu starten?", "Hebel ziehen zum Bestätigen");
  } else {
    showPowerDialog("Herunterfahren?", `Hebel ziehen zum Bestätigen · Karte ${data.reboot_hold} s liegen lassen = Neustart`);
  }
  startPowerCountdown(data.timeout);
});

socket.on("power_executing", (data) => {
  powerExecuting = true;
  stopPowerCountdown();
  if (data.action === "reboot") {
    showPowerDialog("Startet neu …", "Gleich wieder da.");
  } else {
    showPowerDialog("Fährt herunter …", "Strom erst trennen, wenn die grüne LED am Pi aus ist.");
  }
});

// Kurzer Hinweis über dem Walzenfenster (Karten-Events, "Karte auflegen" etc.).
function showCardToast(text, variant = "info") {
  if (!cardToastEl) return;
  cardToastEl.textContent = text;
  cardToastEl.dataset.variant = variant;
  cardToastEl.classList.add("visible");
  clearTimeout(cardToastTimer);
  cardToastTimer = setTimeout(() => cardToastEl.classList.remove("visible"), CARD_TOAST_MS);
}

// Karten-Events (backend/app.py: handle_card_scan). Die zugehörigen Overlays
// "card_created"/"card_login"/"card_topup" sind optional - ohne Eintrag in
// event_media_map.json wird nur der Text-Hinweis gezeigt.
function onCardEvent(mediaEvent, text) {
  resetIdleTimer();
  hideCardDialog();
  showCardToast(text);
  if (getEventNames().includes(mediaEvent)) showEvent(mediaEvent);
  playSound(mediaEvent);
}

socket.on("account_created", () => {
  onCardEvent("card_created", "Neue Karte registriert – erneut auflegen zum Aufladen");
});

socket.on("account_login", (data) => {
  onCardEvent("card_login", `Karte angemeldet – Guthaben ${data.credits}`);
});

socket.on("account_topup", (data) => {
  onCardEvent("card_topup", `+${data.amount} aufgeladen – Guthaben ${data.credits}`);
});

// Debug-Slider: Wahrscheinlichkeit (0-100%), dass ein Symbol beim Spin einen
// Multiplikator bekommt (siehe backend/multiplier_config.json:
// chance_per_symbol) - zur Laufzeit hochdrehen, um beim Testen mehr
// Multiplikator-Treffer pro Spin zu bekommen, ohne die Datei anzufassen.
// Serverseitig nur wirksam im GPIO-Mock-Modus (siehe app.py).
const multiplierChanceSlider = document.getElementById("debug-multiplier-chance");
const multiplierChanceValueEl = document.getElementById("debug-multiplier-chance-value");

multiplierChanceSlider?.addEventListener("input", () => {
  const percent = Number(multiplierChanceSlider.value);
  multiplierChanceValueEl.textContent = `${percent}%`;
  socket.emit("debug_set_multiplier_chance", { chance: percent / 100 });
});

socket.on("debug_multiplier_chance_update", (data) => {
  if (!multiplierChanceSlider) return;
  const percent = Math.round((data.chance ?? 0) * 100);
  multiplierChanceSlider.value = String(percent);
  multiplierChanceValueEl.textContent = `${percent}%`;
});

// Backend konnte den Spin nicht auswerten (game_state.py: _refund_after_error) -
// Walzen auf dem gewürfelten Ergebnis anhalten, Einsatz kommt per credits_update zurück.
socket.on("spin_aborted", (data) => {
  clearEvent("spin_animation");
  stopLoop("spin");
  stopOnSymbol(data.reels);
});

socket.on("error", (data) => {
  console.warn("Server error:", data.message);
  showCardToast(data.message, "error");
});

function pullLever(socketEvent) {
  // Offenes Power-Menü: Hebel (Leertaste/Tipp im Debug) bestätigt dort - auch ohne Spielerkarte.
  if (isPowerDialogVisible()) {
    socket.emit(socketEvent);
    return;
  }
  resetIdleTimer();
  // Ohne Karte gar nicht erst beim Server anfragen und keine Hebel-Animation.
  if (!hasActiveCard) {
    showCardDialog();
    return;
  }
  // Optionales Overlay - nur zeigen, wenn event_media_map.json einen Eintrag hat.
  if (getEventNames().includes("lever_pull")) showEvent("lever_pull");
  socket.emit(socketEvent);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    pullLever("debug_pull_lever");
  }
});

// Tippen/Klicken auf die Stage: innerhalb des Walzenfensters (inkl. Goldrahmen,
// SPIN_TAP_AREA) löst nur im Debug-Modus einen Spin aus (serverseitig zusätzlich
// über config.TAP_TO_SPIN in backend/config.py), im normalen Betrieb spinnt nur
// der Hebel und der Tipp dort bewirkt nichts. Oberhalb des Walzenfensters passiert
// ebenfalls nichts. Überall sonst (blauer Rahmen seitlich und unten mit
// Guthaben/Einsatz/Gewinn) schaltet zur nächsten Einsatzstufe (config.BET_STEPS).
const stageEl = document.getElementById("stage");
stageEl?.addEventListener("pointerdown", (e) => {
  // Stage ist per CSS-Transform skaliert -> Klickposition auf 800x480 zurückrechnen.
  // Offenes Power-Menü: Tippen bricht ab (außer es fährt schon herunter).
  if (isPowerDialogVisible()) {
    if (!powerExecuting) socket.emit("power_menu_cancel");
    return;
  }
  // Offener Karten-Dialog: Tippen schließt ihn nur, statt zu spinnen/Einsatz zu wechseln.
  if (isCardDialogVisible()) {
    hideCardDialog();
    return;
  }
  const rect = stageEl.getBoundingClientRect();
  const x = ((e.clientX - rect.left) * DISPLAY.width) / rect.width;
  const y = ((e.clientY - rect.top) * DISPLAY.height) / rect.height;
  const a = SPIN_TAP_AREA;
  if (x >= a.left && x < a.left + a.width && y >= a.top && y < a.top + a.height) {
    if (document.body.classList.contains("debug-mode")) pullLever("tap_pull_lever");
  } else if (y < a.top) {
    // Oberer blauer Rahmen (Titel + Leaderboard-Button) wechselt keinen Einsatz,
    // sonst wird ein knapp verfehlter Tipp auf den Button zum Einsatzwechsel.
    resetIdleTimer();
  } else {
    resetIdleTimer();
    socket.emit("cycle_bet");
  }
});

document.getElementById("debug-add-credits")?.addEventListener("click", () => {
  socket.emit("debug_add_credits", { amount: 100 });
});

// Debug: Kartenscans ohne PN532 simulieren (serverseitig nur im NFC-Mock-Modus).
// Zweimal dieselbe UID = aufladen, andere UID = Kartenwechsel.
document.querySelectorAll("[data-debug-nfc-uid]").forEach((btn) => {
  btn.addEventListener("click", () => {
    socket.emit("debug_nfc_scan", { uid: btn.dataset.debugNfcUid });
  });
});

const debugNfcInput = document.getElementById("debug-nfc-uid");
document.getElementById("debug-nfc-scan")?.addEventListener("click", () => {
  const uid = debugNfcInput.value.trim();
  if (uid) socket.emit("debug_nfc_scan", { uid });
});

// Debug: Admin-Karte "liegen lassen" -> Power-Menü wechselt auf Neustart.
document.getElementById("debug-admin-hold")?.addEventListener("click", () => {
  socket.emit("debug_nfc_hold", { uid: "MOCKADMIN", held_sec: 60 });
});

document.getElementById("debug-accounts")?.addEventListener("click", () => {
  socket.emit("debug_accounts");
});

socket.on("debug_accounts", (data) => {
  console.table(Object.fromEntries(Object.entries(data.accounts).map(([uid, acc]) => [uid, { ...acc, active: uid === data.active_uid }])));
});

export { socket };
