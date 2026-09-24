import { startSpin, stopOnSymbol, showWinningLines } from "./reels.js";
import { GRID_COLS } from "./config.js";
import { showEvent, showEventSequence, hideAll, clearEvent, getEventNames } from "./effects.js";
import { playSound, startLoop, setLoopVolume, stopLoop } from "./sound.js";
import { playMultiplierReveals, clearMultipliers } from "./multipliers.js";

const IDLE_TIMEOUT_MS = 30000;
const JACKPOT_THRESHOLD = 100;
// Wahrscheinlichkeit (0-1), dass beim Spin-Start eine Extra-Animation aus dem
// "spin_animation"-Pool (event_media_map.json) während des Spinnens gezeigt wird.
const SPIN_EXTRA_CHANCE = 0.3;

const socket = io();
const creditsEl = document.getElementById("credits-value");
const betEl = document.getElementById("bet-value");
const winEl = document.getElementById("win-value");
const cardToastEl = document.getElementById("card-toast");
const debugCardEl = document.getElementById("debug-active-card");

const CARD_TOAST_MS = 2500;
let cardToastTimer = null;

let idleTimer = null;
// Vom "payout"-Event gepuffert und erst gezeigt, nachdem die Multiplikator-
// Animationen durchgelaufen sind (siehe "spin_result"-Handler unten).
let pendingPayout = null;

function revealPendingPayout() {
  const data = pendingPayout;
  pendingPayout = null;
  winEl.textContent = data?.amount ?? 0;
  if (!data || data.amount <= 0) return;
  if (data.amount >= JACKPOT_THRESHOLD) {
    showEvent("win_jackpot");
    playSound("win_jackpot");
  } else {
    showEvent("win_small");
    playSound("win_small");
  }
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
// (event_media_map.json), eine nach der anderen -> erst danach Auszahlung.
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
  creditsEl.textContent = data.credits ?? "—";
  if (data.bet != null) betEl.textContent = data.bet;
  if (debugCardEl && "uid" in data) debugCardEl.textContent = data.uid ?? "keine";
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

socket.on("error", (data) => {
  console.warn("Server error:", data.message);
  showCardToast(data.message, "error");
});

function pullLever(socketEvent) {
  resetIdleTimer();
  showEvent("lever_pull");
  socket.emit(socketEvent);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    pullLever("debug_pull_lever");
  }
});

// VORÜBERGEHEND: Tippen/Klicken auf die Stage löst einen Spin aus, solange der
// Hebel noch nicht verbaut ist (serverseitig abschaltbar über
// config.TAP_TO_SPIN in backend/config.py).
document.getElementById("stage")?.addEventListener("pointerdown", () => {
  pullLever("tap_pull_lever");
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

document.getElementById("debug-accounts")?.addEventListener("click", () => {
  socket.emit("debug_accounts");
});

socket.on("debug_accounts", (data) => {
  console.table(Object.fromEntries(Object.entries(data.accounts).map(([uid, acc]) => [uid, { ...acc, active: uid === data.active_uid }])));
});

export { socket };
