// Aufwändigere Meme-Animationen für event_media_map.json (Feld "anim"). Alle
// haben dieselbe Signatur (eventName, el, entry, pos, onComplete, context) und
// werden von showEvent() in effects.js über MEME_ANIMS aufgerufen. Einige
// greifen direkt ins Spielbild ein (Rahmen #frame, Walzen #reels,
// Multiplikator-Badges) - dabei werden nur deren eigene Animationen gesetzt und
// am Ende wieder beendet, #stage selbst (Kiosk-Skalierung) bleibt unberührt.
import { DISPLAY, REEL_WINDOW } from "./config.js";
import {
  layer,
  trackTimer,
  trackAnimation,
  trackLoop,
  playTrackedSounds,
  stopEventSounds,
  createEventDiv,
  shake,
  flashScreen,
  fadeOutAndRemove,
} from "./fx_core.js";

const { width: W, height: H } = DISPLAY;
const STAGE_CENTER = { x: W / 2, y: H / 2 };
const REEL_CENTER = { x: REEL_WINDOW.left + REEL_WINDOW.width / 2, y: REEL_WINDOW.top + REEL_WINDOW.height / 2 };
const RAINBOW = ["#ff0040", "#00e5ff", "#ffea00", "#00ff6a", "#ff00ea", "#ff7b00"];

// --- Hilfsfunktionen -------------------------------------------------------

function anim(eventName, node, keyframes, options) {
  return trackAnimation(eventName, node.animate(keyframes, options));
}

