import { REEL_WINDOW, SYMBOL_ASSETS, SYMBOLS, BONUS_SYMBOLS, GRID_COLS, GRID_ROWS, PAYLINES } from "./config.js";
import { drawTileFrame, drawTileCorners, drawWinLine } from "./tileframe.js";

const SLOT_WIDTH = REEL_WINDOW.width / GRID_COLS;
const SLOT_HEIGHT = REEL_WINDOW.height / GRID_ROWS;
const SPIN_SPEED_PX_PER_MS = 0.9;
const STOP_STAGGER_MS = 250;

const canvas = document.getElementById("reels");
const ctx = canvas.getContext("2d");

canvas.style.top = `${REEL_WINDOW.top}px`;
canvas.style.left = `${REEL_WINDOW.left}px`;
canvas.width = REEL_WINDOW.width;
canvas.height = REEL_WINDOW.height;

const images = {};

function loadImages() {
  const entries = Object.entries(SYMBOL_ASSETS);
  return Promise.all(
    entries.map(
      ([name, src]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve; // fehlendes Asset -> Platzhalter beim Zeichnen
          img.src = src;
          images[name] = img;
        })
    )
  );
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Langer gemischter Symbolstreifen zum Durchscrollen einer Spalte beim Spinnen.
function buildSpinStrip() {
  const strip = [];
  for (let i = 0; i < 4; i += 1) {
    strip.push(...shuffle([...SYMBOLS]));
  }
  return strip;
}

const reelState = Array.from({ length: GRID_COLS }, () => ({
  spinning: false,
  offset: 0,
  spinIndex: 0,
  spinSymbols: [],
  columnSymbols: Array.from({ length: GRID_ROWS }, () => SYMBOLS[0]),
}));

let animationHandle = null;
let lastTimestamp = 0;
let activeWinningLines = [];

function isAllStopped() {
  return reelState.every((reel) => !reel.spinning);
}

function slotCenter(col, row) {
  return { x: col * SLOT_WIDTH + SLOT_WIDTH / 2, y: row * SLOT_HEIGHT + SLOT_HEIGHT / 2 };
}

// Zeichnet für jede gewonnene Linie eine Verbindungslinie über die (von links)
// gewinnenden Symbole - nur über die tatsächlich zählenden `count` Positionen,
// nicht über die ganze Payline (bei 5 Treffern bis zum rechten Rand).
function drawWinningLines() {
  activeWinningLines.forEach(({ line, count }) => {
    const coords = PAYLINES[line]?.slice(0, count);
    if (!coords || coords.length < 2) return;
    const points = coords.map(([col, row]) => slotCenter(col, row));
    drawWinLine(ctx, points, canvas.width, count >= GRID_COLS);
  });
}

// "col,row"-Schlüssel aller Kacheln, die zu einer aktiven Gewinnlinie zählen.
function winningCells() {
  const cells = new Set();
  if (!isAllStopped()) return cells;
  activeWinningLines.forEach(({ line, count }) => {
    PAYLINES[line]?.slice(0, count).forEach(([col, row]) => cells.add(`${col},${row}`));
  });
  return cells;
}

function frameVariant(symbol, isWin) {
  if (isWin) return "win";
  return BONUS_SYMBOLS.includes(symbol) ? "bonus" : "standard";
}

