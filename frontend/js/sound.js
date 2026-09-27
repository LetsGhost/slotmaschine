const SOUND_FILES = {
  lever: "assets/audio/game/lever.mp3",
  spin: "assets/audio/game/spin-232536.mp3",
  reel_stop: "assets/audio/game/ping-82822.mp3",
  gunshot: "assets/audio/animations/multiplier/gun-shots-from-a-distance-5-96388.mp3",
  win_small: "assets/audio/results/win_small.mp3",
  win_jackpot: "assets/audio/results/win_jackpot.mp3",
  lose: "assets/audio/results/lose.mp3",
  // Auf you_lost.webm geschnitten: setzt mit dem Banner ein, endet mit dem Video.
  you_died: "assets/audio/animations/lose/you_died.mp3",
  // Ton zum Webcam-Clip der "case_open"-Animation (Sek. 11-13 des Originalvideos).
  case_cam: "assets/audio/animations/multiplier/case_cam.mp3",
  // Tonspur von mlg_meme.webm (Gewinn-Animation).
  mlg_meme: "assets/audio/animations/win/mlg_meme.mp3",
  // Erste 3.3s von sybu_audio.webm (Original in assets_originals/audio),
  // passend zur Länge der "flyby"-Gewinnanimation mit sybau_domi.png.
  sybau: "assets/audio/animations/win/sybau.mp3",
  // Sek. 0.7-4.7 von gojo_fly_audio.webm (Original in assets_originals/audio),
  // +9dB; der erste Schlag (Sek. 3.2) fällt auf den Schnitt zur Gesichts-
  // Nahaufnahme in gojo_float.webm (Clip-Sek. 2.5).
  gojo_float: "assets/audio/animations/jackpot/gojo_float.mp3",
  // Tonspur von cursed_plankton.webm (erste 4s des Originals, +8dB).
  cursed_plankton: "assets/audio/animations/lose/cursed_plankton.mp3",
  // Erste 4s von why_so_seroius_audio.wav (Original in assets_originals/audio),
  // so lang wie die "fade"-Einblendung von jokijoki.png.
  why_so_serious: "assets/audio/animations/lose/why_so_serious.mp3",
  // Sek. 14-20 aus "the bouncing yaris of palmont city.mp4" (Original in
  // assets_originals/overlays), -5dB; läuft zu bouncing_yaris.webm (Sek. 0-6,
  // Auto per rembg/isnet-general-use freigestellt).
  bouncing_yaris: "assets/audio/animations/win/bouncing_yaris.mp3",
};

// Startversatz in Sekunden, um Stille am Dateianfang zu überspringen - der
// Ping hat ~0.31s Vorlauf und würde sonst hörbar nach dem Walzenstopp kommen.
// Der Schuss hat ~40ms Vorlauf vor dem Knall.
const SOUND_OFFSETS = {
  reel_stop: 0.3,
  gunshot: 0.035,
};

// Lautstärke (0-1) pro Sound; der Schuss ist bis 0dB normalisiert und würde
// die anderen Sounds sonst übertönen.
const SOUND_VOLUMES = {
  gunshot: 0.6,
  case_cam: 0.7,
};

// Loop-Bereich (Sekunden) für Dauergeräusche. Die Spin-Datei tickt bis ~1.05s
// gleichmäßig (~107ms pro Tick) und wird danach langsamer - geloopt wird nur
// der gleichmäßige Teil, jeweils von Tick-Anfang zu Tick-Anfang.
const LOOP_REGIONS = {
  spin: { start: 0.168, end: 1.043 },
};

// Hintergrundmusik: wird per <audio>-Element gestreamt statt komplett dekodiert
// (spart auf dem Pi RAM) und über Web Audio in den Musik-Bus geleitet.
const MUSIC_TRACKS = {
  main: "assets/audio/music/music_main.mp3",
};

// Lautstärke (0-1) pro Musiktrack.
const MUSIC_VOLUMES = {
  main: 0.4,
};

// Track, der nach preloadSounds() automatisch startet (null = keine Musik).
const DEFAULT_MUSIC = "main";

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();
const buffers = new Map();
const activeLoops = new Map();