// Promise, das nach ms auflöst - bricht clearEvent() ab, löst es nie auf und
// die restliche async-Sequenz läuft einfach nicht weiter.
function wait(eventName, ms) {
  return new Promise((resolve) => trackTimer(eventName, setTimeout(resolve, ms)));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Das Spielbild unter dem Overlay: Rahmen, Walzen-Canvas, Multiplikator-Badges.
function stageLayers() {
  return ["frame", "reels", "multiplier-layer"].map((id) => document.getElementById(id)).filter(Boolean);
}

// Animiert alle Ebenen des Spielbilds gemeinsam wie ein einziges Bild: der
// transform-origin wird pro Ebene so gesetzt, dass alle um denselben
// Stage-Punkt (origin) skalieren/drehen.
function animateStage(eventName, keyframes, options, origin = STAGE_CENTER) {
  return stageLayers().map((node) => {
    node.style.transformOrigin = `${origin.x - node.offsetLeft}px ${origin.y - node.offsetTop}px`;
    return anim(eventName, node, keyframes, options);
  });
}

// Führt Elemente aus dem Zustand `from` zurück in den Normalzustand und beendet
// danach alle ihre Animationen (sonst bliebe fill:"forwards" hängen).
function restore(eventName, nodes, from, durationMs, players) {
  const back = nodes.map((node) =>
    anim(eventName, node, [from, { filter: "none", transform: "none" }], {
      duration: durationMs,
      easing: "ease-in-out",
      fill: "forwards",
    })
  );
  trackTimer(
    eventName,
    setTimeout(() => [...players, ...back].forEach((player) => player.cancel()), durationMs)
  );
}

// Position/Größe eines DOM-Elements in Stage-Koordinaten (800x480), auch wenn
// die Stage im Kiosk-Modus skaliert ist.
function stageRectOf(node) {
  const stageRect = document.getElementById("stage").getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const scale = stageRect.width / W;
  return {
    left: (rect.left - stageRect.left) / scale,
    top: (rect.top - stageRect.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}

// Schreibmaschinen-Text; blip (Sound-Angabe) piepst alle paar Zeichen.
async function typeText(eventName, node, text, charMs, blip = null) {
  node.textContent = "";
  for (let i = 0; i < text.length; i += 1) {
    node.textContent += text[i];
    if (blip && i % 3 === 0 && text[i] !== " ") playTrackedSounds(eventName, blip);
    await wait(eventName, charMs);
  }
}

// Positioniert das von showEvent() erzeugte Bild neu bzw. entfernt es, wenn
// der Eintrag kein eigenes Bild hat ("type": "text" oder kein "src").
function ownImage(entry, el) {
  if (entry.type !== "text" && entry.src) return el;
  el.remove();
  return null;
}

// --- 1. "to_be_continued" -----------------------------------------------------

// JoJo-Freeze-Frame: Das Spielbild friert in Sepia ein (leichter Zoom und
// Schieflage, Vignette), dann fährt der "To Be Continued"-Pfeil von links
// herein. Felder (alle optional): freeze_at_ms (Zeitpunkt des Einfrierens,
// z.B. passend zum Einsatz von "roundabout", Default 0), arrow_delay_ms (350),
// hold_ms (2600), fade_out_ms (400), text ("To Be Continued").
function runToBeContinued(eventName, el, entry, pos, onComplete) {
  el.remove();
  const freezeAtMs = entry.freeze_at_ms ?? 0;
  const arrowDelayMs = entry.arrow_delay_ms ?? 350;
  const holdMs = entry.hold_ms ?? 2600;
  const fadeOutMs = entry.fade_out_ms ?? 400;
  const frozen = { filter: "sepia(1) contrast(1.25) brightness(0.85) saturate(1.3)", transform: "scale(1.05) rotate(-1deg)" };

  (async () => {
    await wait(eventName, freezeAtMs);
    flashScreen(eventName, { peak: 0.6, durationMs: 220 });
    const players = animateStage(eventName, [{ filter: "none", transform: "none" }, frozen], {
      duration: 250,
      easing: "ease-out",
      fill: "forwards",
    });
    const vignette = createEventDiv(
      eventName,
      "inset:0;opacity:0;background:radial-gradient(ellipse at center, rgba(60,40,10,0) 45%, rgba(40,25,5,0.8) 100%)"
    );
    anim(eventName, vignette, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" });

    await wait(eventName, arrowDelayMs);
    const arrow = createEventDiv(eventName, "left:22px;top:392px;width:380px;height:70px");
    arrow.innerHTML =
      '<svg width="380" height="70" viewBox="0 0 380 70">' +
      '<polygon points="4,35 52,4 52,15 374,15 374,55 52,55 52,66" fill="#d9c485" stroke="#3b2a10" stroke-width="4" stroke-linejoin="round"/>' +
      '<text x="216" y="44" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="25" fill="#3b2a10"></text>' +
      "</svg>";
    arrow.querySelector("text").textContent = entry.text ?? "To Be Continued";
    anim(eventName, arrow, [{ transform: "translateX(-440px)" }, { transform: "translateX(0)" }], {
      duration: 450,
      easing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
      fill: "forwards",
    });

    await wait(eventName, holdMs);
    restore(eventName, stageLayers(), frozen, fadeOutMs, players);
    fadeOutAndRemove(eventName, [vignette, arrow], fadeOutMs, onComplete);
  })();
}

// --- 2. "thanos_snap" ---------------------------------------------------------

// Die Walzen zerfallen von links nach rechts zu Staub, der davonweht (wie nach
// Thanos' Schnipsen), danach tauchen sie wieder auf. Das aktuelle Walzenbild
// wird dazu in Blöcke zerlegt und als Partikel auf ein Canvas gezeichnet.
// Felder (alle optional): block_px (Partikelgröße, 10 - kleiner sieht feiner
// aus, kostet aber auf dem Pi mehr), start_delay_ms (300), dissolve_ms (2400),
// hold_ms (500), return_ms (500), caption (Untertitel, "" = keiner).
function runThanosSnap(eventName, el, entry, pos, onComplete) {
  el.remove();
  const block = entry.block_px ?? 10;
  const startDelayMs = entry.start_delay_ms ?? 300;
  const dissolveMs = entry.dissolve_ms ?? 2400;
  const holdMs = entry.hold_ms ?? 500;
  const returnMs = entry.return_ms ?? 500;
  const caption = entry.caption ?? "Mr. Stark, ich fühle mich nicht so gut ...";
  const { left, top, width: w, height: h } = REEL_WINDOW;
  const reelNodes = ["reels", "multiplier-layer"].map((id) => document.getElementById(id)).filter(Boolean);

  const snapshot = document.createElement("canvas");
  snapshot.width = w;
  snapshot.height = h;
  snapshot.getContext("2d").drawImage(document.getElementById("reels"), 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.dataset.event = eventName;
  canvas.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  layer.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(snapshot, left, top);

  // Originale ausblenden - ab jetzt zeigt nur noch das Partikel-Canvas die Walzen.
  const hidden = reelNodes.map((node) => anim(eventName, node, [{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" }));

  const cols = Math.ceil(w / block);
  const rows = Math.ceil(h / block);
  const particles = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      particles.push({
        sx: c * block,
        sy: r * block,
        delay: startDelayMs + (c / cols) * dissolveMs * 0.55 + Math.random() * dissolveMs * 0.3,
        life: 700 + Math.random() * 900,
        vx: 0.05 + Math.random() * 0.12,
        vy: -(0.02 + Math.random() * 0.08),
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }
  const endMs = particles.reduce((max, p) => Math.max(max, p.delay + p.life), 0);

  let subtitle = null;
  if (caption) {
    subtitle = createEventDiv(
      eventName,
      `left:0;width:${W}px;top:${H - 70}px;text-align:center;opacity:0;font-family:Arial, sans-serif;font-size:22px;` +
        "color:#fff;text-shadow:0 0 4px #000, 2px 2px 2px #000"
    );
    subtitle.textContent = caption;
    anim(eventName, subtitle, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: startDelayMs + 400, fill: "forwards" });
  }

  const finish = () => {
    trackTimer(
      eventName,
      setTimeout(() => {
        const back = reelNodes.map((node) =>
          anim(eventName, node, [{ opacity: 0 }, { opacity: 1 }], { duration: returnMs, easing: "ease-out", fill: "forwards" })
        );
        const leftovers = subtitle ? [canvas, subtitle] : [canvas];
        fadeOutAndRemove(eventName, leftovers, returnMs, () => {
          [...hidden, ...back].forEach((player) => player.cancel());
          onComplete?.();
        });
      }, holdMs)
    );
  };

  trackLoop(eventName, (t) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      const age = t - p.delay;
      if (age < 0) {
        ctx.globalAlpha = 1;
        ctx.drawImage(snapshot, p.sx, p.sy, block, block, left + p.sx, top + p.sy, block, block);
        continue;
      }
      const k = age / p.life;
      if (k >= 1) continue;
      const size = block * (1 - k * 0.7);
      const x = left + p.sx + p.vx * age + Math.sin(p.wobble + age / 180) * 6 * k;
      const y = top + p.sy + p.vy * age;
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(snapshot, p.sx, p.sy, block, block, x, y, size, size);
      ctx.fillStyle = "rgba(110,90,70,0.6)";
      ctx.fillRect(x - p.vx * 60, y - p.vy * 60, size * 0.4, size * 0.4);
    }
    ctx.globalAlpha = 1;
    if (t < endMs) return true;
    finish();
    return false;
  });
}

// --- 3. "laser_eyes" ----------------------------------------------------------

// Die Pharaonen-Porträts im Rahmen laden rot glühende Augen auf und feuern
// Laserstrahlen auf die Walzen, die aufglühen, wackeln und Funken sprühen.
// Felder (alle optional): charge_ms (700), fire_ms (2000), fade_out_ms (400),
// eyes (Augenpositionen in % des Porträts, Default zwei auf 36/64 x 44),
// beam_color ("#ff1a1a"), target ({x, y} Stage-Koordinaten, Default Mitte der
// Walzen), portrait_selector (Default alle Porträts außer dem Buch).
const LASER_PORTRAIT_SCALE = 1.12;

function runLaserEyes(eventName, el, entry, pos, onComplete) {
  el.remove();
  const chargeMs = entry.charge_ms ?? 700;
  const fireMs = entry.fire_ms ?? 2000;
  const fadeOutMs = entry.fade_out_ms ?? 400;
  const eyes = entry.eyes ?? [
    { x: 36, y: 44 },
    { x: 64, y: 44 },
  ];
  const color = entry.beam_color ?? "#ff1a1a";
  const target = entry.target ?? REEL_CENTER;
  const portraits = [...document.querySelectorAll(entry.portrait_selector ?? ".frame-portrait:not(.frame-portrait-contain)")];
  const reelNodes = ["reels", "multiplier-layer"].map((id) => document.getElementById(id)).filter(Boolean);
  const nodes = [];
  const beams = [];

  // Positionen vor dem Hochskalieren messen, die Skalierung (um die Porträt-Mitte) einrechnen.
  portraits.forEach((portrait) => {
    const r = stageRectOf(portrait);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    eyes.forEach(({ x, y }) => {
      const ex = cx + (r.left + (r.width * x) / 100 - cx) * LASER_PORTRAIT_SCALE;
      const ey = cy + (r.top + (r.height * y) / 100 - cy) * LASER_PORTRAIT_SCALE;
      const dx = target.x - ex;
      const dy = target.y - ey;
      const beam = createEventDiv(
        eventName,
        `left:${ex}px;top:${ey - 4}px;width:${Math.hypot(dx, dy)}px;height:8px;transform-origin:0 50%;opacity:0;` +
          `border-radius:4px;mix-blend-mode:screen;box-shadow:0 0 14px ${color};` +
          `background:linear-gradient(180deg, rgba(255,0,0,0) 0%, ${color} 25%, #fff 50%, ${color} 75%, rgba(255,0,0,0) 100%)`
      );
      const glow = createEventDiv(
        eventName,
        `left:${ex - 20}px;top:${ey - 20}px;width:40px;height:40px;border-radius:50%;opacity:0;mix-blend-mode:screen;` +
          `background:radial-gradient(circle, #fff 0 12%, ${color} 35%, rgba(255,0,0,0) 70%)`
      );
      anim(eventName, glow, [{ opacity: 0, transform: "scale(0.3)" }, { opacity: 1, transform: "scale(1)" }], {
        duration: chargeMs,
        easing: "ease-in",
        fill: "forwards",
      });
      anim(eventName, glow, [{ scale: "1" }, { scale: "1.6" }, { scale: "1" }], { duration: 160, delay: chargeMs, iterations: Infinity });
      beams.push({ beam, angle: (Math.atan2(dy, dx) * 180) / Math.PI });
      nodes.push(beam, glow);
    });
  });

  const portraitHot = { filter: `brightness(1.3) drop-shadow(0 0 6px ${color})`, transform: `scale(${LASER_PORTRAIT_SCALE})` };
  const portraitPlayers = portraits.map((portrait) =>
    anim(eventName, portrait, [{ filter: "none", transform: "none" }, portraitHot], { duration: chargeMs, fill: "forwards" })
  );

  const reelsHot = { filter: "brightness(1.5) saturate(2) sepia(0.5) hue-rotate(-30deg)" };
  let reelPlayers = [];

  trackTimer(
    eventName,
    setTimeout(() => {
      flashScreen(eventName, { color, peak: 0.45, durationMs: 200 });
      beams.forEach(({ beam, angle }) => {
        anim(eventName, beam, [
          { opacity: 1, transform: `rotate(${angle}deg) scaleX(0)` },
          { opacity: 1, transform: `rotate(${angle}deg) scaleX(1)` },
        ], { duration: 120, easing: "ease-out", fill: "forwards" });
        anim(eventName, beam, [{ filter: "brightness(1)" }, { filter: "brightness(1.8)" }, { filter: "brightness(0.8)" }], {
          duration: 90,
          delay: 120,
          iterations: Infinity,
        });
      });

      reelPlayers = reelNodes.flatMap((node) => [
        anim(eventName, node, [{ filter: "none" }, reelsHot], { duration: 400, fill: "forwards" }),
        anim(eventName, node, [
          { translate: "0 0" },
          { translate: "-4px 3px" },
          { translate: "4px -3px" },
          { translate: "0 0" },
        ], { duration: 110, iterations: Infinity }),
      ]);

      const tint = createEventDiv(eventName, "inset:0;background:#ff0000;mix-blend-mode:multiply;opacity:0");
      anim(eventName, tint, [{ opacity: 0.1 }, { opacity: 0.3 }, { opacity: 0.15 }], { duration: 180, iterations: Infinity });
      nodes.push(tint);

      const impact = createEventDiv(
        eventName,
        `left:${target.x - 90}px;top:${target.y - 90}px;width:180px;height:180px;border-radius:50%;mix-blend-mode:screen;` +
          "background:radial-gradient(circle, #fff 0 15%, #ffe066 30%, rgba(255,60,0,0.8) 50%, rgba(255,0,0,0) 72%)"
      );
      anim(eventName, impact, [{ transform: "scale(0.8)" }, { transform: "scale(1.2)" }, { transform: "scale(0.9)" }], {
        duration: 140,
        iterations: Infinity,
      });
      nodes.push(impact);

      for (let t = 0; t < fireMs - 200; t += 45) {
        trackTimer(eventName, setTimeout(() => spawnSpark(eventName, target), t));
      }
    }, chargeMs)
  );

  trackTimer(
    eventName,
    setTimeout(() => {
      restore(eventName, portraits, portraitHot, fadeOutMs, portraitPlayers);
      restore(eventName, reelNodes, reelsHot, fadeOutMs, reelPlayers);
      fadeOutAndRemove(eventName, nodes, fadeOutMs, onComplete);
    }, chargeMs + fireMs)
  );
}

function spawnSpark(eventName, origin) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 60 + Math.random() * 120;
  const spark = createEventDiv(
    eventName,
    `left:${origin.x - 2}px;top:${origin.y - 2}px;width:5px;height:5px;border-radius:50%;background:#fff6a0;box-shadow:0 0 6px #ffb300`
  );
  const player = spark.animate(
    [
      { transform: "translate(0, 0)", opacity: 1 },
      { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance + 40}px)`, opacity: 0 },
    ],
    { duration: 350 + Math.random() * 250, easing: "ease-out" }
  );
  trackAnimation(eventName, player);
  player.onfinish = () => spark.remove();
}

// --- 4. "stonks" --------------------------------------------------------------

// Börsenchart über dem Bildschirm: Die Kurve zeichnet sich live, ein Ticker
// zählt mit. "up": steil nach oben, am Ende "STONKS". "down": erst leicht
// hoch, dann Absturz durch den Boden, "NOT STONKS" und das GEWINN-Schild
// wackelt. Felder (alle optional): direction ("up"/"down"), draw_ms (2200),
// hold_ms (1800), fade_out_ms (400), points (28), ticker ("DOME"), label,
// src (Bild, das am Ende unten links auftaucht - z.B. der Stonks-Typ).
function runStonks(eventName, el, entry, pos, onComplete) {
  const up = (entry.direction ?? "up") !== "down";
  const drawMs = entry.draw_ms ?? 2200;
  const holdMs = entry.hold_ms ?? 1800;
  const fadeOutMs = entry.fade_out_ms ?? 400;
  const pointCount = entry.points ?? 28;
  const ticker = entry.ticker ?? "DOME";
  const label = entry.label ?? (up ? "STONKS" : "NOT STONKS");
  const color = up ? "#00e676" : "#ff1744";
  const image = ownImage(entry, el);
  if (image) image.style.opacity = "0";

  const points = [];
  for (let i = 0; i < pointCount; i += 1) {
    const k = i / (pointCount - 1);
    const y = up
      ? 400 - k * 300 + (Math.random() - 0.5) * 60 * (1 - k * 0.5)
      : k < 0.7
        ? 150 - k * 60 + (Math.random() - 0.5) * 50
        : 108 + ((k - 0.7) / 0.3) ** 1.6 * 420 + (Math.random() - 0.5) * 20;
    points.push([50 + k * 700, y]);
  }
  const lineD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L${points[points.length - 1][0]} ${H} L${points[0][0]} ${H} Z`;
  const gradientId = `stonks-fill-${Date.now()}`;

  const panel = createEventDiv(
    eventName,
    "inset:0;opacity:0;background-color:rgba(4,10,24,0.9);" +
      "background-image:linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px);" +
      "background-size:40px 40px",
    image
  );
  panel.innerHTML =
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0">` +
    `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>` +
    `<path class="area" d="${areaD}" fill="url(#${gradientId})" opacity="0"/>` +
    `<path class="line" d="${lineD}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ${color})"/>` +
    `<circle class="head" r="7" fill="#fff" style="filter:drop-shadow(0 0 8px ${color})"/>` +
    "</svg>" +
    '<div class="ticker" style="position:absolute;left:24px;top:18px;font-family:\'Courier New\', monospace;font-weight:bold;font-size:26px"></div>';
  const line = panel.querySelector(".line");
  const area = panel.querySelector(".area");
  const head = panel.querySelector(".head");
  const tickerEl = panel.querySelector(".ticker");
  const length = line.getTotalLength();
  line.style.strokeDasharray = `${length}`;
  line.style.strokeDashoffset = `${length}`;

  anim(eventName, panel, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" });

  let crashed = false;
  const finish = () => {
    anim(eventName, area, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "forwards" });
    const labelEl = createEventDiv(
      eventName,
      `left:0;width:${W}px;top:160px;text-align:center;font-family:Impact, "Arial Black", sans-serif;font-size:${up ? 120 : 96}px;` +
        `color:${up ? "#fff" : color};-webkit-text-stroke:4px #000;paint-order:stroke fill;text-shadow:0 6px 0 #000`
    );
    labelEl.textContent = label;
    anim(eventName, labelEl, [
      { opacity: 0, transform: "rotate(-6deg) scale(2.2)" },
      { opacity: 1, transform: "rotate(-6deg) scale(0.95)", offset: 0.7 },
      { opacity: 1, transform: "rotate(-6deg) scale(1)" },
    ], { duration: 320, easing: "ease-out", fill: "forwards" });
    const nodes = [panel, labelEl];
    if (image) {
      layer.appendChild(image);
      anim(eventName, image, [{ opacity: 0, transform: "translateY(60px)" }, { opacity: 1, transform: "translateY(0)" }], {
        duration: 350,
        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        fill: "forwards",
      });
      nodes.push(image);
    }
    trackTimer(eventName, setTimeout(() => fadeOutAndRemove(eventName, nodes, fadeOutMs, onComplete), holdMs));
  };

  trackLoop(eventName, (t) => {
    const k = Math.min(1, t / drawMs);
    line.style.strokeDashoffset = `${length * (1 - k)}`;
    const point = line.getPointAtLength(length * k);
    head.setAttribute("cx", point.x);
    head.setAttribute("cy", point.y);
    const pct = up ? k * 420.69 : k < 0.7 ? (k / 0.7) * 12.5 : 12.5 - ((k - 0.7) / 0.3) * 112.4;
    tickerEl.textContent = `${ticker}  ${pct >= 0 ? "▲ +" : "▼ "}${pct.toFixed(2)}%`;
    tickerEl.style.color = pct >= 0 ? "#00e676" : "#ff1744";
    if (!up && !crashed && k >= 0.75) {
      crashed = true;
      flashScreen(eventName, { color: "#ff1744", peak: 0.4, durationMs: 300 });
      shake(eventName, panel, { amplitude: 12, durationMs: 400 });
      const plates = document.querySelector(".frame-plates");
      if (plates) shake(eventName, plates, { amplitude: 10, durationMs: 600 });
    }
    if (k < 1) return true;
    finish();
    return false;
  });
}

// --- 5. "crt_off" -------------------------------------------------------------

// Röhrenfernseher schaltet ab: Das Spielbild klappt zu einer hellen Linie,
// dann zu einem Punkt zusammen, kurz Schwarz, dann Rauschen und es geht wieder
// an. Felder (alle optional): collapse_ms (220), line_ms (180), off_ms (900),
// static_ms (450), on_ms (350). Sound-Tipp: ["crt_off", {"name":
// "tv_static", "delay_ms": collapse_ms + line_ms + off_ms}].
function runCrtOff(eventName, el, entry, pos, onComplete) {
  el.remove();
  const collapseMs = entry.collapse_ms ?? 220;
  const lineMs = entry.line_ms ?? 180;
  const offMs = entry.off_ms ?? 900;
  const staticMs = entry.static_ms ?? 450;
  const onMs = entry.on_ms ?? 350;
  const lineState = { transform: "scale(1, 0.006)", filter: "brightness(4)" };
  const offState = { transform: "scale(0, 0.006)", filter: "brightness(6)" };
  const players = [];

  (async () => {
    players.push(...animateStage(eventName, [{ transform: "scale(1, 1)", filter: "brightness(1)" }, lineState], {
      duration: collapseMs,
      easing: "ease-in",
      fill: "forwards",
    }));
    await wait(eventName, collapseMs);
    players.push(...animateStage(eventName, [lineState, offState], { duration: lineMs, easing: "ease-in", fill: "forwards" }));
    await wait(eventName, lineMs);

    const dot = createEventDiv(
      eventName,
      `left:${W / 2 - 5}px;top:${H / 2 - 5}px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 16px 6px rgba(200,230,255,0.9)`
    );
    anim(eventName, dot, [{ opacity: 1, transform: "scale(1.4)" }, { opacity: 0, transform: "scale(0.2)" }], {
      duration: Math.min(offMs, 600),
      easing: "ease-in",
      fill: "forwards",
    });
    await wait(eventName, offMs);
    dot.remove();

    const noise = document.createElement("canvas");
    noise.width = 200;
    noise.height = 120;
    noise.dataset.event = eventName;
    noise.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;image-rendering:pixelated;pointer-events:none`;
    layer.appendChild(noise);
    const noiseCtx = noise.getContext("2d");
    const pixels = noiseCtx.createImageData(noise.width, noise.height);
    const noiseLoop = trackLoop(eventName, () => {
      const d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      noiseCtx.putImageData(pixels, 0, 0);
      return true;
    });
    await wait(eventName, staticMs);

    players.push(...animateStage(eventName, [offState, { ...lineState, offset: 0.4 }, { transform: "scale(1, 1)", filter: "brightness(1)" }], {
      duration: onMs,
      easing: "ease-out",
      fill: "forwards",
    }));
    anim(eventName, noise, [{ opacity: 1 }, { opacity: 0 }], { duration: onMs, fill: "forwards" });
    await wait(eventName, onMs);
    noiseLoop.cancel();
    noise.remove();
    players.forEach((player) => player.cancel());
    onComplete?.();
  })();
}

// --- 6. "pokemon_battle" ------------------------------------------------------

// Pokémon-Kampf für einen Multiplikator: Blitze + Balken-Übergang, Kampfszene
// mit KP-Balken und Textbox. Der Spieler setzt "MULTIPLIKATOR x{value}" ein,
// die KP der Slotmaschine sinken um value / ko_value, ab ko_value ist sie K.O.
// Felder (alle optional): player_src, player_name ("OLEG"), enemy_src,
// enemy_name ("GLÜCKSMASCHINE"), enemy_intro (Einleitungssatz, {name} = Gegner,
// Default "Eine wilde {name} erscheint!"), attack_name ("MULTIPLIKATOR"), ko_value
// (6), char_ms (28), line_pause_ms (650), hold_ms (900), fade_out_ms (400),
// text_blip / hit_sound / faint_sound (Sound-Angaben, false = stumm).
const POKE_BOX =
  "position:absolute;padding:8px 14px 10px;background:#f8f8d8;border:4px solid #404040;border-radius:12px 3px 12px 3px;" +
  "box-shadow:4px 4px 0 rgba(0,0,0,0.25);font-weight:bold;font-size:20px;color:#303030";
const POKE_HP =
  '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
  '<span style="font-size:13px;color:#f8b030;background:#404040;padding:0 5px;border-radius:3px">KP</span>' +
  '<div style="flex:1;height:10px;background:#505050;border:2px solid #404040;border-radius:5px;overflow:hidden">' +
  '<div class="pk-fill" style="height:100%;width:100%;background:#48d048"></div></div></div>';

function runPokemonBattle(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const value = context?.value ?? entry.value ?? 3;
  const playerName = entry.player_name ?? "OLEG";
  const enemyName = entry.enemy_name ?? "GLÜCKSMASCHINE";
  const enemyIntro = (entry.enemy_intro ?? "Eine wilde {name} erscheint!").replace("{name}", enemyName);
  const attackName = entry.attack_name ?? "MULTIPLIKATOR";
  const koValue = entry.ko_value ?? 6;
  const charMs = entry.char_ms ?? 28;
  const pauseMs = entry.line_pause_ms ?? 650;
  const holdMs = entry.hold_ms ?? 900;
  const fadeOutMs = entry.fade_out_ms ?? 400;
  const blip = entry.text_blip ?? { name: "text_blip", volume: 0.5 };
  const hitSound = entry.hit_sound ?? "poke_hit";
  const faintSound = entry.faint_sound ?? "poke_faint";
  const hpLeft = Math.max(0, 1 - value / koValue);

  (async () => {
    for (let i = 0; i < 3; i += 1) {
      flashScreen(eventName, { peak: 0.9, durationMs: 140 });
      await wait(eventName, 170);
    }
    const barCount = 8;
    const barH = H / barCount;
    const bars = [];
    for (let i = 0; i < barCount; i += 1) {
      const bar = createEventDiv(eventName, `left:0;top:${i * barH}px;width:${W}px;height:${barH + 1}px;background:#000`);
      anim(eventName, bar, [{ transform: `translateX(${i % 2 ? 100 : -100}%)` }, { transform: "translateX(0)" }], {
        duration: 320,
        delay: i * 25,
        easing: "ease-in",
        fill: "forwards",
      });
      bars.push(bar);
    }
    await wait(eventName, 320 + barCount * 25);

    const root = createEventDiv(
      eventName,
      'inset:0;overflow:hidden;font-family:"Courier New", monospace;' +
        "background:linear-gradient(180deg, #f8f8e8 0%, #e8f0d0 45%, #b8d890 100%)",
      bars[0]
    );
    root.innerHTML =
      '<div class="pk-enemy-base" style="position:absolute;left:470px;top:150px;width:260px;height:50px;border-radius:50%;background:#a8c878;box-shadow:inset 0 -6px 0 #88a858"></div>' +
      '<div class="pk-player-base" style="position:absolute;left:40px;top:318px;width:320px;height:60px;border-radius:50%;background:#a8c878;box-shadow:inset 0 -6px 0 #88a858"></div>' +
      '<img class="pk-enemy" style="position:absolute;left:530px;top:30px;width:140px;height:140px;object-fit:contain">' +
      '<img class="pk-player" style="position:absolute;left:90px;top:150px;width:200px;height:220px;object-fit:contain;object-position:bottom">' +
      `<div class="pk-enemy-box" style="${POKE_BOX};left:40px;top:30px;width:340px">` +
      '<div style="display:flex;justify-content:space-between"><span class="pk-name"></span><span>Lv50</span></div>' +
      `${POKE_HP}</div>` +
      `<div class="pk-player-box" style="${POKE_BOX};left:430px;top:240px;width:340px">` +
      '<div style="display:flex;justify-content:space-between"><span class="pk-name"></span><span>Lv99</span></div>' +
      `${POKE_HP}<div style="text-align:right;font-size:16px;margin-top:4px">100/ 100</div></div>` +
      '<div class="pk-text" style="position:absolute;left:0;right:0;top:370px;height:110px;box-sizing:border-box;padding:16px 28px;' +
      "background:#304860;border:6px solid #d07830;border-radius:10px;color:#fff;font-size:26px;font-weight:bold;line-height:1.3;" +
      'text-shadow:2px 2px 0 #203040"></div>';
    const $ = (selector) => root.querySelector(selector);
    const enemy = $(".pk-enemy");
    const player = $(".pk-player");
    enemy.src = entry.enemy_src ?? "assets/frame/buch.png";
    player.src = entry.player_src ?? "assets/overlays/egypt_oleg.png";
    $(".pk-enemy-box .pk-name").textContent = enemyName;
    $(".pk-player-box .pk-name").textContent = playerName;
    const enemyFill = $(".pk-enemy-box .pk-fill");
    const textBox = $(".pk-text");

    bars.forEach((bar) => anim(eventName, bar, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }));
    [enemy, $(".pk-enemy-base")].forEach((node) =>
      anim(eventName, node, [{ transform: "translateX(-560px)" }, { transform: "translateX(0)" }], { duration: 700, easing: "ease-out" })
    );
    [player, $(".pk-player-base")].forEach((node) =>
      anim(eventName, node, [{ transform: "translateX(560px)" }, { transform: "translateX(0)" }], { duration: 700, easing: "ease-out" })
    );
    await wait(eventName, 750);
    bars.forEach((bar) => bar.remove());
    anim(eventName, $(".pk-enemy-box"), [{ transform: "translateX(-440px)" }, { transform: "none" }], { duration: 300, easing: "ease-out" });
    anim(eventName, $(".pk-player-box"), [{ transform: "translateX(440px)" }, { transform: "none" }], { duration: 300, easing: "ease-out" });

    await typeText(eventName, textBox, enemyIntro, charMs, blip);
    await wait(eventName, pauseMs);
    await typeText(eventName, textBox, `Los, ${playerName}!`, charMs, blip);
    anim(eventName, player, [{ transform: "translateY(0)" }, { transform: "translateY(-18px)" }, { transform: "translateY(0)" }], { duration: 300 });
    await wait(eventName, pauseMs);
    await typeText(eventName, textBox, `${playerName} setzt ${attackName} x${value} ein!`, charMs, blip);
    await wait(eventName, pauseMs * 0.6);

    anim(eventName, player, [
      { transform: "translate(0, 0)" },
      { transform: "translate(60px, -20px)", offset: 0.4 },
      { transform: "translate(0, 0)" },
    ], { duration: 300, easing: "ease-out" });
    await wait(eventName, 200);
    if (hitSound) playTrackedSounds(eventName, hitSound);
    flashScreen(eventName, { peak: 0.7, durationMs: 150 });
    shake(eventName, root, { amplitude: 10, durationMs: 300 });
    anim(eventName, enemy, [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }], {
      duration: 600,
    });
    const hpColor = hpLeft > 0.5 ? "#48d048" : hpLeft > 0.2 ? "#f8c030" : "#f05030";
    anim(eventName, enemyFill, [
      { width: "100%", backgroundColor: "#48d048" },
      { width: `${hpLeft * 100}%`, backgroundColor: hpColor },
    ], { duration: 900, delay: 300, easing: "ease-in-out", fill: "forwards" });
    await wait(eventName, 1250);

    const verdict = value >= 5 ? "Es ist sehr effektiv!" : value <= 2 ? "Es ist nicht sehr effektiv ..." : "Volltreffer!";
    await typeText(eventName, textBox, verdict, charMs, blip);
    await wait(eventName, pauseMs);
    if (hpLeft === 0) {
      if (faintSound) playTrackedSounds(eventName, faintSound);
      anim(eventName, enemy, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(140px)", opacity: 0 }], {
        duration: 500,
        easing: "ease-in",
        fill: "forwards",
      });
      await typeText(eventName, textBox, `${enemyName} wurde besiegt!`, charMs, blip);
      await wait(eventName, pauseMs);
    }
    await wait(eventName, holdMs);
    // Kampfmusik ist länger als ein kurzer Kampf - mit dem Ausblenden beenden.
    fadeOutAndRemove(eventName, [root], fadeOutMs, () => {
      stopEventSounds(eventName);
      onComplete?.();
    });
  })();
}

// --- 7. "gta" -----------------------------------------------------------------

// GTA-Einblendung. variant "wasted" (Default, für lose): Spielbild wird in
// Zeitlupe grau und zoomt heran, dann rotes "wasted". variant "passed" (für
// Gewinne): "mission passed!" + "respect +" in GTA-San-Andreas-Optik.
// Felder (alle optional): variant, slowmo_ms (1200 bei wasted, 300 bei
// passed), hold_ms (2400), fade_out_ms (450), zoom (1.12), text, subtext.
// Die Schrift "Pricedown" wird benutzt, falls installiert, sonst Impact.
const GTA_FONT = '"Pricedown", Impact, "Arial Black", sans-serif';

function runGta(eventName, el, entry, pos, onComplete) {
  el.remove();
  const passed = entry.variant === "passed";
  const slowmoMs = entry.slowmo_ms ?? (passed ? 300 : 1200);
  const holdMs = entry.hold_ms ?? 2400;
  const fadeOutMs = entry.fade_out_ms ?? 450;
  const zoom = entry.zoom ?? 1.12;
  const nodes = [];
  let stagePlayers = [];
  const wastedState = { filter: "grayscale(1) brightness(0.7) contrast(1.1)", transform: `scale(${zoom})` };

  if (!passed) {
    stagePlayers = animateStage(eventName, [{ filter: "grayscale(0) brightness(1) contrast(1)", transform: "scale(1)" }, wastedState], {
      duration: slowmoMs + holdMs * 0.5,
      easing: "cubic-bezier(0.2, 0.6, 0.3, 1)",
      fill: "forwards",
    });
  }

  const bandTop = passed ? 140 : 175;
  const bandHeight = passed ? 200 : 130;
  const band = createEventDiv(
    eventName,
    `left:0;width:${W}px;top:${bandTop}px;height:${bandHeight}px;opacity:0;` +
      "background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0) 100%)"
  );
  const title = createEventDiv(
    eventName,
    `left:0;width:${W}px;top:${bandTop}px;height:${bandHeight}px;display:flex;flex-direction:column;align-items:center;` +
      `justify-content:center;opacity:0;font-family:${GTA_FONT};-webkit-text-stroke:2px #000;paint-order:stroke fill;text-shadow:3px 3px 0 #000`
  );
  const main = document.createElement("div");
  main.textContent = entry.text ?? (passed ? "mission passed!" : "wasted");
  main.style.cssText = passed ? "font-size:66px;color:#f3b03a" : "font-size:100px;color:#c42d2d;letter-spacing:2px";
  title.appendChild(main);
  if (passed) {
    const sub = document.createElement("div");
    sub.textContent = entry.subtext ?? "respect +";
    sub.style.cssText = "font-size:40px;color:#fff;margin-top:4px";
    title.appendChild(sub);
  }
  nodes.push(band, title);

  const titleAt = passed ? slowmoMs : slowmoMs * 0.7;
  anim(eventName, band, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: titleAt, fill: "forwards" });
  anim(eventName, title, [
    { opacity: 0, transform: `scale(${passed ? 0.6 : 1.6})` },
    { opacity: 1, transform: `scale(${passed ? 1.05 : 0.97})`, offset: 0.7 },
    { opacity: 1, transform: "scale(1)" },
  ], { duration: 350, delay: titleAt, easing: "ease-out", fill: "forwards" });

  trackTimer(
    eventName,
    setTimeout(() => {
      if (!passed) restore(eventName, stageLayers(), wastedState, fadeOutMs, stagePlayers);
      fadeOutAndRemove(eventName, nodes, fadeOutMs, onComplete);
    }, slowmoMs + holdMs)
  );
}

// --- 8. "among_us_eject" ------------------------------------------------------

// Among-Us-Auswurf: Sternenhimmel zieht vorbei, eine Crewmate-Figur (oder
// "src" als Bild) trudelt quer durchs All, dazu tippt sich der Text. Felder
// (alle optional): name ("Domi"), text ("{name} war nicht der Impostor."),
// subtext ("Dein Geld schon."), color (Crewmate-Farbe, "#c51111"), fly_ms
// (3600), char_ms (55), hold_ms (1200), fade_in_ms (350), fade_out_ms (400), stars (90).
function crewmateSvg(color) {
  return (
    '<svg viewBox="0 0 100 120" width="110" height="132">' +
    `<rect x="6" y="42" width="20" height="46" rx="8" fill="${color}" stroke="#000" stroke-width="5"/>` +
    `<path d="M22 40 Q22 5 55 5 Q88 5 88 40 L88 100 Q88 112 76 112 L66 112 Q60 112 60 104 L60 96 L46 96 L46 104 Q46 112 38 112 L30 112 Q22 112 22 100 Z" fill="${color}" stroke="#000" stroke-width="5"/>` +
    '<path d="M52 24 L80 24 Q93 24 93 37 Q93 50 80 50 L52 50 Q40 50 40 37 Q40 24 52 24 Z" fill="#9bd4e5" stroke="#000" stroke-width="5"/>' +
    '<path d="M56 30 L76 30" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>' +
    "</svg>"
  );
}

function runAmongUsEject(eventName, el, entry, pos, onComplete) {
  const name = entry.name ?? "Domi";
  const line1 = (entry.text ?? "{name} war nicht der Impostor.").replace("{name}", name);
  const line2 = entry.subtext ?? "Dein Geld schon.";
  const flyMs = entry.fly_ms ?? 3600;
  const charMs = entry.char_ms ?? 55;
  const holdMs = entry.hold_ms ?? 1200;
  const fadeInMs = entry.fade_in_ms ?? 350;
  const fadeOutMs = entry.fade_out_ms ?? 400;
  const starCount = entry.stars ?? 90;

  const root = createEventDiv(eventName, "inset:0;opacity:0;overflow:hidden;background:#000");
  for (let i = 0; i < starCount; i += 1) {
    const depth = Math.random();
    const size = 1 + depth * 2.5;
    const star = document.createElement("div");
    star.style.cssText =
      `position:absolute;left:${W}px;top:${Math.random() * H}px;width:${size}px;height:${size}px;border-radius:50%;` +
      `background:#fff;opacity:${0.4 + depth * 0.6}`;
    root.appendChild(star);
    const duration = 9000 - depth * 6000;
    anim(eventName, star, [{ transform: "translateX(0)" }, { transform: `translateX(${-W - 10}px)` }], {
      duration,
      delay: -Math.random() * duration,
      iterations: Infinity,
    });
  }

  let body = ownImage(entry, el);
  if (body) {
    body.style.left = "0";
    body.style.top = `${H / 2 - pos.height / 2 - 40}px`;
    root.appendChild(body);
  } else {
    body = document.createElement("div");
    body.innerHTML = crewmateSvg(entry.color ?? "#c51111");
    body.style.cssText = `position:absolute;left:0;top:${H / 2 - 110}px;width:110px;height:132px`;
    root.appendChild(body);
  }
  anim(eventName, body, [{ transform: "translateX(-180px) rotate(0deg)" }, { transform: `translateX(${W + 60}px) rotate(900deg)` }], {
    duration: flyMs,
    fill: "forwards",
  });

  const textStyle = `position:absolute;left:0;width:${W}px;text-align:center;color:#fff;font-family:Arial, sans-serif;`;
  const text1 = document.createElement("div");
  text1.style.cssText = `${textStyle}top:${H / 2 + 40}px;font-size:30px`;
  const text2 = document.createElement("div");
  text2.style.cssText = `${textStyle}top:${H / 2 + 88}px;font-size:22px;color:#ff5555`;
  root.append(text1, text2);

  anim(eventName, root, [{ opacity: 0 }, { opacity: 1 }], { duration: fadeInMs, fill: "forwards" });
  (async () => {
    const startedAt = performance.now();
    await wait(eventName, flyMs * 0.25);
    await typeText(eventName, text1, line1, charMs);
    await wait(eventName, 300);
    await typeText(eventName, text2, line2, charMs);
    await wait(eventName, Math.max(0, flyMs - (performance.now() - startedAt)) + holdMs);
    fadeOutAndRemove(eventName, [root], fadeOutMs, onComplete);
  })();
}

// --- 9. "mlg_montage" ---------------------------------------------------------

// Live zusammengesetzte MLG-Montage: Hitmarker (mit Klick), fliegende
// Doritos, Illuminati-Dreieck, bunte Sprüche, ruckartige Zooms und Farbwechsel
// des Spielbilds. Mit "src" landet eine pixelige "Deal with it"-Brille auf
// dem Bild. Felder (alle optional): duration_ms (5000), hitmarker_every_ms
// (200), hitmarker_sound ("hitmarker"), texts (Liste), doritos (7),
// zoom_every_ms (600), glasses ({x, y, w} in % des Bildes, Default 50/38/70),
// glasses_at (Anteil der Dauer, 0.35), glasses_sound ("airhorn"), fade_out_ms (350).
const MLG_TEXTS = ["360 NO SCOPE", "WOW", "GET REKT", "MOM GET THE CAMERA", "OH BABY A TRIPLE", "SKRRRT", "M-M-M-MONSTER KILL"];
const HITMARKER_SVG =
  '<svg width="44" height="44" viewBox="0 0 44 44"><g stroke="#fff" stroke-width="4" style="filter:drop-shadow(0 0 2px #000)">' +
  '<line x1="4" y1="4" x2="16" y2="16"/><line x1="40" y1="4" x2="28" y2="16"/><line x1="4" y1="40" x2="16" y2="28"/><line x1="40" y1="40" x2="28" y2="28"/></g></svg>';
const DEAL_WITH_IT_SVG =
  '<svg viewBox="0 0 30 7" width="100%" height="100%" shape-rendering="crispEdges" preserveAspectRatio="none">' +
  '<path fill="#000" d="M0 0h30v2h-30z M2 2h10v3h-10z M17 2h10v3h-10z M3 5h8v1h-8z M18 5h8v1h-8z M13 2h3v1h-3z"/>' +
  '<path fill="#fff" d="M3 2h2v1h-2z M5 3h2v1h-2z M18 2h2v1h-2z M20 3h2v1h-2z"/></svg>';
const ILLUMINATI_SVG =
  '<svg viewBox="0 0 100 90" width="150" height="135"><polygon points="50,4 96,86 4,86" fill="#1a8f3a" stroke="#ffe066" stroke-width="4"/>' +
  '<ellipse cx="50" cy="56" rx="20" ry="11" fill="#fff"/><circle cx="50" cy="56" r="7" fill="#000"/></svg>';

function runMlgMontage(eventName, el, entry, pos, onComplete) {
  const durationMs = entry.duration_ms ?? 5000;
  const hitEveryMs = entry.hitmarker_every_ms ?? 200;
  const hitSound = entry.hitmarker_sound ?? "hitmarker";
  const texts = entry.texts ?? MLG_TEXTS;
  const doritoCount = entry.doritos ?? 7;
  const zoomEveryMs = entry.zoom_every_ms ?? 600;
  const glasses = entry.glasses ?? { x: 50, y: 38, w: 70 };
  const glassesAt = entry.glasses_at ?? 0.35;
  const glassesSound = entry.glasses_sound ?? "airhorn";
  const fadeOutMs = entry.fade_out_ms ?? 350;
  const nodes = [];
  const image = ownImage(entry, el);

  if (image) {
    nodes.push(image);
    anim(eventName, image, [{ transform: "scale(0.2) rotate(-30deg)", opacity: 0 }, { transform: "scale(1) rotate(0deg)", opacity: 1 }], {
      duration: 300,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      fill: "forwards",
    });
    const gw = (pos.width * glasses.w) / 100;
    const gh = (gw * 7) / 30;
    const gx = pos.left + (pos.width * glasses.x) / 100 - gw / 2;
    const gy = pos.top + (pos.height * glasses.y) / 100 - gh / 2;
    const shades = createEventDiv(eventName, `left:${gx}px;top:${gy}px;width:${gw}px;height:${gh}px`);
    shades.innerHTML = DEAL_WITH_IT_SVG;
    const dropMs = 700;
    anim(eventName, shades, [{ transform: `translateY(${-gy - gh}px)` }, { transform: "translateY(0)" }], {
      duration: dropMs,
      delay: durationMs * glassesAt,
      fill: "both",
    });
    const deal = createEventDiv(
      eventName,
      `left:0;width:${W}px;top:${Math.min(pos.top + pos.height + 4, H - 60)}px;text-align:center;opacity:0;` +
        "font-family:Impact, sans-serif;font-size:46px;color:#fff;-webkit-text-stroke:3px #000;paint-order:stroke fill"
    );
    deal.textContent = "DEAL WITH IT";
    trackTimer(
      eventName,
      setTimeout(() => {
        deal.style.opacity = "1";
        if (glassesSound) playTrackedSounds(eventName, glassesSound);
        shake(eventName, image, { amplitude: 10 });
      }, durationMs * glassesAt + dropMs)
    );
    nodes.push(shades, deal);
  }

  for (let t = 250; t < durationMs - 400; t += hitEveryMs * (0.6 + Math.random() * 0.8)) {
    trackTimer(
      eventName,
      setTimeout(() => {
        const marker = createEventDiv(eventName, `left:${40 + Math.random() * (W - 120)}px;top:${30 + Math.random() * (H - 100)}px;width:44px;height:44px`);
        marker.innerHTML = HITMARKER_SVG;
        const player = marker.animate([{ transform: "scale(1.5)", opacity: 1 }, { transform: "scale(1)", opacity: 0 }], { duration: 260 });
        trackAnimation(eventName, player);
        player.onfinish = () => marker.remove();
        if (hitSound) playTrackedSounds(eventName, hitSound);
      }, t)
    );
  }

  for (let i = 0; i < doritoCount; i += 1) {
    const fromLeft = Math.random() < 0.5;
    const size = 60 + Math.random() * 40;
    const dorito = createEventDiv(
      eventName,
      `left:${fromLeft ? -size : W}px;top:${Math.random() * (H - size)}px;width:${size}px;height:${size * 0.9}px;` +
        "clip-path:polygon(50% 0, 100% 100%, 0 100%);" +
        "background:radial-gradient(circle, #b83a0a 0 2px, transparent 3px) 0 0 / 12px 12px, linear-gradient(160deg, #ffb13b, #f97316 60%, #c2410c)"
    );
    const dx = (fromLeft ? 1 : -1) * (W + size * 2);
    const player = dorito.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)" },
        { transform: `translate(${dx}px, ${(Math.random() - 0.5) * 200}px) rotate(${fromLeft ? 720 : -720}deg)` },
      ],
      { duration: 1200 + Math.random() * 900, delay: Math.random() * (durationMs - 1500), fill: "backwards" }
    );
    trackAnimation(eventName, player);
    player.onfinish = () => dorito.remove();
  }

  const illuminati = createEventDiv(eventName, `left:${pick([30, W - 180])}px;top:${pick([20, H - 170])}px;width:150px;height:135px;opacity:0`);
  illuminati.innerHTML = ILLUMINATI_SVG;
  anim(eventName, illuminati, [
    { opacity: 1, transform: "perspective(400px) rotateY(0deg) scale(0.6)", filter: "drop-shadow(0 0 12px #ffe066)" },
    { opacity: 1, transform: "perspective(400px) rotateY(720deg) scale(1.1)", filter: "drop-shadow(0 0 24px #ffe066)" },
  ], { duration: 1400, delay: durationMs * 0.55, easing: "ease-in-out" });
  nodes.push(illuminati);

  for (let t = 300; t < durationMs - 600; t += 450) {
    trackTimer(
      eventName,
      setTimeout(() => {
        const word = createEventDiv(
          eventName,
          `left:${20 + Math.random() * (W - 380)}px;top:${20 + Math.random() * (H - 90)}px;white-space:nowrap;` +
            `font-family:"Comic Sans MS", Impact, sans-serif;font-weight:bold;font-size:${34 + Math.random() * 26}px;` +
            `color:${pick(RAINBOW)};-webkit-text-stroke:2px #000;paint-order:stroke fill`
        );
        word.textContent = pick(texts);
        const rot = Math.random() * 40 - 20;
        const player = word.animate(
          [
            { transform: `rotate(${rot}deg) scale(0)`, opacity: 1 },
            { transform: `rotate(${rot}deg) scale(1.2)`, opacity: 1, offset: 0.2 },
            { transform: `rotate(${rot}deg) scale(1)`, opacity: 1, offset: 0.8 },
            { transform: `rotate(${rot}deg) scale(1)`, opacity: 0 },
          ],
          { duration: 700 }
        );
        trackAnimation(eventName, player);
        player.onfinish = () => word.remove();
      }, t)
    );
  }

  for (let t = 200; t < durationMs - 500; t += zoomEveryMs) {
    trackTimer(
      eventName,
      setTimeout(() => {
        const origin = {
          x: REEL_WINDOW.left + Math.random() * REEL_WINDOW.width,
          y: REEL_WINDOW.top + Math.random() * REEL_WINDOW.height,
        };
        const hot = { transform: "scale(1.25)", filter: `hue-rotate(${Math.round(Math.random() * 360)}deg) saturate(2)` };
        animateStage(eventName, [{ transform: "scale(1)", filter: "none" }, { ...hot, offset: 0.15 }, { ...hot, offset: 0.7 }, { transform: "scale(1)", filter: "none" }], { duration: 450 }, origin);
      }, t)
    );
  }

  trackTimer(eventName, setTimeout(() => fadeOutAndRemove(eventName, nodes, fadeOutMs, onComplete), durationMs));
}

