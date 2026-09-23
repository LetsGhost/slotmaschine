import { DISPLAY } from "./config.js";

const layer = document.getElementById("overlay-layer");

// eventName -> { timers: Set<number>, animations: Set<Animation> }.
// Ein Event kann viele Timer/Animationen gleichzeitig haben (z.B. Münzregen),
// clearEvent() räumt dann alles zusammen auf statt nur ein einzelnes Element.
const activeControllers = new Map();

function trackTimer(eventName, timer) {
  getController(eventName).timers.add(timer);
  return timer;
}

function trackAnimation(eventName, animation) {
  getController(eventName).animations.add(animation);
  return animation;
}

function getController(eventName) {
  let controller = activeControllers.get(eventName);
  if (!controller) {
    controller = { timers: new Set(), animations: new Set() };
    activeControllers.set(eventName, controller);
  }
  return controller;
}

let mediaMap = {};

// Wiederverwendbare Animationstypen für event_media_map.json (Feld "anim").
// Timing per Event überschreibbar über fly_in_ms / hold_ms / fly_out_ms.
// "flyby" ist eine eigene Mehrphasen-Sequenz (siehe runFlybySpin) und daher hier nicht gelistet.
const ANIMATIONS = {
  // Fällt von oben rein, federt kurz nach, fliegt am Ende wieder nach oben raus.
  drop_bounce: {
    in: [
      { transform: "translateY(-180%) scale(0.7)", opacity: 0 },
      { transform: "translateY(10%) scale(1.05)", opacity: 1, offset: 0.6 },
      { transform: "translateY(-5%) scale(0.98)", opacity: 1, offset: 0.8 },
      { transform: "translateY(0%) scale(1)", opacity: 1 },
    ],
    inEasing: "ease-out",
    out: [
      { transform: "translateY(0%)", opacity: 1 },
      { transform: "translateY(-180%)", opacity: 0 },
    ],
    outEasing: "ease-in",
  },
  // Wächst mit Überschwinger aus der Mitte (elastic pop), verschwindet durch Aufblähen+Fade.
  pop_scale: {
    in: [
      { transform: "scale(0.2)", opacity: 0 },
      { transform: "scale(1.15)", opacity: 1, offset: 0.7 },
      { transform: "scale(1)", opacity: 1 },
    ],
    inEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    out: [
      { transform: "scale(1)", opacity: 1 },
      { transform: "scale(1.4)", opacity: 0 },
    ],
    outEasing: "ease-out",
  },
  // Subtiles Hochgleiten+Einblenden, spurloses Wegfaden nach oben - für dezente Hinweise.
  slide_up_fade: {
    in: [
      { transform: "translateY(20%)", opacity: 0 },
      { transform: "translateY(0%)", opacity: 1 },
    ],
    inEasing: "ease-out",
    out: [
      { transform: "translateY(0%)", opacity: 1 },
      { transform: "translateY(-15%)", opacity: 0 },
    ],
    outEasing: "ease-in",
  },
};

export async function loadEventMediaMap(url = "event_media_map.json") {
  const res = await fetch(url);
  mediaMap = await res.json();
  return mediaMap;
}

export function getEventNames() {
  return Object.keys(mediaMap);
}

// Ein Event kann in event_media_map.json statt eines einzelnen Eintrags ein Array
// von Varianten haben - bei jedem showEvent()-Aufruf wird dann zufällig eine davon
// gewählt (optional gewichtet über "weight", Default-Gewicht 1).
export function isPoolEvent(eventName) {
  return Array.isArray(mediaMap[eventName]);
}