// Bus-Struktur: Musik (Track-Gain -> Duck-Gain -> musicBus) und Effekte
// (sfxBus) laufen getrennt in den masterBus, damit sich beide unabhängig
// regeln lassen und die Musik unter Animations-Sounds abgesenkt werden kann.
const masterBus = audioCtx.createGain();
const musicBus = audioCtx.createGain();
const sfxBus = audioCtx.createGain();
const musicDuck = audioCtx.createGain();
musicDuck.connect(musicBus);
musicBus.connect(masterBus);
sfxBus.connect(masterBus);
masterBus.connect(audioCtx.destination);

const BUSES = { master: masterBus, music: musicBus, sfx: sfxBus };

export async function preloadSounds() {
  await Promise.all(
    Object.entries(SOUND_FILES).map(async ([name, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        buffers.set(name, audioBuffer);
      } catch (err) {
        console.warn(`Sound "${name}" konnte nicht geladen werden (Asset fehlt?):`, err.message);
      }
    })
  );
}

function resumeContext() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Gibt die AudioBufferSourceNode zurück (oder null), damit Aufrufer den Sound
// vorzeitig per .stop() abbrechen können - z.B. clearEvent() in effects.js.
// Optionen: delayMs (Startverzögerung, sample-genau über den AudioContext
// geplant - ein .stop() greift also auch, bevor der Sound angefangen hat),
// volume (Faktor auf SOUND_VOLUMES), bus ("sfx" oder "music").
export function playSound(name, { delayMs = 0, volume = 1, bus = "sfx" } = {}) {
  const buffer = buffers.get(name);
  if (!buffer) return null;
  resumeContext();
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = (SOUND_VOLUMES[name] ?? 1) * volume;
  source.connect(gain).connect(BUSES[bus] ?? sfxBus);
  source.start(audioCtx.currentTime + delayMs / 1000, SOUND_OFFSETS[name] ?? 0);
  return source;
}

// Spielt eine Sound-Angabe aus event_media_map.json ab und gibt alle
// gestarteten Sources zurück. Erlaubte Formen (beliebig verschachtelbar):
//   "name"                                  - einzelner Sound
//   { "name": "x", "delay_ms": 300, "volume": 0.8 }
//   { "pick": ["a", "b", ...] }             - zufällig einer davon
//   [ ...obige Formen... ]                  - alle gleichzeitig (Layering)
export function playSoundSpec(spec, { delayMs = 0 } = {}) {
  if (!spec) return [];
  if (typeof spec === "string") {
    const source = playSound(spec, { delayMs });
    return source ? [source] : [];
  }
  if (Array.isArray(spec)) {
    return spec.flatMap((part) => playSoundSpec(part, { delayMs }));
  }
  const ownDelay = delayMs + (spec.delay_ms ?? 0);
  if (Array.isArray(spec.pick)) {
    if (spec.pick.length === 0) return [];
    const choice = spec.pick[Math.floor(Math.random() * spec.pick.length)];
    return playSoundSpec(choice, { delayMs: ownDelay });
  }
  if (spec.name) {
    const source = playSound(spec.name, { delayMs: ownDelay, volume: spec.volume ?? 1 });
    return source ? [source] : [];
  }
  console.warn("Unbekannte Sound-Angabe:", spec);
  return [];
}

// Startet einen Sound als Endlosschleife (Loop-Bereich aus LOOP_REGIONS).
// Läuft derselbe Loop schon, wird er vorher sofort beendet.
export function startLoop(name) {
  const buffer = buffers.get(name);
  if (!buffer) return;
  resumeContext();
  stopLoop(name, 0);
  const region = LOOP_REGIONS[name] ?? { start: 0, end: buffer.duration };
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = region.start;
  source.loopEnd = region.end;
  const gain = audioCtx.createGain();
  source.connect(gain).connect(sfxBus);
  source.start(0, region.start);
  activeLoops.set(name, { source, gain });
}

// Lautstärke (0-1) eines laufenden Loops, mit kurzer Rampe gegen Knackser.
export function setLoopVolume(name, volume) {
  const loop = activeLoops.get(name);
  if (!loop) return;
  loop.gain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.03);
}

export function stopLoop(name, fadeMs = 150) {
  const loop = activeLoops.get(name);
  if (!loop) return;
  activeLoops.delete(name);
  const now = audioCtx.currentTime;
  loop.gain.gain.setTargetAtTime(0, now, fadeMs / 1000 / 4);
  loop.source.stop(now + fadeMs / 1000);
}

