// Meme-Animationen für Multiplikator-Treffer ("multiplier_hit"-Pool und
// Combo-Finale "multiplier_combo" in event_media_map.json). Gleiche Signatur
// wie MEME_ANIMS in meme_anims.js: (eventName, el, entry, pos, onComplete,
// context) - context.value ist der getroffene Multiplikator (beim
// Combo-Finale die Summe, dazu context.values mit den Einzelwerten).
// Alle Animationen laufen ohne heruntergeladene Assets: fehlt eine optionale
// Sound-Datei (OPTIONAL_SOUND_FILES in sound.js), spielt ein Synth-Sound,
// fehlende Bilder werden durch CSS-Grafiken ersetzt.
import { DISPLAY } from "./config.js";
import { trackTimer, trackAnimation, trackSound, trackLoop, stopEventSounds, createEventDiv, shake, flashScreen, fadeOutAndRemove } from "./fx_core.js";
import { hasSound, playSound } from "./sound.js";

const { width: W, height: H } = DISPLAY;
const RAINBOW = ["#ff0040", "#00e5ff", "#ffea00", "#00ff6a", "#ff00ea", "#ff7b00"];
// Einfache Anführungszeichen, damit die Schrift auch in style="..."-Attributen
// von innerHTML-Schnipseln funktioniert.
const IMPACT = "Impact, 'Arial Black', sans-serif";

// --- Hilfsfunktionen -------------------------------------------------------

function anim(eventName, node, keyframes, options) {
  return trackAnimation(eventName, node.animate(keyframes, options));
}

// Promise, das nach ms auflöst - bricht clearEvent() ab, löst es nie auf.
function wait(eventName, ms) {
  return new Promise((resolve) => trackTimer(eventName, setTimeout(resolve, ms)));
}

// Kind-Element eines Event-Containers (wird mit dem Container entfernt).
function child(parent, cssText, html = "", tag = "div") {
  const node = document.createElement(tag);
  node.style.cssText = `position:absolute;${cssText}`;
  node.innerHTML = html;
  parent.appendChild(node);
  return node;
}

function valueOf(entry, context) {
  return context?.value ?? entry.value ?? 3;
}

// Stufe zum Multiplikator: x2 = erster Eintrag, Werte über der Tabelle bleiben
// auf der letzten Stufe stehen (z.B. beim Combo-Finale mit großer Summe).
function tierOf(table, value) {
  return table[Math.max(0, Math.min(table.length - 1, value - 2))];
}

// Spielt die Datei `name`, falls sie geladen ist, sonst den Synth-Sound `fallback`.
function sfx(eventName, name, fallback, { delayMs = 0, volume = 1, playbackRate = 1 } = {}) {
  const chosen = name && hasSound(name) ? name : fallback;
  if (chosen) trackSound(eventName, playSound(chosen, { delayMs, volume, playbackRate }));
}

// Pop-In mit Überschwinger.
function popIn(eventName, node, { from = 0, overshoot = 1.25, durationMs = 260, rotate = 0 } = {}) {
  return anim(
    eventName,
    node,
    [
      { transform: `scale(${from}) rotate(${rotate}deg)`, opacity: 0 },
      { transform: `scale(${overshoot}) rotate(0deg)`, opacity: 1, offset: 0.65 },
      { transform: "scale(1) rotate(0deg)", opacity: 1 },
    ],
    { duration: durationMs, easing: "ease-out", fill: "forwards" }
  );
}

const STROKE_TEXT = "-webkit-text-stroke:3px #000;paint-order:stroke fill";

// --- 1. "halo_killstreak" -----------------------------------------------------

// Halo-Reach-Multikill: Links unten poppen die Medaillen der Vorstufen wie im
// HUD nacheinander auf (x2 ... x{value-1}, höchstens 5), dann knallt die große
// Medaille in die Mitte und der Ansager ruft die Stufe aus.
// Felder (alle optional): streak_ms (Abstand der Vorstufen, 220), hold_ms
// (1900), fade_out_ms (350), medal_src_format (eigene Medaillen-Bilder, z.B.
// "assets/overlays/halo/{value}.png" - sonst CSS-Sechseck).
const HALO_TIERS = [
  { name: "Double Kill", sound: "halo_double_kill", color: "#4fc3f7" },
  { name: "Triple Kill", sound: "halo_triple_kill", color: "#66bb6a" },
  { name: "Overkill", sound: "halo_overkill", color: "#ffb74d" },
  { name: "Killtacular", sound: "halo_killtacular", color: "#ff7043" },
  { name: "Killtrocity", sound: "halo_killtrocity", color: "#e53935" },
  { name: "Killimanjaro", sound: "halo_killimanjaro", color: "#ab47bc" },
  { name: "Killtastrophe", sound: "halo_killtastrophe", color: "#7c4dff" },
  { name: "Killpocalypse", sound: "halo_killpocalypse", color: "#ff1744" },
  { name: "Killionaire", sound: "halo_killionaire", color: "#ffd600" },
];
const HEXAGON = "clip-path:polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

function haloMedal(parent, value, size, left, top, srcFormat) {
  const { color } = tierOf(HALO_TIERS, value);
  const medal = child(parent, `left:${left}px;top:${top}px;width:${size}px;height:${size}px;opacity:0`);
  if (srcFormat) {
    medal.innerHTML = `<img src="${srcFormat.replace("{value}", value)}" style="width:100%;height:100%;object-fit:contain">`;
    return medal;
  }
  const inset = Math.round(size * 0.07);
  medal.innerHTML =
    `<div style="position:absolute;inset:0;${HEXAGON};background:#101010"></div>` +
    `<div style="position:absolute;inset:${inset}px;${HEXAGON};background:radial-gradient(circle at 50% 30%, #fff 0%, ${color} 42%, #1a1a1a 100%)"></div>` +
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 ${Math.round(size * 0.34)}px ${IMPACT};` +
    `color:#fff;-webkit-text-stroke:${Math.max(2, size / 28)}px #000;paint-order:stroke fill">x${value}</div>`;
  return medal;
}

