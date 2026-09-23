import { init as initReels } from "./reels.js";
import { loadEventMediaMap, showEvent, getEventNames, isPoolEvent } from "./effects.js";
import { loadMultiplierConfig } from "./multipliers.js";
import { preloadSounds } from "./sound.js";
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
}

async function bootstrap() {
  const start = performance.now();

  await Promise.all([initReels(), loadEventMediaMap(), loadMultiplierConfig(), preloadSounds()]);
  buildDebugPanel();

  const remaining = MIN_LOADING_SCREEN_MS - (performance.now() - start);
  if (remaining > 0) {
    await wait(remaining);
  }
  hideLoadingScreen();
}

bootstrap();
