// Symbolrahmen und Gewinnlinie auf dem Walzen-Canvas - übernommen aus
// "Symbol Rahmen.html" (Varianten STANDARD / GEWINN / BONUS, Gewinnlinie mit
// Rauten-Knoten). Alle Maße in px relativ zu einer Kachel (120 x 93,3).

const BORDER = 5;

const STYLES = {
  standard: {
    outer: [[0, "#fff6c4"], [0.22, "#f0c24e"], [0.45, "#8a5a12"], [0.62, "#f7dc84"], [0.8, "#b37a1c"], [1, "#fff0a8"]],
    glow: null,
    // [inset, Linienstärke, Farbe]
    lines: [[5, 1, "#2a1603"], [6, 1, "rgba(245, 209, 106, 0.35)"]],
  },
  win: {
    outer: [[0, "#ffffff"], [0.25, "#fff3b0"], [0.5, "#f0c24e"], [0.75, "#fff6c4"], [1, "#f7d774"]],
    glow: "rgba(247, 215, 116, 0.9)",
    lines: [[5, 2, "#c21a1a"], [7, 1, "#fff3b0"]],
  },
  bonus: {
    outer: [[0, "#fff6c4"], [0.22, "#f0c24e"], [0.45, "#8a5a12"], [0.62, "#f7dc84"], [0.8, "#b37a1c"], [1, "#fff0a8"]],
    glow: null,
    lines: [[5, 3, ["#3f7fd9", "#1d4f9c", "#0b2a5b"]], [8, 1, "#f0c24e"]],
  },
};

const DIAMONDS = {
  gold: { stops: ["#fff6c4", "#e0a82e", "#7a4c0e"], border: "#3a1f05" },
  blue: { stops: ["#7fb2ff", "#1d4f9c", "#06142e"], border: "#f0c24e" },
  red: { stops: ["#ff6a4d", "#c21a1a", "#5a0606"], border: "#fff3b0" },
};

// Entspricht CSS linear-gradient(160deg, ...) über das Rechteck.
function cssAngleGradient(ctx, x, y, w, h, deg, stops) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function ring(ctx, x, y, w, h, inset, width) {
  ctx.beginPath();
  ctx.rect(x + inset, y + inset, w - 2 * inset, h - 2 * inset);
  ctx.rect(x + inset + width, y + inset + width, w - 2 * (inset + width), h - 2 * (inset + width));
}

// Raute (um 45° gedrehtes Quadrat), Verlauf von hell oben nach dunkel unten.
function drawDiamond(ctx, cx, cy, halfDiag, borderWidth, { stops, border }) {
  const path = (r) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  };
  path(halfDiag);
  ctx.fillStyle = border;
  ctx.fill();
  const inner = halfDiag - borderWidth * Math.SQRT2;
  const g = ctx.createLinearGradient(cx, cy - inner, cx, cy + inner);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  path(inner);
  ctx.fillStyle = g;
  ctx.fill();
}

// Rahmen einer Kachel ohne Eck-Rauten (die kommen per drawTileCorners obendrauf,
// damit der Glow von Gewinn-Kacheln sie nicht überdeckt).
export function drawTileFrame(ctx, x, y, w, h, variant = "standard") {
  const style = STYLES[variant] || STYLES.standard;
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);

  ctx.save();
  ring(ctx, x, y, w, h, 0, BORDER);
  ctx.fillStyle = cssAngleGradient(ctx, x, y, w, h, 160, style.outer);
  if (style.glow) {
    // box-shadow: 0 0 10px (außen) + inset 0 0 10px (innen)
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 10;
    ctx.fill("evenodd");
    ctx.fill("evenodd");
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
  ctx.fill("evenodd");

  style.lines.forEach(([inset, width, color]) => {
    if (Array.isArray(color)) {
      const g = ctx.createLinearGradient(0, y + inset, 0, y + h - inset);
      color.forEach((c, i) => g.addColorStop(i / (color.length - 1), c));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = color;
    }
    ring(ctx, x, y, w, h, inset, width);
    ctx.fill("evenodd");
  });
  ctx.restore();
}

export function drawTileCorners(ctx, x, y, w, h, variant = "standard") {
  const diamond = variant === "bonus" ? DIAMONDS.blue : DIAMONDS.gold;
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  // 10px-Quadrat + 1px Rand an Position 1/1 -> Mittelpunkt 7px vom Eck
  const half = 6 * Math.SQRT2;
  ctx.save();
  [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]].forEach(([cx, cy]) =>
    drawDiamond(ctx, cx, cy, half, 1, diamond)
  );
  ctx.restore();
}

// Gewinnlinie: points = Kachel-Mittelpunkte [{x, y}], startet am linken Rand und
// läuft bis zum rechten Rand, wenn fullWidth gesetzt ist (alle Walzen gewinnen).
export function drawWinLine(ctx, points, canvasWidth, fullWidth) {
  if (points.length === 0) return;
  const path = [{ x: 0, y: points[0].y }, ...points];
  if (fullWidth) path.push({ x: canvasWidth, y: points[points.length - 1].y });

  const trace = () => {
    ctx.beginPath();
    path.forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  };
  const ys = path.map((p) => p.y);
  const minY = Math.min(...ys) - 3;
  const maxY = Math.max(...ys) + 3;
  const gold = ctx.createLinearGradient(0, minY, 0, maxY);
  gold.addColorStop(0, "#fff6c4");
  gold.addColorStop(0.45, "#f0c24e");
  gold.addColorStop(1, "#b37a1c");

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.globalAlpha = 0.55;
  ctx.filter = "blur(4px)";
  ctx.strokeStyle = "#f7d774";
  ctx.lineWidth = 14;
  trace();
  ctx.stroke();
  ctx.filter = "none";
  ctx.globalAlpha = 1;

  [["#3a1f05", 9], [gold, 6], ["#fffbe6", 1.5]].forEach(([stroke, width]) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    trace();
    ctx.stroke();
  });

  // Rote Rauten-Knoten (14px, 2px Rand, leichter Glow) auf jedem Gewinn-Symbol
  points.forEach(({ x, y }) => {
    ctx.shadowColor = "rgba(247, 215, 116, 0.9)";
    ctx.shadowBlur = 6;
    drawDiamond(ctx, x, y, 7 * Math.SQRT2, 2, DIAMONDS.red);
  });
  ctx.restore();
}