function runHaloKillstreak(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const value = valueOf(entry, context);
  const streakMs = entry.streak_ms ?? 220;
  const holdMs = entry.hold_ms ?? 1900;
  const fadeOutMs = entry.fade_out_ms ?? 350;
  const srcFormat = entry.medal_src_format ?? null;
  const final = tierOf(HALO_TIERS, value);

  (async () => {
    const root = createEventDiv(eventName, "inset:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.75) 100%)");
    anim(eventName, root, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });

    const firstStreak = Math.max(2, value - 5);
    for (let n = firstStreak; n < value; n += 1) {
      const medal = haloMedal(root, n, 58, 24 + (n - firstStreak) * 66, 398, srcFormat);
      popIn(eventName, medal, { durationMs: 200 });
      sfx(eventName, null, "medal", { volume: 0.5, playbackRate: 0.85 + (n - firstStreak) * 0.07 });
      await wait(eventName, streakMs);
    }

    const size = 170;
    const big = haloMedal(root, value, size, W / 2 - size / 2, 50, srcFormat);
    anim(eventName, big, [
      { transform: "scale(3) rotate(-25deg)", opacity: 0 },
      { transform: "scale(0.9) rotate(3deg)", opacity: 1, offset: 0.7 },
      { transform: "scale(1) rotate(0deg)", opacity: 1 },
    ], { duration: 280, easing: "ease-in", fill: "forwards" });
    await wait(eventName, 230);
    sfx(eventName, final.sound, "medal");
    flashScreen(eventName, { color: final.color, peak: 0.45, durationMs: 260 });
    shake(eventName, root, { amplitude: 4 + value * 2, durationMs: 380 });

    const title = child(
      root,
      `left:0;width:${W}px;top:245px;text-align:center;font:italic 900 66px ${IMPACT};letter-spacing:3px;text-transform:uppercase;` +
        `color:#fff;text-shadow:0 0 18px ${final.color}, 0 0 36px ${final.color};${STROKE_TEXT}`,
      final.name
    );
    anim(eventName, title, [
      { transform: "scale(1.8)", letterSpacing: "30px", opacity: 0 },
      { transform: "scale(1)", letterSpacing: "3px", opacity: 1 },
    ], { duration: 260, easing: "ease-out", fill: "forwards" });
    const sub = child(root, `left:0;width:${W}px;top:330px;text-align:center;font:900 44px ${IMPACT};color:${final.color};${STROKE_TEXT}`, `x${value}`);
    popIn(eventName, sub, { durationMs: 300 });
    // Große Medaille glänzt während des Haltens langsam nach.
    anim(eventName, big, [{ filter: "brightness(1)" }, { filter: "brightness(1.5)" }, { filter: "brightness(1)" }], {
      duration: 900,
      delay: 300,
      iterations: Infinity,
    });

    await wait(eventName, holdMs);
    fadeOutAndRemove(eventName, [root], fadeOutMs, onComplete);
  })();
}

// --- 2. "dmc_rank" -------------------------------------------------------------

// Devil-May-Cry-5-Stilrang: Rechts klettert der Rangbuchstabe von D bis zum
// Rang des Multiplikators hoch (x2 D ... x6 S, ab x7 über SS bis SSS), ein
// Klingenhieb schneidet durchs Bild und der Ansager ruft das Rang-Wort.
// Felder (alle optional): climb_ms (Zeit pro Rang, 240), hold_ms (1900),
// fade_out_ms (350).
const DMC_RANKS = [
  { letter: "D", word: "Dismal", sound: "dmc_dismal", color: "#90a4ae" },
  { letter: "C", word: "Crazy!", sound: "dmc_crazy", color: "#4dd0e1" },
  { letter: "B", word: "Badass!", sound: "dmc_badass", color: "#66bb6a" },
  { letter: "A", word: "Apocalyptic!", sound: "dmc_apocalyptic", color: "#ffca28" },
  { letter: "S", word: "Savage!", sound: "dmc_savage", color: "#ff7043" },
  { letter: "SS", word: "Sick Skills!!", sound: "dmc_sick_skills", color: "#ff3d00" },
  { letter: "SSS", word: "Smokin' Sexy Style!!", sound: "dmc_smokin_sexy_style", color: "#ff1744" },
];
const DMC_FONT = '"Times New Roman", Georgia, serif';

// x2-x6 = D-S, ab x7 direkt SSS (SS wird dabei nur durchlaufen).
function dmcRankIndex(value) {
  return value >= 7 ? DMC_RANKS.length - 1 : Math.max(0, Math.min(4, value - 2));
}