// --- 10. "brainrot_split" -----------------------------------------------------

// TikTok-Splitscreen: Das Spielbild schrumpft zur Seite, daneben läuft
// Gameplay (eigener Clip über gameplay_src, sonst ein gezeichneter
// Subway-Surfers-artiger Endlos-Lauf), in der Mitte poppen Untertitel Wort für
// Wort auf, optional liest eine TTS-Stimme mit. layout "bottom" (Default):
// Spielbild oben, Gameplay als Streifen unten. layout "side": Spielbild links,
// Gameplay als Hochkant-Spalte rechts (für Hochformat-Clips wie
// subway_surfers.webm). Felder (alle optional): layout, side_width (240),
// caption, word_ms (330), split_ms (450), duration_ms (Default: passend zur
// Caption), gameplay_src (Video), runner_src (Läufer-Bild für den gezeichneten
// Lauf), tts (true), tts_lang ("de-DE"), tts_rate (1.15), fade_out_ms (400).
const BRAINROT_CAPTION = "BRO HAT EINFACH DEN JACKPOT GEKNACKT DAS IST KEIN GLÜCK DAS IST SKILL SIGMA GRINDSET";

function buildFakeRunner(eventName, container, runnerSrc, width, height) {
  container.innerHTML = "";
  const sky = document.createElement("div");
  sky.style.cssText = "position:absolute;inset:0;background:linear-gradient(180deg, #6ec6ff 0%, #bfe8ff 38%, #c9b28a 38%, #a88d64 100%)";
  const track = document.createElement("div");
  track.style.cssText =
    "position:absolute;left:50%;top:38%;width:900px;height:700px;margin-left:-450px;transform:perspective(260px) rotateX(64deg);transform-origin:50% 0;" +
    "background-color:#8f8f8f;" +
    "background-image:linear-gradient(90deg, transparent 0 17%, #d0d0d0 17% 18.5%, transparent 18.5% 31%, #d0d0d0 31% 32.5%, transparent 32.5% 43%, #d0d0d0 43% 44.5%, transparent 44.5% 56%, #d0d0d0 56% 57.5%, transparent 57.5% 68%, #d0d0d0 68% 69.5%, transparent 69.5% 82%, #d0d0d0 82% 83.5%, transparent 83.5%)," +
    "repeating-linear-gradient(0deg, #6b4a2b 0 16px, transparent 16px 48px)";
  anim(eventName, track, [{ backgroundPosition: "0 0, 0 0" }, { backgroundPosition: "0 0, 0 96px" }], { duration: 280, iterations: Infinity });
  const walls = document.createElement("div");
  walls.style.cssText =
    "position:absolute;inset:0;background:linear-gradient(90deg, #d94f6a 0 9%, transparent 9% 91%, #3f7fd9 91%);opacity:0.85;" +
    "-webkit-mask-image:linear-gradient(180deg, transparent 0 38%, #000 60%);mask-image:linear-gradient(180deg, transparent 0 38%, #000 60%)";
  container.append(sky, track, walls);

  const runner = document.createElement("img");
  runner.src = runnerSrc;
  runner.style.cssText =
    `position:absolute;left:${width / 2 - 45}px;top:${height - 145}px;width:90px;height:120px;object-fit:contain;` +
    "filter:drop-shadow(0 6px 4px rgba(0,0,0,0.5))";
  container.appendChild(runner);
  anim(eventName, runner, [{ transform: "translateY(0)" }, { transform: "translateY(-14px)" }, { transform: "translateY(0)" }], {
    duration: 280,
    iterations: Infinity,
  });
  const lane = Math.min(160, width * 0.3);
  anim(eventName, runner, [
    { translate: "0 0" },
    { translate: `${-lane}px 0`, offset: 0.2 },
    { translate: `${-lane}px 0`, offset: 0.45 },
    { translate: `${lane}px 0`, offset: 0.65 },
    { translate: `${lane}px 0`, offset: 0.85 },
    { translate: "0 0" },
  ], { duration: 3200, iterations: Infinity, easing: "ease-in-out" });
}

