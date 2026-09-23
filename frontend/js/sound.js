const SOUND_FILES = {
  lever: "assets/audio/lever.mp3",
  spin: "assets/audio/spin-232536.mp3",
  reel_stop: "assets/audio/ping-82822.mp3",
  gunshot: "assets/audio/gun-shots-from-a-distance-5-96388.mp3",
  win_small: "assets/audio/win_small.mp3",
  win_jackpot: "assets/audio/win_jackpot.mp3",
  lose: "assets/audio/lose.mp3",
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
};

// Loop-Bereich (Sekunden) für Dauergeräusche. Die Spin-Datei tickt bis ~1.05s
// gleichmäßig (~107ms pro Tick) und wird danach langsamer - geloopt wird nur
// der gleichmäßige Teil, jeweils von Tick-Anfang zu Tick-Anfang.
const LOOP_REGIONS = {
  spin: { start: 0.168, end: 1.043 },
};

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();
const buffers = new Map();
const activeLoops = new Map();

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

export function playSound(name) {
  const buffer = buffers.get(name);
  if (!buffer) return;
  resumeContext();
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = SOUND_VOLUMES[name] ?? 1;
  source.connect(gain).connect(audioCtx.destination);
  source.start(0, SOUND_OFFSETS[name] ?? 0);
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
  source.connect(gain).connect(audioCtx.destination);
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