function pickVariant(eventName) {
  const raw = mediaMap[eventName];
  if (!Array.isArray(raw)) return raw;
  const total = raw.reduce((sum, v) => sum + (v.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const variant of raw) {
    roll -= variant.weight ?? 1;
    if (roll <= 0) return variant;
  }
  return raw[raw.length - 1];
}

// options.onComplete (optional): wird genau einmal aufgerufen, sobald dieses
// Event visuell fertig ist (Animation/Video/duration_ms abgelaufen) - für
// Sequenzen, die erst weitermachen sollen, wenn das aktuelle Overlay fertig
// ist (siehe showEventSequence unten). Events ohne erkennbares Ende (kein
// duration_ms, kein anim, z.B. dauerhafte Overlays wie "idle_attract") rufen
// onComplete sofort auf, damit eine Sequenz nicht für immer hängen bleibt.
// options.context (optional): beliebige Daten, die eine "anim"-Implementierung
// braucht, um sich an den konkreten Anlass anzupassen - z.B. übergibt
// showEventSequence hier den getroffenen Multiplikator-Wert, damit "anim":
// "sniper_count" weiß, wie oft geschossen werden soll (siehe runSniperCount).
export function showEvent(eventName, { onComplete, context } = {}) {
  const entry = pickVariant(eventName);
  if (!entry) {
    console.warn(`Kein Event-Media-Mapping für "${eventName}"`);
    onComplete?.();
    return;
  }

  clearEvent(eventName);

  const pos = entry.position || { top: 0, left: 0, width: 800, height: 480 };
  let el;

  if (entry.type === "video") {
    el = document.createElement("video");
    el.src = entry.src;
    el.autoplay = true;
    el.muted = true;
    el.playsInline = true;
    if (!entry.duration_ms) {
      el.addEventListener("ended", () => {
        el.remove();
        onComplete?.();
      });
    }
  } else {
    el = document.createElement("img");
    el.src = entry.src;
  }

  el.dataset.event = eventName;
  el.style.position = "absolute";
  el.style.top = `${pos.top}px`;
  el.style.left = `${pos.left}px`;
  el.style.width = `${pos.width}px`;
  el.style.height = `${pos.height}px`;
  el.style.objectFit = "contain";

  layer.appendChild(el);

  if (entry.anim === "chest_reveal") {
    runChestReveal(eventName, el, entry, pos, onComplete);
    return;
  }

  if (entry.anim === "coin_rain_reveal") {
    runCoinRainReveal(eventName, el, entry, onComplete);
    return;
  }

  if (entry.anim === "flyby") {
    runFlybySpin(eventName, el, entry, onComplete);
    return;
  }

  if (entry.anim === "sniper_count") {
    runSniperCount(eventName, el, entry, pos, onComplete, context);
    return;
  }

  const anim = entry.anim && ANIMATIONS[entry.anim];
  if (anim) {
    runFlyAnimation(eventName, el, entry, anim, onComplete);
    return;
  }

  if (entry.duration_ms) {
    trackTimer(
      eventName,
      setTimeout(() => {
        el.remove();
        onComplete?.();
      }, entry.duration_ms)
    );
  } else if (entry.type !== "video") {
    // Kein duration_ms, kein anim, kein Video mit eigenem "ended" - dauerhaftes
    // Overlay (z.B. idle_attract), das extern per clearEvent() entfernt wird.
    onComplete?.();
  }
}

function runFlyAnimation(eventName, el, entry, anim, onComplete) {
  const flyInMs = entry.fly_in_ms ?? 350;
  const holdMs = entry.hold_ms ?? 1200;
  const flyOutMs = entry.fly_out_ms ?? 350;

  trackAnimation(
    eventName,
    el.animate(anim.in, { duration: flyInMs, easing: anim.inEasing || "ease-out", fill: "forwards" })
  );

  trackTimer(
    eventName,
    setTimeout(() => {
      const outPlayer = el.animate(anim.out, {
        duration: flyOutMs,
        easing: anim.outEasing || "ease-in",
        fill: "forwards",
      });
      trackAnimation(eventName, outPlayer);
      outPlayer.onfinish = () => {
        el.remove();
        onComplete?.();
      };
    }, flyInMs + holdMs)
  );
}

// "flyby": schwebt von links rein, dreht sich 1-2 mal um die eigene Achse,
// schwebt dann sanft (Hover-Bobbing) und fliegt am Ende nach rechts weg.
// Felder (alle optional): fly_in_ms, spin_ms, spin_turns (Default: zufällig
// 1 oder 2 volle Umdrehungen), hold_ms (Hover-Dauer), hover_amplitude (% Hub),
// hover_cycle_ms (Dauer einer Hover-Schwingung), fly_out_ms.
// transform-Reihenfolge ist immer "translate(...) rotate(...) scale(...)" -
// translate steht bewusst außen, damit Flug-Richtung/Hover-Hub unabhängig vom
// aktuellen Drehwinkel immer auf dem Bildschirm senkrecht/waagerecht bleibt.
function runFlybySpin(eventName, el, entry, onComplete) {
  const flyInMs = entry.fly_in_ms ?? 350;
  const spinMs = entry.spin_ms ?? 500;
  const spinTurns = entry.spin_turns ?? (Math.random() < 0.5 ? 1 : 2);
  const holdMs = entry.hold_ms ?? 1200;
  const flyOutMs = entry.fly_out_ms ?? 350;
  const hoverAmplitude = entry.hover_amplitude ?? 6;
  const hoverCycleMs = entry.hover_cycle_ms ?? 900;
  const spinDeg = 360 * spinTurns;

  trackAnimation(
    eventName,
    el.animate(
      [
        { transform: "translate(-160%, 0%) rotate(0deg) scale(0.5)", opacity: 0 },
        { transform: "translate(6%, 0%) rotate(0deg) scale(1.08)", opacity: 1, offset: 0.75 },
        { transform: "translate(0%, 0%) rotate(0deg) scale(1)", opacity: 1 },
      ],
      { duration: flyInMs, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" }
    )
  );

  trackTimer(
    eventName,
    setTimeout(() => {
      trackAnimation(
        eventName,
        el.animate(
          [
            { transform: "translate(0%, 0%) rotate(0deg) scale(1)" },
            { transform: `translate(0%, 0%) rotate(${spinDeg}deg) scale(1)` },
          ],
          { duration: spinMs, easing: "ease-in-out", fill: "forwards" }
        )
      );

      trackTimer(
        eventName,
        setTimeout(() => {
          const hoverIterations = Math.max(1, Math.round(holdMs / hoverCycleMs));
          trackAnimation(
            eventName,
            el.animate(
              [
                { transform: `translate(0%, 0%) rotate(${spinDeg}deg) scale(1)` },
                { transform: `translate(0%, -${hoverAmplitude}%) rotate(${spinDeg}deg) scale(1)`, offset: 0.5 },
                { transform: `translate(0%, 0%) rotate(${spinDeg}deg) scale(1)` },
              ],
              { duration: hoverCycleMs, iterations: hoverIterations, easing: "ease-in-out", fill: "forwards" }
            )
          );

          trackTimer(
            eventName,
            setTimeout(() => {
              const outPlayer = el.animate(
                [
                  { transform: `translate(0%, 0%) rotate(${spinDeg}deg) scale(1)`, opacity: 1 },
                  { transform: `translate(160%, 0%) rotate(${spinDeg}deg) scale(0.5)`, opacity: 0 },
                ],
                { duration: flyOutMs, easing: "ease-in", fill: "forwards" }
              );
              trackAnimation(eventName, outPlayer);
              outPlayer.onfinish = () => {
                el.remove();
                onComplete?.();
              };
            }, hoverIterations * hoverCycleMs)
          );
        }, spinMs)
      );
    }, flyInMs)
  );
}

// "sniper_count": Zielfernrohr-Animation (entry.src, typischerweise das per
// Chromakey freigestellte assets/overlays/sniper_shoot.gif), die genau
// `context.value` mal einen Ziel-/Schuss-Zyklus abspielt - für einen
// getroffenen x3-Multiplikator also 3 Zyklen nacheinander, deren Ziel-Label
// hochzählt (x1, dann x2, dann x3). Ohne `context` (z.B. manueller Test über
// die Debug-Buttons) fällt es auf `entry.value` oder sonst 1 zurück. `el` wird
// sofort entfernt - pro Schuss wird ein frisches <img> erzeugt, damit das GIF
// garantiert wieder bei Frame 0 startet.
// Eigene Felder (alle optional): shot_duration_ms (Dauer eines Zyklus, Default
// 700), gap_ms (Pause zwischen zwei Zyklen, Default 150), aim_in_ms
// (Einblendzeit des Ziel-Labels, Default 120), shoot_delay_ms (Zeitpunkt des
// "Treffers" innerhalb eines Zyklus, Default 420), target_position (Default:
// `position`), target_font_size_px, target_color, target_hit_color,
// label_format (Platzhalter {value}, Default "x{value}"), screen_shake,
// muzzle_flash (beide Default true).
function runSniperCount(eventName, el, entry, pos, onComplete, context) {
  el.remove();

  const value = Math.max(1, Math.round(context?.value ?? entry.value ?? 1));
  const shotMs = entry.shot_duration_ms ?? 700;
  const gapMs = entry.gap_ms ?? 150;
  const aimInMs = entry.aim_in_ms ?? 120;
  const shootDelayMs = Math.min(entry.shoot_delay_ms ?? 420, Math.max(shotMs - 50, 50));
  const labelFormat = entry.label_format ?? "x{value}";
  const targetColor = entry.target_color ?? "#ffffff";
  const targetHitColor = entry.target_hit_color ?? "#ff5252";
  const targetFontSize = entry.target_font_size_px ?? 40;
  const targetPos = entry.target_position || pos;
  const withShake = entry.screen_shake !== false;
  const withFlash = entry.muzzle_flash !== false;

  const wrapper = document.createElement("div");
  wrapper.dataset.event = eventName;
  wrapper.style.position = "absolute";
  wrapper.style.inset = "0";
  wrapper.style.pointerEvents = "none";
  layer.appendChild(wrapper);

  function createGifEl() {
    const gifEl = document.createElement("img");
    gifEl.src = entry.src;
    gifEl.style.position = "absolute";
    gifEl.style.top = `${pos.top}px`;
    gifEl.style.left = `${pos.left}px`;
    gifEl.style.width = `${pos.width}px`;
    gifEl.style.height = `${pos.height}px`;
    gifEl.style.objectFit = "contain";
    wrapper.appendChild(gifEl);
    return gifEl;
  }

  function fireShot(k) {
    return new Promise((resolve) => {
      const gifEl = createGifEl();

      const target = document.createElement("div");
      target.dataset.event = eventName;
      target.textContent = labelFormat.replace("{value}", k);
      target.style.position = "absolute";
      target.style.left = `${targetPos.left}px`;
      target.style.top = `${targetPos.top}px`;
      target.style.width = `${targetPos.width}px`;
      target.style.height = `${targetPos.height}px`;
      target.style.display = "flex";
      target.style.alignItems = "center";
      target.style.justifyContent = "center";
      target.style.fontSize = `${targetFontSize}px`;
      target.style.fontWeight = "bold";
      target.style.color = targetColor;
      target.style.textShadow = "0 0 10px #000, 0 0 4px #000";
      target.style.opacity = "0";
      wrapper.appendChild(target);

      trackAnimation(
        eventName,
        target.animate(
          [
            { transform: "scale(0.5)", opacity: 0 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: Math.min(aimInMs, shootDelayMs), easing: "ease-out", fill: "forwards" }
        )
      );

      trackTimer(
        eventName,
        setTimeout(() => {
          const hitPlayer = target.animate(
            [
              { transform: "scale(1)", color: targetColor, offset: 0 },
              { transform: "scale(1.35)", color: targetHitColor, offset: 0.35 },
              { transform: "scale(0.2)", opacity: 0, offset: 1 },
            ],
            { duration: Math.max(shotMs - shootDelayMs, 80), easing: "ease-in", fill: "forwards" }
          );
          trackAnimation(eventName, hitPlayer);
          hitPlayer.onfinish = () => target.remove();

          if (withShake) {
            trackAnimation(
              eventName,
              wrapper.animate(
                [
                  { transform: "translate(0,0)" },
                  { transform: "translate(-6px,3px)" },
                  { transform: "translate(5px,-4px)" },
                  { transform: "translate(0,0)" },
                ],
                { duration: 180, easing: "ease-out" }
              )
            );
          }

          if (withFlash) {
            const flash = document.createElement("div");
            flash.dataset.event = eventName;
            flash.style.position = "absolute";
            flash.style.inset = "0";
            flash.style.background = "#fff";
            flash.style.opacity = "0";
            flash.style.mixBlendMode = "screen";
            wrapper.appendChild(flash);
            const flashPlayer = flash.animate([{ opacity: 0.85 }, { opacity: 0 }], {
              duration: 140,
              easing: "ease-out",
            });
            trackAnimation(eventName, flashPlayer);
            flashPlayer.onfinish = () => flash.remove();
          }
        }, shootDelayMs)
      );

      trackTimer(
        eventName,
        setTimeout(() => {
          gifEl.remove();
          resolve();
        }, shotMs)
      );
    });
  }

  (async () => {
    for (let k = 1; k <= value; k += 1) {
      await fireShot(k);
      if (k < value && gapMs > 0) {
        await new Promise((resolve) => trackTimer(eventName, setTimeout(resolve, gapMs)));
      }
    }
    wrapper.remove();
    onComplete?.();
  })();
}

// "chest_reveal": Kiste erscheint episch mit rotierendem Lichtstrahlen-Glow, wackelt
// kurz beim "Öffnen" und zeigt dann für sehr kurze Zeit ein Überraschungsbild, das aus
// der Kiste herauspoppt, bevor alles zusammen wegfaded. Felder (alle optional außer
// reveal_src): chest_open_src (Sprite-Wechsel beim Öffnen), reveal_src (Standard:
// reveal_placeholder.svg), appear_ms, open_delay_ms, open_ms, reveal_ms (Default 500 -
// "nur ganz kurz, eine halbe Sekunde"), fade_out_ms, reveal_scale.
function runChestReveal(eventName, chestEl, entry, pos, onComplete) {
  const appearMs = entry.appear_ms ?? 700;
  const openDelayMs = entry.open_delay_ms ?? 400;
  const openMs = entry.open_ms ?? 250;
  const revealMs = entry.reveal_ms ?? 500;
  const fadeOutMs = entry.fade_out_ms ?? 300;
  const revealScale = entry.reveal_scale ?? 1.15;
  const revealSrc = entry.reveal_src || "assets/overlays/reveal_placeholder.svg";

  // Lichtstrahlen-Glow hinter der Kiste (rotierende "Sunburst"-Scheibe).
  const beamsSize = Math.max(pos.width, pos.height) * 2.4;
  const beams = document.createElement("div");
  beams.dataset.event = eventName;
  beams.style.position = "absolute";
  beams.style.width = `${beamsSize}px`;
  beams.style.height = `${beamsSize}px`;
  beams.style.left = `${pos.left + pos.width / 2 - beamsSize / 2}px`;
  beams.style.top = `${pos.top + pos.height / 2 - beamsSize / 2}px`;
  beams.style.borderRadius = "50%";
  beams.style.pointerEvents = "none";
  beams.style.mixBlendMode = "screen";
  beams.style.background =
    "repeating-conic-gradient(from 0deg, rgba(255,240,180,0.9) 0deg 6deg, rgba(255,240,180,0) 6deg 24deg)";
  layer.insertBefore(beams, chestEl);

  const glowMs = appearMs + openDelayMs + openMs + revealMs;
  const beamsInPlayer = beams.animate(
    [
      { transform: "scale(0.4) rotate(0deg)", opacity: 0 },
      { transform: "scale(1.15) rotate(120deg)", opacity: 0.75, offset: 0.25 },
      { transform: "scale(1) rotate(360deg)", opacity: 0.55 },
    ],
    { duration: glowMs, easing: "ease-out", fill: "forwards" }
  );
  trackAnimation(eventName, beamsInPlayer);

  // Kiste: episches Erscheinen (Pop mit Überschwinger + kurzem Aufblitzen).
  chestEl.style.opacity = "0";
  chestEl.style.transform = "scale(0.3)";
  trackAnimation(
    eventName,
    chestEl.animate(
      [
        { transform: "scale(0.3)", opacity: 0, filter: "brightness(1)" },
        { transform: "scale(1.15)", opacity: 1, filter: "brightness(1.6)", offset: 0.7 },
        { transform: "scale(1)", opacity: 1, filter: "brightness(1)" },
      ],
      { duration: appearMs, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" }
    )
  );

  trackTimer(
    eventName,
    setTimeout(() => {
      // Öffnen: kurzes Wackeln, optional Sprite-Wechsel auf die offene Kiste.
      if (entry.chest_open_src) {
        chestEl.src = entry.chest_open_src;
      }
      const openPlayer = chestEl.animate(
        [
          { transform: "scale(1) rotate(0deg)" },
          { transform: "scale(1.05) rotate(-4deg)", offset: 0.3 },
          { transform: "scale(1.05) rotate(4deg)", offset: 0.6 },
          { transform: "scale(1) rotate(0deg)" },
        ],
        { duration: openMs, easing: "ease-in-out", fill: "forwards" }
      );
      trackAnimation(eventName, openPlayer);

      trackTimer(
        eventName,
        setTimeout(() => {
          // Reveal: Bild springt ganz kurz aus der Kiste.
          const reveal = document.createElement("img");
          reveal.src = revealSrc;
          reveal.dataset.event = eventName;
          reveal.style.position = "absolute";
          reveal.style.top = `${pos.top}px`;
          reveal.style.left = `${pos.left}px`;
          reveal.style.width = `${pos.width}px`;
          reveal.style.height = `${pos.height}px`;
          reveal.style.objectFit = "contain";
          layer.appendChild(reveal);

          const revealPlayer = reveal.animate(
            [
              { transform: "scale(0.4)", opacity: 0 },
              { transform: `scale(${revealScale})`, opacity: 1, offset: 0.4 },
              { transform: `scale(${revealScale})`, opacity: 1, offset: 0.8 },
              { transform: "scale(0.6)", opacity: 0 },
            ],
            { duration: revealMs, easing: "ease-out", fill: "forwards" }
          );
          trackAnimation(eventName, revealPlayer);
          revealPlayer.onfinish = () => reveal.remove();

          trackTimer(
            eventName,
            setTimeout(() => {
              const chestOutPlayer = chestEl.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: fadeOutMs,
                easing: "ease-out",
                fill: "forwards",
              });
              trackAnimation(eventName, chestOutPlayer);
              chestOutPlayer.onfinish = () => {
                chestEl.remove();
                onComplete?.();
              };

              const beamsOutPlayer = beams.animate([{ opacity: 0.55 }, { opacity: 0 }], {
                duration: fadeOutMs,
                easing: "ease-out",
                fill: "forwards",
              });
              trackAnimation(eventName, beamsOutPlayer);
              beamsOutPlayer.onfinish = () => beams.remove();
            }, revealMs)
          );
        }, openMs)
      );
    }, appearMs + openDelayMs)
  );
}

// "coin_rain_reveal": zuerst regnen viele Münzen quer über den Bildschirm,
// danach wächst das Hauptbild (entry.src) in der Mitte von klein auf groß,
// hält kurz und verschwindet wieder. Felder (alle optional, mit Defaults):
// coin_src, coin_count, rain_duration_ms, reveal_delay_ms, grow_ms, hold_ms, fade_out_ms.
function runCoinRainReveal(eventName, mainEl, entry, onComplete) {
  const coinSrc = entry.coin_src || "assets/overlays/coin_placeholder.svg";
  const coinCount = entry.coin_count ?? 24;
  const rainMs = entry.rain_duration_ms ?? 1800;
  const revealDelayMs = entry.reveal_delay_ms ?? rainMs;
  const growMs = entry.grow_ms ?? 500;
  const holdMs = entry.hold_ms ?? 1500;
  const fadeOutMs = entry.fade_out_ms ?? 400;

  // Hauptbild bleibt unsichtbar, bis die Wachsen-Animation startet.
  mainEl.style.opacity = "0";
  mainEl.style.transform = "scale(0)";

  for (let i = 0; i < coinCount; i += 1) {
    const spawnDelay = Math.random() * rainMs * 0.7;
    trackTimer(eventName, setTimeout(() => spawnCoin(eventName, coinSrc), spawnDelay));
  }

  trackTimer(
    eventName,
    setTimeout(() => {
      const growPlayer = mainEl.animate(
        [
          { transform: "scale(0)", opacity: 0 },
          { transform: "scale(1.1)", opacity: 1, offset: 0.8 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: growMs, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" }
      );
      trackAnimation(eventName, growPlayer);

      trackTimer(
        eventName,
        setTimeout(() => {
          const outPlayer = mainEl.animate(
            [
              { transform: "scale(1)", opacity: 1 },
              { transform: "scale(1.3)", opacity: 0 },
            ],
            { duration: fadeOutMs, easing: "ease-out", fill: "forwards" }
          );
          trackAnimation(eventName, outPlayer);
          outPlayer.onfinish = () => {
            mainEl.remove();
            onComplete?.();
          };
        }, growMs + holdMs)
      );
    }, revealDelayMs)
  );
}

function spawnCoin(eventName, coinSrc) {
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

// Zeigt dasselbe Event einmal pro Eintrag in `contexts` hintereinander -
// wartet nach jedem Aufruf, bis das Overlay fertig ist (Animation/Video/
// duration_ms), bevor das nächste startet. Für Pool-Events (Array von
// Varianten in event_media_map.json) wird bei jedem Durchlauf neu zufällig
// gewählt, genau wie bei einem einzelnen showEvent()-Aufruf. Jeder Eintrag
// wird als `context` an showEvent() durchgereicht (siehe dort) - z.B. die
// einzelnen getroffenen Multiplikatoren [{row,col,value}, ...] aus
// data.multiplier_hits (siehe socket.js), damit eine Animation wie
// "sniper_count" weiß, welcher Wert gerade gefeiert wird. Gibt ein Promise
// zurück, das erfüllt wird, sobald alle Durchläufe fertig sind (sofort bei
// leerem/fehlendem `contexts`).
export function showEventSequence(eventName, contexts) {
  let chain = Promise.resolve();
  for (const context of contexts || []) {
    chain = chain.then(() => new Promise((resolve) => showEvent(eventName, { onComplete: resolve, context })));
  }
  return chain;
}

export function clearEvent(eventName) {
  const controller = activeControllers.get(eventName);
  if (controller) {
    controller.timers.forEach((timer) => clearTimeout(timer));
    controller.animations.forEach((animation) => animation.cancel());
    activeControllers.delete(eventName);
  }
  layer.querySelectorAll(`[data-event="${eventName}"]`).forEach((el) => el.remove());
}

export function hideAll() {
  getEventNames().forEach(clearEvent);
}