function drawSymbol(name, x, y) {
  const img = images[name];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, SLOT_WIDTH, SLOT_HEIGHT);
    return;
  }
  // Platzhalter, solange kein Custom-Asset vorhanden ist
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x, y, SLOT_WIDTH, SLOT_HEIGHT);
  ctx.strokeStyle = "#555";
  ctx.strokeRect(x + 1, y + 1, SLOT_WIDTH - 2, SLOT_HEIGHT - 2);
  ctx.fillStyle = "#fff";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, x + SLOT_WIDTH / 2, y + SLOT_HEIGHT / 2);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const wins = winningCells();
  // Kacheln sammeln, damit Gewinn-Rahmen (mit Glow) und die Eck-Rauten in
  // eigenen Durchgängen über den normalen Kacheln liegen.
  const tiles = [];
  reelState.forEach((reel, col) => {
    const x = col * SLOT_WIDTH;
    if (reel.spinning) {
      // GRID_ROWS+1 Symbole zeichnen, damit das 3-Reihen-Fenster beim Scrollen
      // lückenlos gefüllt bleibt.
      for (let i = 0; i <= GRID_ROWS; i += 1) {
        const symbol = reel.spinSymbols[(reel.spinIndex + i) % reel.spinSymbols.length];
        tiles.push({ symbol, x, y: i * SLOT_HEIGHT - reel.offset, clipCol: x, variant: frameVariant(symbol, false) });
      }
    } else {
      reel.columnSymbols.forEach((symbol, row) => {
        const variant = frameVariant(symbol, wins.has(`${col},${row}`));
        tiles.push({ symbol, x, y: row * SLOT_HEIGHT, clipCol: null, variant });
      });
    }
  });

  const withClip = (tile, draw) => {
    ctx.save();
    if (tile.clipCol !== null) {
      ctx.beginPath();
      ctx.rect(tile.clipCol, 0, SLOT_WIDTH, canvas.height);
      ctx.clip();
    }
    draw();
    ctx.restore();
  };
  const normal = tiles.filter((t) => t.variant !== "win");
  const winning = tiles.filter((t) => t.variant === "win");
  [normal, winning].forEach((group) =>
    group.forEach((t) =>
      withClip(t, () => {
        drawSymbol(t.symbol, t.x, t.y);
        drawTileFrame(ctx, t.x, t.y, SLOT_WIDTH, SLOT_HEIGHT, t.variant);
      })
    )
  );
  tiles.forEach((t) => withClip(t, () => drawTileCorners(ctx, t.x, t.y, SLOT_WIDTH, SLOT_HEIGHT, t.variant)));

  if (activeWinningLines.length > 0 && isAllStopped()) {
    drawWinningLines();
  }
}

function tick(timestamp) {
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  let anySpinning = false;

  reelState.forEach((reel) => {
    if (!reel.spinning) return;
    anySpinning = true;
    reel.offset += SPIN_SPEED_PX_PER_MS * delta;
    if (reel.offset >= SLOT_HEIGHT) {
      reel.offset -= SLOT_HEIGHT;
      reel.spinIndex = (reel.spinIndex + 1) % reel.spinSymbols.length;
    }
  });

  render();
  animationHandle = anySpinning ? requestAnimationFrame(tick) : null;
}

function ensureAnimating() {
  if (animationHandle === null) {
    lastTimestamp = performance.now();
    animationHandle = requestAnimationFrame(tick);
  }
}

export async function init() {
  await loadImages();
  render();
}

export function startSpin() {
  activeWinningLines = [];
  reelState.forEach((reel) => {
    reel.spinning = true;
    reel.offset = 0;
    reel.spinIndex = 0;
    reel.spinSymbols = buildSpinStrip();
  });
  ensureAnimating();
}

// grid: vom Server als [reihe][spalte] gesendet (GRID_ROWS Reihen à GRID_COLS Symbole).
// Gibt ein Promise zurück, das erfüllt wird sobald die letzte Spalte steht - so
// kann socket.js Folgeanimationen (Multiplikatoren, Gewinnlinien) erst danach starten.
// onReelStop(col) wird im selben Moment aufgerufen, in dem eine Spalte stehen bleibt.
export function stopOnSymbol(grid, onReelStop) {
  return new Promise((resolve) => {
    for (let col = 0; col < GRID_COLS; col += 1) {
      setTimeout(() => {
        reelState[col].spinning = false;
        reelState[col].columnSymbols = grid.map((row) => row[col]);
        reelState[col].offset = 0;
        render();
        onReelStop?.(col);
        if (col === GRID_COLS - 1) resolve();
      }, col * STOP_STAGGER_MS);
    }
  });
}

// lines: data.winning_lines aus dem "spin_result"-Event, z.B.
// [{ line: 0, symbol: "seven", count: 3, win: 100 }, ...]. Wird erst gezeichnet,
// sobald alle Walzen stehen (siehe isAllStopped() in render()).
export function showWinningLines(lines) {
  activeWinningLines = lines || [];
  render();
}