function runDmcRank(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const value = valueOf(entry, context);
  const climbMs = entry.climb_ms ?? 240;
  const holdMs = entry.hold_ms ?? 1900;
  const fadeOutMs = entry.fade_out_ms ?? 350;
  const finalIndex = dmcRankIndex(value);
  const final = DMC_RANKS[finalIndex];

  (async () => {
    const root = createEventDiv(eventName, "inset:0;overflow:hidden;background:linear-gradient(100deg, rgba(0,0,0,0.15) 25%, rgba(45,0,0,0.88) 60%)");
    anim(eventName, root, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });

    const letter = child(
      root,
      `left:400px;top:40px;width:380px;height:230px;display:flex;align-items:center;justify-content:center;` +
        `font:italic 900 190px ${DMC_FONT};line-height:1;${STROKE_TEXT};-webkit-text-stroke-width:5px`
    );
    const word = child(root, `left:400px;width:380px;top:275px;text-align:center;font:italic 700 40px ${DMC_FONT};opacity:0;${STROKE_TEXT}`);
    const meter = child(root, "left:470px;top:345px;width:240px;height:14px;border:2px solid #ddd;background:rgba(0,0,0,0.6);transform:skewX(-20deg)");
    const fill = child(meter, "left:0;top:0;bottom:0;width:0");
    const label = child(root, `left:400px;width:380px;top:370px;text-align:center;font:900 34px ${IMPACT};color:#fff;opacity:0;${STROKE_TEXT}`, `STYLE x${value}`);

    for (let i = 0; i <= finalIndex; i += 1) {
      const rank = DMC_RANKS[i];
      letter.textContent = rank.letter;
      letter.style.color = rank.color;
      letter.style.textShadow = `0 0 25px ${rank.color}`;
      fill.style.width = `${((i + 1) / DMC_RANKS.length) * 100}%`;
      fill.style.background = rank.color;
      anim(eventName, letter, [
        { transform: "translateX(90px) skewX(-18deg) scale(1.3)", opacity: 0 },
        { transform: "translateX(0) skewX(-8deg) scale(1)", opacity: 1 },
      ], { duration: 150, easing: "ease-out", fill: "forwards" });
      sfx(eventName, null, "rank_hit", { volume: 0.6, playbackRate: 1 + i * 0.12 });
      if (i < finalIndex) await wait(eventName, climbMs);
    }

    // Klingenhieb quer über den Rang.
    const slash = child(root, "left:-100px;top:150px;width:1000px;height:6px;background:#fff;box-shadow:0 0 18px #fff;transform-origin:0 50%");
    anim(eventName, slash, [
      { transform: "rotate(-18deg) scaleX(0)", opacity: 1 },
      { transform: "rotate(-18deg) scaleX(1)", opacity: 1, offset: 0.5 },
      { transform: "rotate(-18deg) scaleX(1)", opacity: 0 },
    ], { duration: 320, easing: "ease-out", fill: "forwards" });
    flashScreen(eventName, { color: final.color, peak: 0.4, durationMs: 250 });
    shake(eventName, root, { amplitude: 6 + finalIndex * 3, durationMs: 400 });
    sfx(eventName, final.sound, null);
    anim(eventName, letter, [{ transform: "skewX(-8deg) scale(1.35)" }, { transform: "skewX(-8deg) scale(1)" }], {
      duration: 300,
      easing: "ease-out",
      fill: "forwards",
    });

    word.textContent = final.word;
    word.style.color = final.color;
    anim(eventName, word, [{ transform: "translateY(20px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 250, fill: "forwards" });
    anim(eventName, label, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 150, fill: "forwards" });

    // Ab S: Funken sprühen aus dem Rang.
    if (finalIndex >= 4) {
      for (let i = 0; i < 26; i += 1) {
        const spark = child(root, `left:590px;top:155px;width:6px;height:6px;border-radius:50%;background:${i % 2 ? "#ffd600" : final.color}`);
        const angle = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 180;
        anim(eventName, spark, [
          { transform: "translate(0, 0)", opacity: 1 },
          { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`, opacity: 0 },
        ], { duration: 600 + Math.random() * 500, easing: "ease-out", fill: "forwards" });
      }
    }

    await wait(eventName, holdMs);
    fadeOutAndRemove(eventName, [root], fadeOutMs, onComplete);
  })();
}

// --- 3. "balatro_mult" -----------------------------------------------------------

// Balatro-Wertung: Eine Joker-Karte wackelt, "X{value} Mult" poppt über ihr
// auf, die rote Mult-Box zählt hörbar hoch (jeder Schritt einen Halbton-Doppel-
// schritt höher), dann rechnet die Punkte-Box Chips x Mult aus - ab x5 brennt sie.
// Darunter läuft das Balatro-Theme ("balatro_music"), bis die Animation endet.
// Felder (alle optional): card_src (Bild auf der Karte, Default egypt_oleg.png),
// card_name ("JOKER"), chips (100), step_ms (Zählschritt, 170), hold_ms (1700),
// fade_out_ms (350). Schrift "m6x11" (Balatro-Font), falls in
// assets/fonts/m6x11.ttf vorhanden - sonst Courier.
const BALATRO_FONT = '"m6x11", "Courier New", monospace';
const BAL_BLUE = "#009dff";
const BAL_RED = "#fe5f55";
// Schrift schon beim Start laden, sonst erscheint sie erst beim zweiten Mal.
document.fonts?.load('32px "m6x11"').catch(() => {});

function runBalatroMult(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const value = valueOf(entry, context);
  const chips = entry.chips ?? 100;
  const stepMs = entry.step_ms ?? 170;
  const holdMs = entry.hold_ms ?? 1700;
  const fadeOutMs = entry.fade_out_ms ?? 350;
  const box = "height:84px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:58px;box-shadow:0 5px 0 rgba(0,0,0,0.35)";

  (async () => {
    const root = createEventDiv(eventName, `inset:0;background:rgba(20,32,35,0.85);font-family:${BALATRO_FONT};font-weight:bold;color:#fff`);
    anim(eventName, root, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    sfx(eventName, "balatro_music", null, { volume: 0.7 });

    const card = child(
      root,
      "left:80px;top:110px;width:170px;height:240px;border-radius:12px;background:#fff;border:5px solid #e8e0d0;box-shadow:0 8px 0 rgba(0,0,0,0.4);overflow:hidden",
      `<img src="${entry.card_src ?? "assets/overlays/egypt_oleg.png"}" style="position:absolute;left:8px;top:8px;width:144px;height:180px;object-fit:cover;border-radius:6px;background:#3b4a4d">` +
        `<div style="position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:26px;color:${BAL_RED}"></div>`
    );
    card.lastChild.textContent = entry.card_name ?? "JOKER";
    anim(eventName, card, [
      { transform: "translateY(-380px) rotate(-14deg)" },
      { transform: "translateY(0) rotate(0deg)" },
    ], { duration: 380, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)", fill: "forwards" });

    const chipsBox = child(root, `left:320px;top:130px;width:170px;background:${BAL_BLUE};${box}`, String(chips));
    child(root, "left:497px;top:140px;width:50px;text-align:center;font-size:56px;color:" + BAL_RED, "X");
    const multBox = child(root, `left:555px;top:130px;width:170px;background:${BAL_RED};${box}`, "1");
    const score = child(root, `left:320px;top:250px;width:405px;background:#2b3a3d;border:3px solid #56676a;${box}`, "0");
    child(root, "left:320px;top:95px;width:170px;text-align:center;font-size:24px;color:#c9d6d8", "Chips");
    child(root, "left:555px;top:95px;width:170px;text-align:center;font-size:24px;color:#c9d6d8", "Mult");
    await wait(eventName, 550);

    // Joker löst aus.
    anim(eventName, card, [
      { transform: "rotate(0deg) scale(1)" },
      { transform: "rotate(-8deg) scale(1.12)" },
      { transform: "rotate(7deg) scale(1.12)" },
      { transform: "rotate(-4deg) scale(1.05)" },
      { transform: "rotate(0deg) scale(1)" },
    ], { duration: 450, easing: "ease-out" });
    const popup = child(
      root,
      `left:60px;top:60px;width:210px;height:48px;border-radius:8px;background:${BAL_RED};display:flex;align-items:center;justify-content:center;font-size:32px;box-shadow:0 4px 0 rgba(0,0,0,0.35)`,
      `X${value} Mult`
    );
    popIn(eventName, popup, { overshoot: 1.35, durationMs: 300 });

    for (let i = 1; i <= value; i += 1) {
      multBox.textContent = String(i);
      anim(eventName, multBox, [
        { transform: `scale(${1.1 + i * 0.03}) rotate(${i % 2 ? -4 : 4}deg)` },
        { transform: "scale(1) rotate(0deg)" },
      ], { duration: stepMs, easing: "ease-out" });
      sfx(eventName, null, "mult_pop", { playbackRate: 2 ** (((i - 1) * 2) / 12) });
      await wait(eventName, stepMs);
    }

    // Punkte hochzählen.
    const total = chips * value;
    const countMs = 650;
    trackLoop(eventName, (elapsed) => {
      const t = Math.min(1, elapsed / countMs);
      score.textContent = String(Math.round(total * (1 - (1 - t) ** 3)));
      return t < 1;
    });
    [chipsBox, multBox].forEach((node) =>
      anim(eventName, node, [{ transform: "scale(1)" }, { transform: "scale(0.9)" }, { transform: "scale(1)" }], { duration: countMs })
    );
    await wait(eventName, countMs);
    sfx(eventName, null, "mult_pop", { playbackRate: 2 ** (((value + 1) * 2) / 12), volume: 1.2 });
    shake(eventName, score, { amplitude: 6 + value, durationMs: 350 });

    if (value >= 5) {
      // Flammen hinter der Punkte-Box wie bei einer riesigen Wertung.
      for (let i = 0; i < 9; i += 1) {
        const flame = child(
          root,
          `left:${322 + i * 45}px;top:190px;width:44px;height:80px;border-radius:50% 50% 20% 20%;` +
            "background:linear-gradient(0deg, #ff3d00 0%, #ffab00 55%, rgba(255,235,59,0) 100%);transform-origin:50% 100%",
          ""
        );
        root.insertBefore(flame, score);
        anim(eventName, flame, [{ transform: "scaleY(0.6)" }, { transform: `scaleY(${1.1 + Math.random() * 0.5})` }], {
          duration: 140 + Math.random() * 120,
          direction: "alternate",
          iterations: Infinity,
        });
      }
      score.style.color = "#ffd600";
    }

    await wait(eventName, holdMs);
    fadeOutAndRemove(eventName, [root], fadeOutMs, () => {
      stopEventSounds(eventName);
      onComplete?.();
    });
  })();
}

// --- 4. "dbz_powerup" ------------------------------------------------------------

// Dragon Ball: Ein Scouter misst die Kampfkraft (value x power_per_value).
// Über 9000 (ab x6 mit dem Default) ruft Vegeta "It's over 9000!" und der
// Scouter platzt. Danach verwandelt sich der Spieler mit Aura, Blitzen und
// Steinbrocken in die Stufe zum Multiplikator (x2 Super Saiyan ... x7 Ultra
// Instinct). Felder (alle optional): player_src (Default egypt_oleg.png),
// power_per_value (1600), scouter_ms (1500), powerup_ms (2600), hold_ms (900),
// fade_out_ms (350).
const DBZ_STAGES = [
  { name: "SUPER SAIYAN", color: "#ffd600", glow: "#fff59d", lightning: false },
  { name: "SUPER SAIYAN 2", color: "#ffd600", glow: "#fff59d", lightning: true },
  { name: "SUPER SAIYAN 3", color: "#ffab00", glow: "#ffe082", lightning: true },
  { name: "SUPER SAIYAN GOD", color: "#ff1744", glow: "#ff8a80", lightning: false },
  { name: "SUPER SAIYAN BLUE", color: "#00b0ff", glow: "#80d8ff", lightning: true },
  { name: "ULTRA INSTINCT", color: "#d1c4e9", glow: "#ffffff", lightning: true },
];
const SCOUTER_GREEN = "#7dffa0";

function lightningBolt(parent, cx, cy, color) {
  let x = cx + (Math.random() - 0.5) * 160;
  let y = cy - 150 + Math.random() * 60;
  const points = [`${x},${y}`];
  for (let i = 0; i < 6; i += 1) {
    x += (Math.random() - 0.5) * 50;
    y += 30 + Math.random() * 25;
    points.push(`${x},${y}`);
  }
  return child(
    parent,
    `left:0;top:0;width:${W}px;height:${H}px`,
    `<svg width="${W}" height="${H}"><polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="4" ` +
      'stroke-linejoin="bevel" style="filter:drop-shadow(0 0 6px #fff)"/></svg>'
  );
}

function runDbzPowerup(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const value = valueOf(entry, context);
  const power = value * (entry.power_per_value ?? 1600);
  const scouterMs = entry.scouter_ms ?? 1500;
  const powerupMs = entry.powerup_ms ?? 2600;
  const holdMs = entry.hold_ms ?? 900;
  const fadeOutMs = entry.fade_out_ms ?? 350;
  const stage = tierOf(DBZ_STAGES, value);
  const cx = W / 2;
  const cy = 260;

  (async () => {
    const root = createEventDiv(eventName, "inset:0;overflow:hidden;background:rgba(0,0,0,0.6)");
    anim(eventName, root, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    const auraLayer = child(root, "inset:0");
    const player = child(
      root,
      `left:${cx - 110}px;top:100px;width:220px;height:330px;object-fit:contain;object-position:bottom`,
      "",
      "img"
    );
    player.src = entry.player_src ?? "assets/overlays/egypt_oleg.png";

    // Phase 1: Scouter.
    const tint = child(root, "inset:0;background:repeating-linear-gradient(0deg, rgba(60,255,120,0.14) 0 2px, rgba(60,255,120,0.06) 2px 4px)");
    const reticle = child(root, `left:${cx - 60}px;top:120px;width:120px;height:120px;border:3px dashed ${SCOUTER_GREEN};border-radius:50%`);
    anim(eventName, reticle, [{ transform: "rotate(0deg) scale(1.4)" }, { transform: "rotate(360deg) scale(1)" }], { duration: 1200, iterations: Infinity });
    const lens = child(
      root,
      "left:480px;top:40px;width:290px;height:170px;background:rgba(40,255,110,0.22);border:3px solid rgba(125,255,160,0.9);" +
        `clip-path:polygon(0 0, 100% 12%, 100% 88%, 0 100%);font-family:"Courier New", monospace;font-weight:bold;color:${SCOUTER_GREEN};text-shadow:0 0 8px ${SCOUTER_GREEN}`,
      '<div style="position:absolute;left:24px;top:22px;font-size:18px">POWER LEVEL</div>' +
        '<div class="pl" style="position:absolute;left:24px;top:52px;font-size:62px">0</div>'
    );
    const levelText = lens.querySelector(".pl");
    let lastBeep = -1;
    trackLoop(eventName, (elapsed) => {
      const t = Math.min(1, elapsed / scouterMs);
      const jitter = t < 1 ? Math.round((Math.random() - 0.5) * 300 * (1 - t)) : 0;
      levelText.textContent = String(Math.max(0, Math.round(power * t ** 2) + jitter));
      const beep = Math.floor(elapsed / 90);
      if (t < 1 && beep !== lastBeep) {
        lastBeep = beep;
        sfx(eventName, null, "scouter_beep", { playbackRate: 1 + t * 0.5 });
      }
      return t < 1;
    });
    await wait(eventName, scouterMs);

    if (power > 9000) {
      levelText.style.color = "#ff5252";
      levelText.style.textShadow = "0 0 10px #ff1744";
      sfx(eventName, "over_9000", null);
      const over = child(
        root,
        `left:0;width:${W}px;top:230px;text-align:center;font:900 64px ${IMPACT};color:#ffea00;${STROKE_TEXT};-webkit-text-stroke-width:5px`,
        "IT'S OVER 9000!!!"
      );
      popIn(eventName, over, { from: 2.5, overshoot: 0.9, durationMs: 250, rotate: -6 });
      shake(eventName, lens, { amplitude: 10, durationMs: 700 });
      child(
        lens,
        "inset:0",
        '<svg width="290" height="170"><polyline points="150,0 130,60 170,90 120,170" fill="none" stroke="#fff" stroke-width="3"/>' +
          '<polyline points="130,60 60,80 20,140" fill="none" stroke="#fff" stroke-width="2"/></svg>'
      );
      await wait(eventName, 1100);
      sfx(eventName, null, "explosion");
      flashScreen(eventName, { peak: 0.9, durationMs: 300 });
      anim(eventName, lens, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.6) rotate(12deg)", opacity: 0 }], { duration: 300, fill: "forwards" });
      anim(eventName, over, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 300, fill: "forwards" });
      await wait(eventName, 450);
    } else {
      await wait(eventName, 500);
      anim(eventName, lens, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" });
    }
    [tint, reticle].forEach((node) => anim(eventName, node, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }));

    // Phase 2: Verwandlung.
    sfx(eventName, "dbz_powerup", "aura_charge");
    anim(eventName, root, [{ background: "rgba(0,0,0,0.6)" }, { background: "rgba(0,0,0,0.85)" }], { duration: 600, fill: "forwards" });
    player.style.filter = `drop-shadow(0 0 10px ${stage.glow})`;
    anim(eventName, player, [{ translate: "-2px 1px" }, { translate: "2px -1px" }], { duration: 70, direction: "alternate", iterations: Infinity });
    [1, 0.8, 0.6].forEach((scale, i) => {
      const aura = child(
        auraLayer,
        `left:${cx - 170 * scale}px;top:${cy - 230 * scale}px;width:${340 * scale}px;height:${440 * scale}px;border-radius:50% 50% 45% 45%;` +
          `background:radial-gradient(ellipse at 50% 65%, ${stage.glow} 0%, ${stage.color} 35%, rgba(0,0,0,0) 70%);opacity:0.85;transform-origin:50% 100%`
      );
      anim(eventName, aura, [
        { transform: "scale(0.2, 0.1)", opacity: 0 },
        { transform: "scale(1, 1)", opacity: 0.85 },
      ], { duration: 500, delay: i * 80, easing: "ease-out", fill: "forwards" }).finished.then(() =>
        anim(eventName, aura, [{ transform: "scale(0.95, 0.97)" }, { transform: "scale(1.05, 1.08)" }], {
          duration: 160 + i * 50,
          direction: "alternate",
          iterations: Infinity,
        })
      ).catch(() => {});
    });
    // Aufsteigende Aura-Streifen und schwebende Steinbrocken.
    for (let i = 0; i < 16; i += 1) {
      const streak = child(auraLayer, `left:${cx - 120 + Math.random() * 240}px;top:${cy + 100}px;width:4px;height:${30 + Math.random() * 40}px;background:${stage.glow};border-radius:2px;opacity:0`);
      anim(eventName, streak, [
        { transform: "translateY(0)", opacity: 0 },
        { transform: "translateY(-120px)", opacity: 0.9, offset: 0.3 },
        { transform: "translateY(-340px)", opacity: 0 },
      ], { duration: 700, delay: Math.random() * 700, iterations: Infinity });
    }
    for (let i = 0; i < 9; i += 1) {
      const size = 10 + Math.random() * 18;
      const rock = child(root, `left:${80 + Math.random() * 640}px;top:${H}px;width:${size}px;height:${size * 0.8}px;background:#6d5d4b;border-radius:30% 50% 40% 60%;border:2px solid #3e342a`);
      anim(eventName, rock, [
        { transform: "translateY(0) rotate(0deg)" },
        { transform: `translateY(-${120 + Math.random() * 260}px) rotate(${Math.random() * 360}deg)` },
      ], { duration: powerupMs, delay: Math.random() * 400, easing: "ease-out", fill: "forwards" });
    }
    anim(eventName, root, [{ translate: "-3px 2px" }, { translate: "3px -2px" }], { duration: 90, direction: "alternate", iterations: Infinity });

    const boltUntil = performance.now() + powerupMs + holdMs;
    const boltLoop = async () => {
      while (stage.lightning && performance.now() < boltUntil) {
        const bolt = lightningBolt(root, cx, cy, stage.glow);
        await wait(eventName, 70);
        bolt.remove();
        await wait(eventName, 120 + Math.random() * 250);
      }
    };
    boltLoop();

    await wait(eventName, powerupMs * 0.55);
    flashScreen(eventName, { color: stage.glow, peak: 0.85, durationMs: 350 });
    anim(eventName, player, [{ transform: "scale(1)" }, { transform: "scale(1.08)" }], { duration: 300, fill: "forwards" });
    const label = child(
      root,
      `left:0;width:${W}px;top:20px;text-align:center;font:italic 900 56px ${IMPACT};color:${stage.color};${STROKE_TEXT};-webkit-text-stroke-width:4px;` +
        `text-shadow:0 0 20px ${stage.glow}`,
      `${stage.name}<div style="font-size:40px;color:#fff">x${value}</div>`
    );
    popIn(eventName, label, { from: 2, overshoot: 0.92, durationMs: 300 });

    await wait(eventName, powerupMs * 0.45 + holdMs);
    fadeOutAndRemove(eventName, [root], fadeOutMs, () => {
      stopEventSounds(eventName);
      onComplete?.();
    });
  })();
}

// --- 5. "money_printer" ----------------------------------------------------------

// "Money printer go brrr": Ein Drucker rattert und spuckt so viele Geldscheine
// aus, wie der Multiplikator groß ist (Schein i trägt "x{i}"), die Scheine
// fliegen abwechselnd nach links und rechts auf Stapel. Am Ende "MONEY
// PRINTER GO BRR" mit einem R mehr pro Multiplikator-Stufe.
// Felder (alle optional): print_ms (Abstand der Scheine, Default 1800 /
// value, mind. 260), printer_src / bill_src (eigene Bilder statt CSS),
// hold_ms (1600), fade_out_ms (350).
function moneyBill(parent, label, billSrc, left, top) {
  if (billSrc) {
    return child(parent, `left:${left}px;top:${top}px;width:150px;height:66px`, `<img src="${billSrc}" style="width:100%;height:100%;object-fit:contain">`);
  }
  return child(
    parent,
    `left:${left}px;top:${top}px;width:150px;height:66px;box-sizing:border-box;background:#85bb65;border:3px solid #2e5e1e;border-radius:4px;` +
      `display:flex;align-items:center;justify-content:space-between;padding:0 10px;font:900 20px ${IMPACT};color:#1b3d10`,
    `<span>$</span><span style="width:54px;height:44px;border-radius:50%;background:#a8d08d;border:2px solid #2e5e1e;display:flex;align-items:center;` +
      `justify-content:center;font-size:24px">${label}</span><span>$</span>`
  );
}

function runMoneyPrinter(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const value = valueOf(entry, context);
  const printMs = entry.print_ms ?? Math.max(260, 1800 / value);
  const holdMs = entry.hold_ms ?? 1600;
  const fadeOutMs = entry.fade_out_ms ?? 350;
  const billSrc = entry.bill_src ?? null;
  const px = W / 2 - 130;
  const py = 270;

  (async () => {
    const root = createEventDiv(eventName, "inset:0;overflow:hidden;background:rgba(0,30,8,0.7)");
    anim(eventName, root, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    const billLayer = child(root, "inset:0");
    const printer = entry.printer_src
      ? child(root, `left:${px}px;top:${py - 30}px;width:260px;height:180px`, `<img src="${entry.printer_src}" style="width:100%;height:100%;object-fit:contain">`)
      : child(
          root,
          `left:${px}px;top:${py}px;width:260px;height:150px;box-sizing:border-box;border-radius:14px;border:4px solid #424242;` +
            "background:linear-gradient(180deg, #eeeeee 0%, #9e9e9e 100%);box-shadow:0 8px 0 rgba(0,0,0,0.4)",
          '<div style="position:absolute;left:26px;top:14px;width:200px;height:10px;border-radius:5px;background:#212121"></div>' +
            '<div style="position:absolute;left:20px;top:56px;width:212px;text-align:center;font:bold 15px Arial, sans-serif;color:#424242;letter-spacing:1px">BRRR-O-MAT 3000</div>' +
            '<div class="led" style="position:absolute;right:18px;bottom:16px;width:14px;height:14px;border-radius:50%;background:#00e676;box-shadow:0 0 8px #00e676"></div>' +
            '<div style="position:absolute;left:18px;bottom:14px;width:120px;height:10px;border-radius:3px;background:#616161"></div>'
        );
    anim(eventName, printer, [{ translate: "-2px 0" }, { translate: "2px -1px" }], { duration: 50, direction: "alternate", iterations: Infinity });
    const led = printer.querySelector(".led");
    if (led) anim(eventName, led, [{ opacity: 1 }, { opacity: 0.2 }], { duration: 120, direction: "alternate", iterations: Infinity });
    sfx(eventName, "money_printer", "brrr", { volume: 0.8 });

    const title = child(root, `left:0;width:${W}px;top:20px;text-align:center;font:900 50px ${IMPACT};color:#fff;${STROKE_TEXT}`, "MONEY PRINTER GO");
    popIn(eventName, title, { durationMs: 300 });
    const counter = child(root, `left:0;width:${W}px;top:150px;text-align:center;font:900 76px ${IMPACT};color:#b9f6ca;${STROKE_TEXT};-webkit-text-stroke-width:4px`);
    await wait(eventName, 300);

    for (let i = 1; i <= value; i += 1) {
      const bill = moneyBill(billLayer, `x${i}`, billSrc, W / 2 - 75, py - 60);
      const left = i % 2 === 1;
      const row = Math.floor((i - 1) / 2);
      const dx = (left ? 40 + Math.random() * 30 : 600 + Math.random() * 30) - (W / 2 - 75);
      const dy = 100 + row * 70 - (py - 60);
      const rot = (Math.random() - 0.5) * 30;
      anim(eventName, bill, [
        { transform: "translateY(70px)" },
        { transform: "translateY(-50px)", offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)` },
      ], { duration: 650, easing: "ease-out", fill: "forwards" });
      counter.textContent = `x${i}`;
      anim(eventName, counter, [{ transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 200, easing: "ease-out" });
      // Kleine Scheine, die aus dem Drucker sprühen.
      for (let k = 0; k < 5; k += 1) {
        const mini = child(billLayer, `left:${W / 2 - 15}px;top:${py - 5}px;width:30px;height:14px;background:#85bb65;border:1px solid #2e5e1e`);
        const mx = (Math.random() - 0.5) * 600;
        anim(eventName, mini, [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${mx * 0.6}px, -${120 + Math.random() * 120}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${mx}px, ${H - py + 40}px) rotate(${Math.random() * 720}deg)`, opacity: 0.8 },
        ], { duration: 1200 + Math.random() * 500, easing: "ease-in", fill: "forwards" }).finished.then(() => mini.remove()).catch(() => {});
      }
      await wait(eventName, printMs);
    }

    title.textContent = `MONEY PRINTER GO BRR${"R".repeat(value)}`;
    popIn(eventName, title, { overshoot: 1.2, durationMs: 250 });
    flashScreen(eventName, { color: "#00e676", peak: 0.35, durationMs: 250 });
    shake(eventName, root, { amplitude: 8, durationMs: 400 });

    await wait(eventName, holdMs);
    fadeOutAndRemove(eventName, [root], fadeOutMs, () => {
      stopEventSounds(eventName);
      onComplete?.();
    });
  })();
}

// --- 6. "hitmarker_combo" ----------------------------------------------------------

// MLG-Hitmarker: So viele Hitmarker wie der Multiplikator, immer schneller und
// über das ganze Spielbild verteilt, daneben zählt ein bunter Zähler mit. Zum
// Schluss "WOMBO COMBO!!!" (bei x3 "OH BABY A TRIPLE!!"). Der Wombo-Clip
// beginnt mit "Happy feet!" - der Schriftzug erscheint deshalb erst nach
// wombo_text_delay_ms, genau auf "Wombo Combo".
// Felder (alle optional): hold_ms (1800), fade_out_ms (350), finale_text
// (überschreibt den Schluss-Text), wombo_text_delay_ms (1250).
const HITMARKER_SVG =
  '<svg width="80" height="80" viewBox="0 0 80 80">' +
  ["#000", "#fff"]
    .map(
      (color, i) =>
        `<g stroke="${color}" stroke-width="${i ? 5 : 10}" stroke-linecap="square">` +
        '<line x1="10" y1="10" x2="30" y2="30"/><line x1="70" y1="10" x2="50" y2="30"/>' +
        '<line x1="10" y1="70" x2="30" y2="50"/><line x1="70" y1="70" x2="50" y2="50"/></g>'
    )
    .join("") +
  "</svg>";

function runHitmarkerCombo(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const value = valueOf(entry, context);
  const holdMs = entry.hold_ms ?? 1800;
  const fadeOutMs = entry.fade_out_ms ?? 350;
  const triple = value === 3;
  const finaleText = entry.finale_text ?? (triple ? "OH BABY A TRIPLE!!" : "WOMBO COMBO!!!");

  (async () => {
    const root = createEventDiv(eventName, "inset:0;background:rgba(0,0,0,0.25)");

    const counter = child(root, `left:0;width:${W}px;top:${H / 2 - 60}px;text-align:center;font:900 100px ${IMPACT};${STROKE_TEXT};-webkit-text-stroke-width:5px`);
    for (let i = 1; i <= value; i += 1) {
      const hit = child(root, `left:${150 + Math.random() * 420}px;top:${70 + Math.random() * 260}px;width:80px;height:80px`, HITMARKER_SVG);
      anim(eventName, hit, [
        { transform: "scale(1.8)", opacity: 1 },
        { transform: "scale(1)", opacity: 1, offset: 0.15 },
        { transform: "scale(1)", opacity: 1, offset: 0.6 },
        { transform: "scale(1)", opacity: 0 },
      ], { duration: 700, fill: "forwards" });
      sfx(eventName, null, "hitmarker");
      counter.textContent = `x${i}`;
      counter.style.color = RAINBOW[i % RAINBOW.length];
      anim(eventName, counter, [
        { transform: `scale(${1.6 + i * 0.1}) rotate(${i % 2 ? -8 : 8}deg)` },
        { transform: `scale(${1 + i * 0.05}) rotate(0deg)` },
      ], { duration: 180, easing: "ease-out", fill: "forwards" });
      shake(eventName, root, { amplitude: 4 + i, durationMs: 180 });
      await wait(eventName, Math.max(110, 380 - i * 45));
    }
    await wait(eventName, 250);

    const finaleSound = triple ? "oh_baby_a_triple" : "wombo_combo";
    sfx(eventName, finaleSound, "airhorn");
    if (finaleSound === "wombo_combo" && hasSound("wombo_combo")) await wait(eventName, entry.wombo_text_delay_ms ?? 1250);
    flashScreen(eventName, { peak: 0.7, durationMs: 200 });
    anim(eventName, counter, [{ transform: "scale(1)", top: `${H / 2 - 60}px` }, { transform: "scale(0.8)", top: "300px" }], {
      duration: 250,
      fill: "forwards",
    });
    const finale = child(root, `left:0;width:${W}px;top:110px;text-align:center;font:900 72px ${IMPACT};${STROKE_TEXT};-webkit-text-stroke-width:5px`, finaleText);
    anim(eventName, finale, [
      { transform: "scale(3) rotate(-15deg)", opacity: 0 },
      { transform: "scale(1) rotate(-4deg)", opacity: 1 },
    ], { duration: 220, easing: "ease-in", fill: "forwards" }).finished.then(() =>
      anim(eventName, finale, [{ transform: "scale(1) rotate(-4deg)" }, { transform: "scale(1.1) rotate(4deg)" }], {
        duration: 180,
        direction: "alternate",
        iterations: Infinity,
      })
    ).catch(() => {});
    anim(eventName, finale, RAINBOW.map((color) => ({ color })), { duration: 600, iterations: Infinity });
    shake(eventName, root, { amplitude: 16, durationMs: 500 });

    await wait(eventName, holdMs);
    fadeOutAndRemove(eventName, [root], fadeOutMs, onComplete);
  })();
}

// --- 7. "combo_finale" ----------------------------------------------------------------

// Combo-Finale nach mehreren Multiplikator-Treffern (Event "multiplier_combo",
// siehe showMultiplierCombo in effects.js): Die Einzelwerte addieren sich
// sichtbar ("x2 + x3 + x4 = x9"), dann feiert eine der Multiplikator-
// Animationen die Summe - Halo z.B. mit "Killpocalypse".
// Felder (alle optional): finale ("halo_killstreak", "dmc_rank", ...,
// Default halo_killstreak), step_ms (380), equation_hold_ms (900), values
// (Demo-Werte, falls context.values fehlt). Übrige Felder gehen an die
// Finale-Animation weiter (z.B. hold_ms).
function runComboFinale(eventName, el, entry, pos, onComplete, context) {
  el.remove();
  const values = context?.values ?? entry.values ?? [2, 3];
  const total = context?.value ?? values.reduce((sum, v) => sum + v, 0);
  const finale = MULTIPLIER_ANIMS[entry.finale] ?? runHaloKillstreak;
  const stepMs = entry.step_ms ?? 380;

  (async () => {
    const root = createEventDiv(
      eventName,
      `inset:0;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;gap:16px;font:900 64px ${IMPACT};color:#fff`
    );
    const heading = child(root, `left:0;width:${W}px;top:70px;text-align:center;font-size:44px;color:#ffd600;${STROKE_TEXT}`, `${values.length}x MULTI-COMBO!`);
    popIn(eventName, heading, { durationMs: 250 });

    const term = (text, css = "") => {
      const span = document.createElement("span");
      span.style.cssText = `display:inline-block;${STROKE_TEXT};${css}`;
      span.textContent = text;
      root.appendChild(span);
      popIn(eventName, span, { durationMs: 220 });
      return span;
    };
    for (let i = 0; i < values.length; i += 1) {
      if (i > 0) term("+", "color:#aaa");
      term(`x${values[i]}`, `color:${RAINBOW[i % RAINBOW.length]}`);
      sfx(eventName, null, "mult_pop", { playbackRate: 2 ** ((i * 3) / 12) });
      await wait(eventName, stepMs);
    }
    term("=", "color:#aaa");
    await wait(eventName, stepMs);
    const sum = term(`x${total}`, "color:#ffd600;font-size:96px;text-shadow:0 0 25px #ffab00");
    popIn(eventName, sum, { from: 3, overshoot: 0.9, durationMs: 250 });
    sfx(eventName, null, "rank_hit", { volume: 1 });
    flashScreen(eventName, { color: "#ffd600", peak: 0.5, durationMs: 250 });
    shake(eventName, root, { amplitude: 12, durationMs: 400 });
    await wait(eventName, entry.equation_hold_ms ?? 900);

    anim(eventName, root, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    await wait(eventName, 200);
    root.remove();
    finale(eventName, el, entry, pos, onComplete, { ...context, value: total, values });
  })();
}

export const MULTIPLIER_ANIMS = {
  halo_killstreak: runHaloKillstreak,
  dmc_rank: runDmcRank,
  balatro_mult: runBalatroMult,
  dbz_powerup: runDbzPowerup,
  money_printer: runMoneyPrinter,
  hitmarker_combo: runHitmarkerCombo,
  combo_finale: runComboFinale,
};