// --- Lautstärke-Regelung -------------------------------------------------

// bus: "master", "music" oder "sfx"; volume 0-1.
export function setBusVolume(bus, volume, fadeMs = 50) {
  const node = BUSES[bus];
  if (!node) return;
  node.gain.setTargetAtTime(volume, audioCtx.currentTime, fadeMs / 1000 / 4);
}

let muted = false;
let masterVolume = 1;

export function setMasterVolume(volume) {
  masterVolume = volume;
  if (!muted) setBusVolume("master", volume);
}

export function setMuted(value) {
  muted = value;
  setBusVolume("master", muted ? 0 : masterVolume);
}

export function isMuted() {
  return muted;
}

// --- Hintergrundmusik ----------------------------------------------------

// { name, el, gain } des aktuell laufenden Tracks.
let currentMusic = null;

// Browser erlauben Ton erst nach einer Nutzerinteraktion (außer Chromium
// läuft mit --autoplay-policy=no-user-gesture-required). Scheitert play()
// daran, entsperrt unlockAudio() beim nächsten Klick/Tastendruck den
// AudioContext und startet den Track nach.
function tryPlayMusicElement(el) {
  el.play().catch(() => {});
}

function unlockAudio() {
  resumeContext();
  if (currentMusic?.el.paused) tryPlayMusicElement(currentMusic.el);
}
["pointerdown", "keydown"].forEach((type) => document.addEventListener(type, unlockAudio));

function disposeTrack(track, fadeMs) {
  track.gain.gain.setTargetAtTime(0, audioCtx.currentTime, fadeMs / 1000 / 4);
  setTimeout(() => {
    track.el.pause();
    track.el.removeAttribute("src");
    track.el.load();
    track.source.disconnect();
  }, fadeMs);
}

// Startet einen Track aus MUSIC_TRACKS in Endlosschleife und blendet einen
// eventuell laufenden anderen Track dabei aus (Crossfade).
export function playMusic(name, { fadeMs = 1500 } = {}) {
  if (currentMusic?.name === name) return;
  const url = MUSIC_TRACKS[name];
  if (!url) {
    console.warn(`Unbekannter Musiktrack "${name}"`);
    return;
  }
  resumeContext();

  const el = new Audio(url);
  el.loop = true;
  el.addEventListener("error", () =>
    console.warn(`Musik "${name}" konnte nicht geladen werden (Asset fehlt?): ${url}`)
  );
  const source = audioCtx.createMediaElementSource(el);
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(musicDuck);
  gain.gain.setTargetAtTime(MUSIC_VOLUMES[name] ?? 1, audioCtx.currentTime, fadeMs / 1000 / 4);

  if (currentMusic) disposeTrack(currentMusic, fadeMs);
  currentMusic = { name, el, source, gain };
  tryPlayMusicElement(el);
}

export function stopMusic(fadeMs = 1000) {
  if (!currentMusic) return;
  disposeTrack(currentMusic, fadeMs);
  currentMusic = null;
}

// Startet DEFAULT_MUSIC (falls gesetzt) - wird nach dem Ladebildschirm aufgerufen.
export function startBackgroundMusic() {
  if (DEFAULT_MUSIC) playMusic(DEFAULT_MUSIC);
}

// Ducking: senkt die Musik ab, solange mindestens eine Anfrage aktiv ist.
// Jede Anfrage hat einen Schlüssel (z.B. den Event-Namen), damit sich
// überlappende Events nicht gegenseitig zu früh wieder hochregeln - es gilt
// immer der niedrigste angefragte Pegel.
const duckRequests = new Map();

function applyDuck(fadeMs) {
  const level = Math.min(1, ...duckRequests.values());
  musicDuck.gain.setTargetAtTime(level, audioCtx.currentTime, fadeMs / 1000 / 4);
}

export function duckMusic(key, level = 0.3, fadeMs = 200) {
  duckRequests.set(key, level);
  applyDuck(fadeMs);
}

export function unduckMusic(key, fadeMs = 800) {
  if (!duckRequests.delete(key)) return;
  applyDuck(fadeMs);
}
