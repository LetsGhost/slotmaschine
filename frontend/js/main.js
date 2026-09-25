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

// Gruppierung der Event-Buttons im Debug-Panel. Events aus
// event_media_map.json, die hier fehlen, landen unter "Sonstiges".
const DEBUG_EVENT_CATEGORIES = [
  {
    title: "Spiel-Events (Pool)",
    events: ["win_small", "win_jackpot", "lose", "multiplier_hit", "spin_animation", "lever_pull", "idle_attract"],
  },
  { title: "Gewinn", events: ["mlg_meme_demo", "sybau_flyby_demo", "bouncing_yaris_demo"] },
  { title: "Jackpot", events: ["gojo_float_demo", "coin_rain_reveal_demo"] },
  { title: "Verlust", events: ["cursed_plankton_demo", "why_so_serious_demo", "chest_reveal_demo"] },
  { title: "Multiplikator", events: ["sniper_count_demo", "case_open_demo"] },
  { title: "Spin", events: ["sausage_knife_demo"] },
  {
    title: "Einblend-Animationen",
    events: ["flyby_demo", "drop_bounce_demo", "pop_scale_demo", "slide_up_fade_demo", "anim_pool_demo"],
  },
];

function createDebugSection(title) {
  const section = document.createElement("fieldset");
  section.className = "debug-section";
  const legend = document.createElement("legend");
  legend.textContent = title;
  section.appendChild(legend);
  return section;
}

function createEventButton(name) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = isPoolEvent(name) ? `${name} 🎲` : name;
  btn.title = isPoolEvent(name)
    ? `showEvent("${name}") - wählt zufällig eine von mehreren Varianten`
    : `showEvent("${name}")`;
  btn.addEventListener("click", () => showEvent(name));
  return btn;
}

// Case Opening mit zufälligem Multiplikator (wie ein echter Treffer über
// context.value), statt immer des festen "value" aus case_open_demo.
function createRandomCaseButton() {
  const caseBtn = document.createElement("button");
  caseBtn.type = "button";
  caseBtn.textContent = "Case Opening 🎰";
  caseBtn.title = 'showEvent("case_open_demo") mit zufälligem Wert x2-x7';
  caseBtn.addEventListener("click", () => {
    const value = 2 + Math.floor(Math.random() * 6);
    showEvent("case_open_demo", { context: { value } });
  });
  return caseBtn;
}

function buildDebugPanel() {
  const panel = document.getElementById("debug-panel");
  if (!panel) return;

  const available = new Set(getEventNames());
  const sections = DEBUG_EVENT_CATEGORIES.map(({ title, events }) => {
    const section = createDebugSection(title);
    events
      .filter((name) => available.delete(name))
      .forEach((name) => section.appendChild(createEventButton(name)));
    if (title === "Multiplikator") section.appendChild(createRandomCaseButton());
    return section;
  });

  if (available.size > 0) {
    const rest = createDebugSection("Sonstiges");
    available.forEach((name) => rest.appendChild(createEventButton(name)));
    sections.push(rest);
  }

  sections.filter((s) => s.querySelector("button")).forEach((s) => panel.appendChild(s));
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
