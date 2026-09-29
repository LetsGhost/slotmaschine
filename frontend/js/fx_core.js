// Gemeinsame Basis aller Overlay-Animationen (effects.js, meme_anims.js):
// Overlay-Layer, Tracking von Timern/Animationen/Sounds pro Event (für
// clearEvent) und wiederverwendbare Bausteine wie Münzregen oder Shake.
import { DISPLAY } from "./config.js";
import { playSoundSpec } from "./sound.js";

export const layer = document.getElementById("overlay-layer");

// eventName -> { timers: Set<number>, animations: Set<Animation>, sounds: Set<AudioBufferSourceNode> }.
// Ein Event kann viele Timer/Animationen gleichzeitig haben (z.B. Münzregen),
// clearEvent() räumt dann alles zusammen auf statt nur ein einzelnes Element.
export const activeControllers = new Map();

export function trackTimer(eventName, timer) {
  getController(eventName).timers.add(timer);
  return timer;
}

export function trackAnimation(eventName, animation) {
  getController(eventName).animations.add(animation);
  return animation;
}

export function trackSound(eventName, source) {
  if (source) getController(eventName).sounds.add(source);
  return source;
}

// Spielt eine Sound-Angabe (String, Objekt, {pick}, Array - siehe
// playSoundSpec in sound.js) ab und hängt alle Sources an das Event.
export function playTrackedSounds(eventName, spec) {
  playSoundSpec(spec).forEach((source) => trackSound(eventName, source));
}

// requestAnimationFrame-Schleife, die clearEvent() wie eine Animation abbricht
// (sie hängt als Objekt mit cancel() im Controller). step(elapsedMs) wird pro
// Frame aufgerufen und beendet die Schleife, indem es false zurückgibt.
export function trackLoop(eventName, step) {
  let handle = null;
  const startedAt = performance.now();
  const tick = (now) => {
    if (step(now - startedAt) === false) {
      handle = null;
      return;
    }
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return trackAnimation(eventName, {
    cancel() {
      if (handle !== null) cancelAnimationFrame(handle);
      handle = null;
    },
  });
}

export function getController(eventName) {
  let controller = activeControllers.get(eventName);
  if (!controller) {
    controller = { timers: new Set(), animations: new Set(), sounds: new Set() };
    activeControllers.set(eventName, controller);
  }
  return controller;
}

// Optionaler Münzregen über einer Einblend-Animation (Feld "coin_rain" am
// Eintrag): { src, count, duration_ms } - Münzen starten gleichmäßig verteilt
// über duration_ms (Default: Dauer bis zum Ausblenden) und liegen über dem Bild.
export function startCoinRain(eventName, config, defaultDurationMs) {
  const coinSrc = config.src || "assets/overlays/coin_placeholder.svg";
  const count = config.count ?? 100;
  const durationMs = config.duration_ms ?? defaultDurationMs;
  for (let i = 0; i < count; i += 1) {
    trackTimer(eventName, setTimeout(() => spawnCoin(eventName, coinSrc), Math.random() * durationMs));
  }
}

export function spawnCoin(eventName, coinSrc) {
  const coin = document.createElement("img");
  coin.src = coinSrc;
  coin.dataset.event = eventName;
  coin.style.position = "absolute";
  coin.style.pointerEvents = "none";

  const size = 28 + Math.random() * 20;
  coin.style.width = `${size}px`;
  coin.style.height = `${size}px`;
  coin.style.left = `${Math.random() * (DISPLAY.width - size)}px`;
  coin.style.top = `${-size}px`;

  layer.appendChild(coin);

  const fallMs = 700 + Math.random() * 700;
  const fallDistance = DISPLAY.height + size * 2;
  const rotateStart = Math.random() * 360;
  const rotateEnd = rotateStart + 180 + Math.random() * 360;

  const player = coin.animate(
    [
      { transform: `translateY(0) rotate(${rotateStart}deg)`, opacity: 1 },
      { transform: `translateY(${fallDistance}px) rotate(${rotateEnd}deg)`, opacity: 1 },
    ],
    { duration: fallMs, easing: "ease-in" }
  );
  trackAnimation(eventName, player);
  player.onfinish = () => coin.remove();
}

// --- Hilfsfunktionen für die Meme-Animationen unten ----------------------

// Absolut positioniertes <div> auf dem Overlay-Layer (vor `before`, sonst
// ganz oben), das clearEvent() über data-event mit aufräumt.
export function createEventDiv(eventName, cssText, before = null) {
  const div = document.createElement("div");
  div.dataset.event = eventName;
  div.style.cssText = `position:absolute;pointer-events:none;${cssText}`;
  layer.insertBefore(div, before);
  return div;
}

// Kurzes Wackeln über die eigenständige CSS-Eigenschaft "translate" - stört
// dadurch keine gleichzeitig laufende transform-Animation desselben Elements.
export function shake(eventName, node, { amplitude = 8, durationMs = 260 } = {}) {
  const a = amplitude;
  trackAnimation(
    eventName,
    node.animate(
      [
        { translate: "0 0" },
        { translate: `${-a}px ${a * 0.5}px` },
        { translate: `${a * 0.8}px ${-a * 0.6}px` },
        { translate: `${-a * 0.4}px ${-a * 0.3}px` },
        { translate: "0 0" },
      ],
      { duration: durationMs, easing: "ease-out" }
    )
  );
}

// Vollbild-Blitz über allem.
export function flashScreen(eventName, { color = "#fff", peak = 0.85, durationMs = 160 } = {}) {
  const flash = createEventDiv(eventName, `inset:0;background:${color};opacity:0`);
  const player = flash.animate([{ opacity: peak }, { opacity: 0 }], { duration: durationMs, easing: "ease-out" });
  trackAnimation(eventName, player);
  player.onfinish = () => flash.remove();
}

// Blendet alle nodes gemeinsam aus, entfernt sie und meldet das Event als fertig.
export function fadeOutAndRemove(eventName, nodes, fadeOutMs, onComplete) {
  nodes.forEach((node) => {
    trackAnimation(
      eventName,
      node.animate([{ opacity: getComputedStyle(node).opacity }, { opacity: 0 }], {
        duration: fadeOutMs,
        fill: "forwards",
      })
    );
  });
  trackTimer(
    eventName,
    setTimeout(() => {
      nodes.forEach((node) => node.remove());
      onComplete?.();
    }, fadeOutMs)
  );
}
