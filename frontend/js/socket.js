import { startSpin, stopOnSymbol, showWinningLines } from "./reels.js";
import { showEvent, showEventSequence, hideAll, clearEvent } from "./effects.js";
import { playSound } from "./sound.js";
import { playMultiplierReveals, clearMultipliers } from "./multipliers.js";

const IDLE_TIMEOUT_MS = 30000;
const JACKPOT_THRESHOLD = 100;
// Wahrscheinlichkeit (0-1), dass beim Spin-Start eine Extra-Animation aus dem
// "spin_animation"-Pool (event_media_map.json) während des Spinnens gezeigt wird.
const SPIN_EXTRA_CHANCE = 0.3;

const socket = io();
const creditsEl = document.getElementById("credits-value");

let idleTimer = null;
// Vom "payout"-Event gepuffert und erst gezeigt, nachdem die Multiplikator-
// Animationen durchgelaufen sind (siehe "spin_result"-Handler unten).
let pendingPayout = null;

function revealPendingPayout() {
  const data = pendingPayout;
  pendingPayout = null;
  if (!data || data.amount <= 0) return;
  const context = { amount: data.amount };
  if (data.amount >= JACKPOT_THRESHOLD) {
    showEvent("win_jackpot", { context });
    playSound("win_jackpot");
  } else {
    showEvent("win_small", { context });
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
    clearMultipliers();
    startSpin();
    playSound("lever");
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
  playSound("reel_stop");

  await stopOnSymbol(data.reels);
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

socket.on("credits_update", (data) => {
  creditsEl.textContent = data.credits;
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

export { socket };
