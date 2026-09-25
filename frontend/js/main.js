import { init as initReels } from "./reels.js";
import { loadEventMediaMap, showEvent, getEventNames, isPoolEvent } from "./effects.js";
import { loadMultiplierConfig } from "./multipliers.js";
import { preloadSounds } from "./sound.js";
import { DISPLAY } from "./config.js";
import "./socket.js";

// Mindestdauer des Ladescreens (Book-of-Ra-Logo) beim Seitenaufruf - rein für
// die Optik, auch wenn alle Assets schneller fertig geladen sind.
const MIN_LOADING_SCREEN_MS = 2500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (!loadingScreen) return;
  loadingScreen.addEventListener("transitionend", () => loadingScreen.remove(), { once: true });
  loadingScreen.classList.add("hidden");
}

// Debug-Modus setzt der Server als Klasse am <body> (Umgebungsvariable
// SLOT_DEBUG, siehe backend/app.py).
const DEBUG_MODE = document.body.classList.contains("debug-mode");

// Außerhalb des Debug-Modus die 800x480-Stage uniform auf den gesamten
// Viewport skalieren (Kiosk-Browser auf dem Pi), siehe style.css.
function fitStageToViewport() {
  const scale = Math.min(window.innerWidth / DISPLAY.width, window.innerHeight / DISPLAY.height);
  document.documentElement.style.setProperty("--stage-scale", String(scale));
}

if (!DEBUG_MODE) {
  fitStageToViewport();
  window.addEventListener("resize", fitStageToViewport);
}

function buildDebugPanel() {
  const panel = document.getElementById("debug-panel");
  if (!panel) return;
  getEventNames().forEach((name) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = isPoolEvent(name) ? `${name} 🎲` : name;
    btn.title = isPoolEvent(name)
      ? `showEvent("${name}") - wählt zufällig eine von mehreren Varianten`
      : `showEvent("${name}")`;
    btn.addEventListener("click", () => showEvent(name));
    panel.appendChild(btn);
  });

  // Case Opening mit zufälligem Multiplikator (wie ein echter Treffer über
  // context.value), statt immer des festen "value" aus case_open_demo.
  const caseBtn = document.createElement("button");
  caseBtn.type = "button";
  caseBtn.textContent = "Case Opening 🎰";
  caseBtn.title = 'showEvent("case_open_demo") mit zufälligem Wert x2-x7';
  caseBtn.addEventListener("click", () => {
    const value = 2 + Math.floor(Math.random() * 6);
    showEvent("case_open_demo", { context: { value } });
  });
  panel.appendChild(caseBtn);
}

async function bootstrap() {
  const start = performance.now();

  await Promise.all([initReels(), loadEventMediaMap(), loadMultiplierConfig(), preloadSounds()]);
  if (DEBUG_MODE) {
    buildDebugPanel();
  }

  const remaining = MIN_LOADING_SCREEN_MS - (performance.now() - start);
  if (remaining > 0) {
    await wait(remaining);
  }
  hideLoadingScreen();
}

bootstrap();
