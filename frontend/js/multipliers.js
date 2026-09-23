// Zeigt die Zahl eines gewürfelten Multiplikators (x2..x7, siehe
// backend/multiplier_config.json) unter dem jeweiligen Symbol in seinem Feld
// an - simple Einblendung, keine Varianten. Für die großen, abwechslungsreichen
// Overlay-Animationen bei tatsächlichen Gewinn-Treffern siehe stattdessen das
// Pool-Event "multiplier_hit" in event_media_map.json + showEventSequence() in
// effects.js (aufgerufen aus socket.js). Timing/Optik hier über
// frontend/multiplier_config.json einstellbar, keine Codeänderung nötig.
import { REEL_WINDOW, GRID_COLS, GRID_ROWS } from "./config.js";

const SLOT_WIDTH = REEL_WINDOW.width / GRID_COLS;
const SLOT_HEIGHT = REEL_WINDOW.height / GRID_ROWS;

let displayConfig = {
  enabled: true,
  duration_ms: 300,
  stagger_ms: 100,
  font_size_px: 22,
  color: "#ffd54f",
  glow_color: "#ff6f00",
  label_format: "x{value}",
  offset_y_px: 4,
};

let layer = null;
let activeBadges = [];

export async function loadMultiplierConfig(url = "multiplier_config.json") {
  try {
    const res = await fetch(url);
    const data = await res.json();
    displayConfig = { ...displayConfig, ...data };
  } catch (err) {
    console.warn("Kein multiplier_config.json gefunden, nutze Defaults.", err);
  }
  return displayConfig;
}

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement("div");
  layer.id = "multiplier-layer";
  layer.style.position = "absolute";
  layer.style.top = `${REEL_WINDOW.top}px`;
  layer.style.left = `${REEL_WINDOW.left}px`;
  layer.style.width = `${REEL_WINDOW.width}px`;
  layer.style.height = `${REEL_WINDOW.height}px`;
  layer.style.zIndex = "3";
  layer.style.pointerEvents = "none";
  document.getElementById("stage").appendChild(layer);
  return layer;
}

// Entfernt alle sichtbaren Multiplikator-Badges (z.B. beim nächsten Spin-Start).
export function clearMultipliers() {
  activeBadges.forEach((el) => el.remove());
  activeBadges = [];
}

// grid: data.multipliers aus dem "spin_result"-Event, Form [reihe][spalte] wie
// das Symbolfeld, Werte sind Zahl (Multiplikator) oder null. Blendet die Zahl
// unter jedem betroffenen Symbol ein (leicht gestaffelt über stagger_ms) und
// gibt ein Promise zurück, das erfüllt wird, sobald alle Einblendungen fertig
// sind.
export function playMultiplierReveals(grid) {
  clearMultipliers();
  if (!displayConfig.enabled || !grid) return Promise.resolve();

  const cells = [];
  grid.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) cells.push({ value, row: rowIndex, col: colIndex });
    });
  });
  if (cells.length === 0) return Promise.resolve();

  ensureLayer();
  const {
    duration_ms: duration,
    stagger_ms: stagger,
    font_size_px: fontSize,
    color,
    glow_color: glowColor,
    label_format: labelFormat,
    offset_y_px: offsetY,
  } = displayConfig;

  const reveals = cells.map(
    (cell, i) =>
      new Promise((resolve) => {
        const el = document.createElement("div");
        el.dataset.multiplier = "true";
        el.textContent = labelFormat.replace("{value}", cell.value);
        el.style.position = "absolute";
        el.style.left = `${cell.col * SLOT_WIDTH}px`;
        el.style.top = `${cell.row * SLOT_HEIGHT}px`;
        el.style.width = `${SLOT_WIDTH}px`;
        el.style.height = `${SLOT_HEIGHT}px`;
        el.style.display = "flex";
        el.style.alignItems = "flex-end";
        el.style.justifyContent = "center";
        el.style.paddingBottom = `${offsetY}px`;
        el.style.fontSize = `${fontSize}px`;
        el.style.fontWeight = "bold";
        el.style.color = color;
        el.style.textShadow = `0 0 8px ${glowColor}, 0 0 2px #000`;
        el.style.opacity = "0";
        layer.appendChild(el);
        activeBadges.push(el);

        setTimeout(() => {
          const player = el.animate(
            [
              { transform: "scale(0.4)", opacity: 0 },
              { transform: "scale(1)", opacity: 1 },
            ],
            { duration, easing: "ease-out", fill: "forwards" }
          );
          player.onfinish = resolve;
        }, i * stagger);
      })
  );

  return Promise.all(reveals);
}