function runBrainrotSplit(eventName, el, entry, pos, onComplete) {
  el.remove();
  const words = (entry.caption ?? BRAINROT_CAPTION).split(/\s+/).filter(Boolean);
  const wordMs = entry.word_ms ?? 330;
  const splitMs = entry.split_ms ?? 450;
  const fadeOutMs = entry.fade_out_ms ?? 400;
  const durationMs = entry.duration_ms ?? splitMs + words.length * wordMs + 900;
  const runnerSrc = entry.runner_src ?? "assets/overlays/sybau_domi.png";
  const half = H / 2;
  const side = entry.layout === "side";
  const sideWidth = entry.side_width ?? 240;

  // Spielbild verkleinern und die freien Ränder daneben schwarz abdecken.
  let shrunk;
  let stagePlayers;
  let bars;
  let area;
  if (side) {
    const scale = (W - sideWidth) / W;
    const top = (H * (1 - scale)) / 2;
    shrunk = { transform: `scale(${scale})` };
    stagePlayers = animateStage(eventName, [{ transform: "scale(1)" }, shrunk], { duration: splitMs, easing: "ease-in-out", fill: "forwards" }, { x: 0, y: H / 2 });
    bars = createEventDiv(
      eventName,
      `left:0;top:0;width:${W - sideWidth}px;height:${H}px;opacity:0;` +
        `background:linear-gradient(180deg, #000 0 ${top}px, transparent ${top}px ${H - top}px, #000 ${H - top}px)`
    );
    area = { left: W - sideWidth, top: 0, width: sideWidth, height: H, from: "translateX(100%)" };
  } else {
    shrunk = { transform: "scale(0.5)" };
    stagePlayers = animateStage(eventName, [{ transform: "scale(1)" }, shrunk], { duration: splitMs, easing: "ease-in-out", fill: "forwards" }, { x: W / 2, y: 0 });
    bars = createEventDiv(
      eventName,
      `left:0;top:0;width:${W}px;height:${half}px;opacity:0;` +
        `background:linear-gradient(90deg, #000 0 ${W / 4}px, transparent ${W / 4}px ${(W * 3) / 4}px, #000 ${(W * 3) / 4}px)`
    );
    area = { left: 0, top: half, width: W, height: half, from: "translateY(100%)" };
  }
  anim(eventName, bars, [{ opacity: 0 }, { opacity: 1 }], { duration: splitMs, fill: "forwards" });

  const gameplay = createEventDiv(
    eventName,
    `left:${area.left}px;top:${area.top}px;width:${area.width}px;height:${area.height}px;overflow:hidden;background:#000`
  );
  const fakeRunner = () => buildFakeRunner(eventName, gameplay, runnerSrc, area.width, area.height);
  if (entry.gameplay_src) {
    const video = document.createElement("video");
    video.src = entry.gameplay_src;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.style.cssText = "width:100%;height:100%;object-fit:cover";
    video.addEventListener("error", fakeRunner, { once: true });
    gameplay.appendChild(video);
  } else {
    fakeRunner();
  }
  anim(eventName, gameplay, [{ transform: area.from }, { transform: "none" }], {
    duration: splitMs,
    easing: "ease-out",
    fill: "forwards",
  });

  const caption = createEventDiv(
    eventName,
    `left:0;width:${W}px;top:${half - 42}px;height:84px;display:flex;align-items:center;justify-content:center;` +
      '-webkit-text-stroke:3px #000;paint-order:stroke fill;font-family:"Arial Black", Impact, sans-serif;font-size:54px;' +
      "color:#fff;text-shadow:0 4px 0 #000"
  );
  words.forEach((word, i) => {
    trackTimer(
      eventName,
      setTimeout(() => {
        caption.textContent = word;
        caption.style.color = i % 3 === 2 ? "#ffe600" : "#fff";
        anim(eventName, caption, [{ transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 120, easing: "ease-out" });
      }, splitMs + i * wordMs)
    );
  });

  if (entry.tts !== false && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(words.join(" ").toLowerCase());
    utterance.lang = entry.tts_lang ?? "de-DE";
    utterance.rate = entry.tts_rate ?? 1.15;
    trackTimer(eventName, setTimeout(() => speechSynthesis.speak(utterance), splitMs));
    trackAnimation(eventName, { cancel: () => speechSynthesis.cancel() });
  }

  trackTimer(
    eventName,
    setTimeout(() => {
      restore(eventName, stageLayers(), shrunk, fadeOutMs, stagePlayers);
      fadeOutAndRemove(eventName, [bars, gameplay, caption], fadeOutMs, onComplete);
    }, durationMs)
  );
}

// --- 11. "dvd_bounce" ---------------------------------------------------------

// Idle-Attract: Logo springt wie der DVD-Bildschirmschoner über den
// Bildschirm und wechselt bei jedem Aufprall die Farbe. Trifft es exakt eine
// Ecke: Konfetti, "ECKE!!!" und Jubel-Sound. Läuft endlos (bis clearEvent),
// außer duration_ms ist gesetzt. Größe über position.width/height. Felder
// (alle optional): speed_px_s (150), dim (Abdunkelung dahinter, 0.45),
// corner_tolerance_px (6), corner_sound ("corner"), corner_text ("ECKE!!!"),
// aim_corner (true = Startpunkt so wählen, dass die erste Ecke nach wenigen
// Sekunden getroffen wird - für die Demo), duration_ms, fade_out_ms (400).
function runDvdBounce(eventName, el, entry, pos, onComplete) {
  const speed = (entry.speed_px_s ?? 150) / 1000;
  const dim = entry.dim ?? 0.45;
  const tolerance = entry.corner_tolerance_px ?? 6;
  const fadeOutMs = entry.fade_out_ms ?? 400;
  const maxX = W - pos.width;
  const maxY = H - pos.height;
  const nodes = [el];

  if (dim > 0) nodes.push(createEventDiv(eventName, `inset:0;background:#000;opacity:${dim}`, el));

  let x;
  let y;
  let vx = speed;
  let vy = speed;
  if (entry.aim_corner) {
    const d = Math.min(maxX, maxY) * 0.8;
    x = maxX - d;
    y = maxY - d;
  } else {
    x = Math.random() * maxX;
    y = Math.random() * maxY;
    if (Math.random() < 0.5) vx = -vx;
    if (Math.random() < 0.5) vy = -vy;
  }
  el.style.left = "0";
  el.style.top = "0";

  let hue = 0;
  let last = 0;
  let lastCornerAt = -Infinity;
  trackLoop(eventName, (t) => {
    const dt = Math.min(50, t - last);
    last = t;
    x += vx * dt;
    y += vy * dt;
    let hitX = false;
    let hitY = false;
    if (x <= 0 || x >= maxX) {
      x = Math.min(Math.max(x, 0), maxX);
      vx = x === 0 ? Math.abs(vx) : -Math.abs(vx);
      hitX = true;
    }
    if (y <= 0 || y >= maxY) {
      y = Math.min(Math.max(y, 0), maxY);
      vy = y === 0 ? Math.abs(vy) : -Math.abs(vy);
      hitY = true;
    }
    if (hitX || hitY) {
      hue = (hue + 60 + Math.random() * 180) % 360;
      el.style.filter = `hue-rotate(${Math.round(hue)}deg) saturate(1.6)`;
      const nearX = x <= tolerance || x >= maxX - tolerance;
      const nearY = y <= tolerance || y >= maxY - tolerance;
      if (nearX && nearY && t - lastCornerAt > 1000) {
        lastCornerAt = t;
        celebrateCorner(eventName, entry, x < maxX / 2 ? 0 : W, y < maxY / 2 ? 0 : H);
      }
    }
    el.style.transform = `translate(${x}px, ${y}px)`;
    return true;
  });

  if (entry.duration_ms) {
    trackTimer(eventName, setTimeout(() => fadeOutAndRemove(eventName, nodes, fadeOutMs, onComplete), entry.duration_ms));
  } else {
    // Dauerhaftes Overlay wie andere idle-Einträge - endet per clearEvent().
    onComplete?.();
  }
}

function celebrateCorner(eventName, entry, cornerX, cornerY) {
  const sound = entry.corner_sound ?? "corner";
  if (sound) playTrackedSounds(eventName, sound);
  flashScreen(eventName, { peak: 0.5, durationMs: 250 });

  const dirX = cornerX === 0 ? 1 : -1;
  const dirY = cornerY === 0 ? 1 : -1;
  for (let i = 0; i < 90; i += 1) {
    const piece = createEventDiv(
      eventName,
      `left:${cornerX}px;top:${cornerY}px;width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px;background:${pick(RAINBOW)}`
    );
    const angle = Math.random() * (Math.PI / 2);
    const distance = 150 + Math.random() * 350;
    const dx = Math.cos(angle) * distance * dirX;
    const dy = Math.sin(angle) * distance * dirY;
    const spin = Math.random() * 1080 - 540;
    const player = piece.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy + 220}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1400 + Math.random() * 800, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" }
    );
    trackAnimation(eventName, player);
    player.onfinish = () => piece.remove();
  }

  const text = createEventDiv(
    eventName,
    `left:0;width:${W}px;top:${H / 2 - 60}px;text-align:center;font-family:Impact, "Arial Black", sans-serif;font-size:110px;` +
      "color:#fff;-webkit-text-stroke:4px #000;paint-order:stroke fill"
  );
  text.textContent = entry.corner_text ?? "ECKE!!!";
  const player = text.animate(
    [
      { transform: "scale(0) rotate(-10deg)", opacity: 1, color: RAINBOW[0] },
      { transform: "scale(1.2) rotate(4deg)", opacity: 1, color: RAINBOW[2], offset: 0.25 },
      { transform: "scale(1) rotate(-3deg)", opacity: 1, color: RAINBOW[4], offset: 0.75 },
      { transform: "scale(1.1) rotate(0deg)", opacity: 0, color: RAINBOW[1] },
    ],
    { duration: 1600, easing: "ease-out" }
  );
  trackAnimation(eventName, player);
  player.onfinish = () => text.remove();
}

export const MEME_ANIMS = {
  to_be_continued: runToBeContinued,
  thanos_snap: runThanosSnap,
  laser_eyes: runLaserEyes,
  stonks: runStonks,
  crt_off: runCrtOff,
  pokemon_battle: runPokemonBattle,
  gta: runGta,
  among_us_eject: runAmongUsEject,
  mlg_montage: runMlgMontage,
  brainrot_split: runBrainrotSplit,
  dvd_bounce: runDvdBounce,
};
