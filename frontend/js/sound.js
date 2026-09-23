const SOUND_FILES = {
  lever: "assets/audio/lever.mp3",
  reel_stop: "assets/audio/reel_stop.mp3",
  win_small: "assets/audio/win_small.mp3",
  win_jackpot: "assets/audio/win_jackpot.mp3",
  lose: "assets/audio/lose.mp3",
};

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();
const buffers = new Map();

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

export function playSound(name) {
  const buffer = buffers.get(name);
  if (!buffer) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0);
}
