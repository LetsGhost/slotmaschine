const SOUND_FILES = {
  // Hebel-Kurbeln beim Spin-Start (socket.js, state_update SPINNING).
  lever: "assets/audio/game/freesound_community-levercrank-99375.mp3",
  spin: "assets/audio/game/spin-232536.mp3",
  reel_stop: "assets/audio/game/ping-82822.mp3",
  gunshot: "assets/audio/animations/multiplier/gun-shots-from-a-distance-5-96388.mp3",
  // Kassen-"Ka-ching" beim Aufladen (dieselbe, aktive Karte erneut aufgelegt).
  // Name = Media-Event aus socket.js (onCardEvent -> playSound("card_topup")).
  card_topup: "assets/audio/game/modestas123123-cash-register-kaching-sound-effect-125042.mp3",
  // Tada beim Anmelden einer bekannten Karte (onCardEvent -> playSound("card_login")).
  card_login: "assets/audio/game/floraphonic-tada-military-1-183974.mp3",
  // Einsatz erhöht - socket.js spielt ihn pro Einsatzstufe höher ab.
  bet_up: "assets/audio/game/tithuh-level-up-0-523643.mp3",
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
  // Tonspur von mrcrabs_laugh.webm (Original in assets_originals/overlays).
  mrcrabs_laugh: "assets/audio/animations/lose/mrcrabs_laugh.mp3",
  // Erste 4s von why_so_seroius_audio.wav (Original in assets_originals/audio),
  // so lang wie die "fade"-Einblendung von jokijoki.png.
  why_so_serious: "assets/audio/animations/lose/why_so_serious.mp3",
  // Sek. 14-20 aus "the bouncing yaris of palmont city.mp4" (Original in
  // assets_originals/overlays), -5dB; läuft zu bouncing_yaris.webm (Sek. 0-6,
  // Auto per rembg/isnet-general-use freigestellt).
  bouncing_yaris: "assets/audio/animations/win/bouncing_yaris.mp3",
  // Tonspur von move_mf_meme.webm (Original in assets_originals/overlays).
  move_mf_meme: "assets/audio/animations/win/move_mf_meme.mp3",
  // Tonspur von simpson_meme.webm (Original in assets_originals/overlays).
  simpson_meme: "assets/audio/animations/win/simpson_meme.mp3",
  // ~4s, so lang wie die "fade"-Einblendung von jojo.jpg.
  jojo_leduledu: "assets/audio/animations/win/misc_jojo_leduledu.wav",
  // Sek. 31.23-35.23 aus "Blade x Into The Void" (Original in
  // assets_originals/audio): 2 Schläge Anlauf, Drop bei 0.8s, danach 8 Schläge
  // (150 BPM = 400ms/Schlag), 400ms Ausblenden - passt auf die "party"-Animation
  // (duration_ms 4000, beat_ms 400, fade_out_ms 400).
  into_the_void: "assets/audio/animations/jackpot/into_the_void.mp3",
  // Erste 4.2s von floraphonic-slot-machine-coin-payout-1-188227.mp3 (Original
  // in assets_originals/audio), letzte 400ms ausgeblendet - so lang wie die
  // "coin_rain_reveal"-Animation (reveal_delay 1800 + grow 500 + hold 1500 +
  // fade_out 400).
  coin_payout: "assets/audio/animations/jackpot/coin_payout.mp3",
  // ~13.8s, so lang wie die "fade"-Einblendung von montanablack.gif.
  monte_dance: "assets/audio/animations/jackpot/success_monte_dance.wav",
  // ~4.3s, so lang wie die rote Sieben der x7-Multiplikator-Animation.
  basti_sieben: "assets/audio/animations/multiplier/success_basti-sieben.wav",
  // ~2.07s, laute Phase 1.1-1.8s = Reveal der "chest_reveal"-Animation.
  fart_2: "assets/audio/animations/lose/fail_fart_2.wav",
  // Erste 4.5s von results/lose/fail_lobotomy.mp3, letzte 400ms ausgeblendet -
  // so lang wie die "lobotomy_zoom"-Animation (700 + 2x550 + 1600 + 300).
  lobotomy: "assets/audio/animations/lose/lobotomy.mp3",
  // Kopie von results/lose/fail_boom.mp3 - Knall liegt direkt am Anfang,
  // passend zu boom_delay_ms 0 der "vine_boom"-Animation.
  vine_boom: "assets/audio/animations/lose/vine_boom.mp3",
  // Erste 3.6s von results/lose/freesound_community-are-ya-lost-yet-haha-80165.mp3,
  // letzte 400ms ausgeblendet - so lang wie die "peek"-Animation.
  are_ya_lost: "assets/audio/animations/lose/are_ya_lost.mp3",
  // Kopie von results/jackpot/success_omg.mp3 (Einstieg der "deep_fried"-Animation).
  omg: "assets/audio/animations/jackpot/omg.mp3",
  // Kopie von results/lose/misc_lampe-frankreich.wav (1.6s, "drop_bounce" der Lampe).
  lampe_frankreich: "assets/audio/animations/lose/lampe_frankreich.wav",
  // Kopie von results/lose/fail_fahh.mp3 (~1.9s, "pop_scale" mit Domi-Bild).
  fahh: "assets/audio/animations/lose/fahh.mp3",
  // Kopie von results/lose/fail_klonk.mp3 (0.4s) - wird per delay_ms auf die
  // Landung des Steins ("drop_bounce") gelegt.
  klonk: "assets/audio/animations/lose/klonk.mp3",
  // Kopie von results/lose/fail_laugh-cat.mp3 (~3.6s, Truhe mit son_charlie.jpg).
  laugh_cat: "assets/audio/animations/lose/laugh_cat.mp3",
  // Erste 6s von results/jackpot/misc_don-pollo-salamalekum.mp3, letzte 400ms
  // ausgeblendet - so lang wie die "party"-Animation mit iltan-sumra.png.
  salamalekum: "assets/audio/animations/jackpot/salamalekum.mp3",
};

// Optionale Sounds für die Meme-Animationen aus meme_anims.js: Die Dateien
// sind (noch) nicht im Projekt - einfach unter genau diesem Pfad ablegen, dann
// spielen sie automatisch. Fehlt eine Datei, bleibt es ohne Warnung still.
const OPTIONAL_SOUND_FILES = {
  // "Roundabout"-Intro (Yes) bis zum Einfrieren - "to_be_continued".
  roundabout: "assets/audio/animations/lose/roundabout.mp3",
  // GTA-Sounds für "gta" (variant "wasted" bzw. "passed").
  gta_wasted: "assets/audio/animations/lose/gta_wasted.mp3",
  gta_passed: "assets/audio/animations/win/gta_passed.mp3",
  // Kampfmusik für "pokemon_battle".
  pokemon_battle: "assets/audio/animations/multiplier/pokemon_battle.mp3",
  // Auswurf-Sound für "among_us_eject".
  among_us_eject: "assets/audio/animations/lose/among_us_eject.mp3",
  // Stonks-Sound für "stonks" (direction "up").
  stonks: "assets/audio/animations/win/stonks.mp3",
};

// Per Web Audio erzeugte Sounds (kein Asset nötig): werden beim Start einmal
// offline gerendert und liegen danach wie normale Sounds in `buffers` - also
// per Name aus event_media_map.json abspielbar. durationS = Länge des Buffers.
const SYNTH_SOUNDS = {
  // "Dun - dun - DUUUN" (Dramatic Chipmunk), Schläge bei 0 / 0.45 / 0.9s -
  // passend zu step_ms 450 der "dramatic_zoom"-Animation.
  dramatic: { durationS: 3, render: renderDramatic },
  // Windows-artiger Fehler-Ton, pro Fenster der "error_spam"-Animation.
  win_error: { durationS: 0.6, render: renderWinError },
  // Tiefer Gong für den Urteils-Stempel der "pharaoh_verdict"-Animation.
  gong: { durationS: 3.5, render: renderGong },
  // Fingerschnipsen und Staub-Rauschen für "thanos_snap".
  snap: { durationS: 0.3, render: renderSnap },
  dust: { durationS: 2.6, render: renderDust },
  // Aufladen (0.7s) + Laser-Brummen (2s) für "laser_eyes".
  laser: { durationS: 3, render: renderLaser },
  // Röhren-Abschalten und Rauschen beim Wiedereinschalten für "crt_off".
  crt_off: { durationS: 0.7, render: renderCrtOff },
  tv_static: { durationS: 1, render: renderTvStatic },
  // Pokémon-Kampf: Treffer, K.O. und Textbox-Piepsen.
  poke_hit: { durationS: 0.4, render: renderPokeHit },
  poke_faint: { durationS: 1.2, render: renderPokeFaint },
  text_blip: { durationS: 0.06, render: renderTextBlip },
  // MLG-Montage: Hitmarker-Klick und Airhorn (3 Stöße).
  hitmarker: { durationS: 0.15, render: renderHitmarker },
  airhorn: { durationS: 1.6, render: renderAirhorn },
  // Jubel-Arpeggio, wenn das DVD-Logo genau die Ecke trifft.
  corner: { durationS: 1.4, render: renderCorner },
};

// Startversatz in Sekunden, um Stille am Dateianfang zu überspringen - der
// Ping hat ~0.31s Vorlauf und würde sonst hörbar nach dem Walzenstopp kommen.
// Der Schuss hat ~40ms Vorlauf vor dem Knall.
const SOUND_OFFSETS = {
  reel_stop: 0.3,
  gunshot: 0.035,
  // ~0.32s Stille vor dem ersten Klick des Hebels.
  lever: 0.3,
  // ~0.48s Stille vor dem Kassenklingeln.
  card_topup: 0.45,
};

// Lautstärke (0-1) pro Sound; der Schuss ist bis 0dB normalisiert und würde
// die anderen Sounds sonst übertönen.
const SOUND_VOLUMES = {
  gunshot: 0.6,
  case_cam: 0.7,
  // Bis 0dB normalisiert, wie der Schuss.
  bet_up: 0.6,
};

// Loop-Bereich (Sekunden) für Dauergeräusche. Die Spin-Datei tickt bis ~1.05s
// gleichmäßig (~107ms pro Tick) und wird danach langsamer - geloopt wird nur
// der gleichmäßige Teil, jeweils von Tick-Anfang zu Tick-Anfang.
const LOOP_REGIONS = {
  spin: { start: 0.168, end: 1.043 },
};

// Hintergrundmusik: wird per <audio>-Element gestreamt statt komplett dekodiert
// (spart auf dem Pi RAM) und über Web Audio in den Musik-Bus geleitet.
// Originale (WAV) liegen in assets_originals/audio/music; hier als OGG, weil
// das kleiner ist und lückenloser loopt als MP3.
const MUSIC_TRACKS = {
  merkur_loop: "assets/audio/music/merkur_loop.ogg",
  scooter: "assets/audio/music/scooter_move_your_ass.ogg",
  // Original (mp4 mit Video) in assets_originals/audio, hier nur die Tonspur.
  into_the_void: "assets/audio/music/into_the_void.ogg",
};

// Lautstärke (0-1) pro Musiktrack.
const MUSIC_VOLUMES = {
  merkur_loop: 0.4,
  scooter: 0.4,
  // ~14dB lauter gemastert als scooter (Mittel -8.5dB statt -22.4dB) - daher
  // leiser, damit die Playlist gleichmäßig laut bleibt.
  into_the_void: 0.08,
};

// Hintergrund-Playlist nach dem Ladebildschirm: Tracks laufen nacheinander
// und fangen danach wieder vorne an (leer = keine Musik).
const BACKGROUND_PLAYLIST = ["merkur_loop", "scooter", "into_the_void"];

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();
const buffers = new Map();
const activeLoops = new Map();

// Sound-Pools: Poolname -> Liste von Buffer-Namen (= Dateipfad). Kommen
// automatisch aus den Unterordnern von assets/audio/results (Backend-Route
// /audio/pools) - Datei in den Ordner legen genügt, kein Eintrag hier nötig.
const SOUND_POOLS_URL = "audio/pools";
const soundPools = new Map();

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

async function loadBuffer(name, url, { quiet = false } = {}) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    buffers.set(name, audioBuffer);
    return true;
  } catch (err) {
    if (!quiet) console.warn(`Sound "${name}" konnte nicht geladen werden (Asset fehlt?):`, err.message);
    return false;
  }
}

async function loadSoundPools() {
  let pools;
  try {
    const res = await fetch(SOUND_POOLS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pools = await res.json();
  } catch (err) {
    console.warn("Sound-Pools konnten nicht geladen werden:", err.message);
    return;
  }
  await Promise.all(
    Object.entries(pools).map(async ([pool, urls]) => {
      const loaded = await Promise.all(urls.map((url) => loadBuffer(url, url)));
      soundPools.set(pool, urls.filter((_, i) => loaded[i]));
    })
  );
}

export async function preloadSounds() {
  await Promise.all([
    ...Object.entries(SOUND_FILES).map(([name, url]) => loadBuffer(name, url)),
    ...Object.entries(OPTIONAL_SOUND_FILES).map(([name, url]) => loadBuffer(name, url, { quiet: true })),
    loadSoundPools(),
    renderSynthSounds(),
  ]);
}

// --- Synthetisierte Sounds (SYNTH_SOUNDS) --------------------------------

async function renderSynthSounds() {
  await Promise.all(
    Object.entries(SYNTH_SOUNDS).map(async ([name, { durationS, render }]) => {
      try {
        const ctx = new OfflineAudioContext(1, Math.ceil(durationS * audioCtx.sampleRate), audioCtx.sampleRate);
        render(ctx);
        buffers.set(name, await ctx.startRendering());
      } catch (err) {
        console.warn(`Synth-Sound "${name}" konnte nicht erzeugt werden:`, err.message);
      }
    })
  );
}

// Ein Akkord (mehrere Oszillatoren) mit Hüllkurve durch einen Tiefpass.
// release = Ausklingzeit am Ende, vibrato = Tonhöhenschwankung (Anteil der
// Frequenz), bend = Faktor, auf den die Tonhöhe bis zum Ende gleitet (1 = fest).
function synthNote(ctx, { freqs, start, duration, type = "sawtooth", peak = 0.5, attack = 0.01, release = 0.3, cutoff = 1800, vibrato = 0, bend = 1 }) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  filter.connect(gain).connect(ctx.destination);
  applyEnvelope(gain.gain, { start, duration, level: peak / freqs.length, attack, release });
  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, start + duration);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.value = freq * vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + duration);
    }
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + duration);
  });
}

// Hüllkurve: linear auf `level` einschwingen, halten, am Ende exponentiell ausklingen.
function applyEnvelope(param, { start, duration, level, attack, release }) {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(level, start + attack);
  param.setValueAtTime(level, Math.max(start + attack, start + duration - release));
  param.exponentialRampToValueAtTime(0.0001, start + duration);
}

// Gefiltertes weißes Rauschen; freqEnd lässt die Filterfrequenz gleiten.
function synthNoise(ctx, { start, duration, peak = 0.3, attack = 0.005, release = 0.1, filter = "bandpass", freq = 1000, freqEnd = freq, q = 1 }) {
  const noise = ctx.createBuffer(1, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  biquad.frequency.setValueAtTime(freq, start);
  if (freqEnd !== freq) biquad.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
  const gain = ctx.createGain();
  applyEnvelope(gain.gain, { start, duration, level: peak, attack, release });
  source.connect(biquad).connect(gain).connect(ctx.destination);
  source.start(start);
}

function renderSnap(ctx) {
  synthNoise(ctx, { start: 0, duration: 0.12, peak: 0.9, release: 0.1, filter: "highpass", freq: 1800 });
  synthNote(ctx, { freqs: [2400], start: 0, duration: 0.05, type: "sine", peak: 0.4, attack: 0.001, release: 0.045, cutoff: 8000 });
}

// Anschwellendes, absinkendes Rieseln.
function renderDust(ctx) {
  synthNoise(ctx, { start: 0, duration: 2.5, peak: 0.22, attack: 0.8, release: 1.5, freq: 3000, freqEnd: 400, q: 0.8 });
}

function renderLaser(ctx) {
  synthNote(ctx, { freqs: [200], start: 0, duration: 0.75, type: "sine", peak: 0.35, attack: 0.7, release: 0.05, cutoff: 8000, bend: 6 });
  synthNote(ctx, { freqs: [110, 220, 331], start: 0.7, duration: 2.2, type: "sawtooth", peak: 0.55, attack: 0.02, release: 0.4, cutoff: 2400, vibrato: 0.03 });
  synthNoise(ctx, { start: 0.7, duration: 2.2, peak: 0.15, release: 0.4, freq: 2500, q: 2 });
}

function renderCrtOff(ctx) {
  synthNoise(ctx, { start: 0, duration: 0.05, peak: 0.6, release: 0.04, filter: "lowpass", freq: 3000 });
  synthNote(ctx, { freqs: [7000], start: 0, duration: 0.6, type: "sine", peak: 0.08, attack: 0.01, release: 0.5, cutoff: 12000, bend: 0.03 });
}

function renderTvStatic(ctx) {
  synthNoise(ctx, { start: 0, duration: 0.95, peak: 0.28, attack: 0.01, release: 0.4, filter: "lowpass", freq: 6000 });
}

function renderPokeHit(ctx) {
  synthNoise(ctx, { start: 0, duration: 0.2, peak: 0.6, release: 0.18, filter: "lowpass", freq: 2500 });
  synthNote(ctx, { freqs: [140], start: 0, duration: 0.35, type: "square", peak: 0.35, attack: 0.002, release: 0.3, cutoff: 3000, bend: 0.4 });
}

function renderPokeFaint(ctx) {
  synthNote(ctx, { freqs: [900], start: 0, duration: 1.1, type: "square", peak: 0.25, attack: 0.01, release: 0.3, cutoff: 4000, bend: 0.1 });
}

function renderTextBlip(ctx) {
  synthNote(ctx, { freqs: [1250], start: 0, duration: 0.05, type: "square", peak: 0.15, attack: 0.002, release: 0.02, cutoff: 5000 });
}

function renderHitmarker(ctx) {
  synthNoise(ctx, { start: 0, duration: 0.06, peak: 0.7, release: 0.05, filter: "highpass", freq: 3500 });
  synthNote(ctx, { freqs: [3200], start: 0, duration: 0.08, type: "triangle", peak: 0.35, attack: 0.001, release: 0.07, cutoff: 10000 });
}

// Zwei kurze und ein langer Stoß, leicht nach oben gezogen wie ein echtes Horn.
function renderAirhorn(ctx) {
  [
    [0, 0.17],
    [0.22, 0.17],
    [0.44, 1.1],
  ].forEach(([start, duration]) => {
    synthNote(ctx, { freqs: [415, 523, 622, 830], start, duration, type: "sawtooth", peak: 0.7, attack: 0.015, release: 0.08, cutoff: 3200, bend: 1.03 });
  });
}

function renderCorner(ctx) {
  [523.3, 659.3, 784, 1046.5].forEach((freq, i) => {
    synthNote(ctx, { freqs: [freq, freq * 2], start: i * 0.1, duration: 0.9 - i * 0.1, type: "triangle", peak: 0.4, attack: 0.005, release: 0.7 - i * 0.1, cutoff: 8000 });
  });
  synthNoise(ctx, { start: 0.35, duration: 1, peak: 0.08, attack: 0.05, release: 0.8, filter: "highpass", freq: 6000 });
}

// G - F# - Es (Moll, absteigend), der letzte Schlag lang mit Vibrato.
function renderDramatic(ctx) {
  synthNote(ctx, { freqs: [98, 196, 293.7, 392], start: 0, duration: 0.38, release: 0.12 });
  synthNote(ctx, { freqs: [92.5, 185, 277.2, 370], start: 0.45, duration: 0.38, release: 0.12 });
  synthNote(ctx, { freqs: [77.8, 155.6, 233.1, 311.1], start: 0.9, duration: 2.05, release: 1.2, vibrato: 0.012, peak: 0.6 });
}

// Zwei kurze, absteigende Glockentöne.
function renderWinError(ctx) {
  synthNote(ctx, { freqs: [659.3, 987.8], start: 0, duration: 0.3, type: "triangle", peak: 0.35, attack: 0.005, release: 0.28, cutoff: 6000 });
  synthNote(ctx, { freqs: [440, 659.3], start: 0.11, duration: 0.45, type: "triangle", peak: 0.35, attack: 0.005, release: 0.43, cutoff: 6000 });
}

// Unharmonische Sinus-Teiltöne mit langem Ausklang plus kurzem Rausch-Schlag.
function renderGong(ctx) {
  [1, 1.48, 2.02, 2.74, 3.76].forEach((ratio, i) => {
    synthNote(ctx, { freqs: [70 * ratio], start: 0, duration: 3.4 - i * 0.5, type: "sine", peak: 0.45 / (i + 1), attack: 0.01, release: 3.3 - i * 0.5, cutoff: 8000 });
  });
  const noise = ctx.createBuffer(1, Math.ceil(0.15 * ctx.sampleRate), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 400;
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  source.connect(band).connect(gain).connect(ctx.destination);
  source.start(0);
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
// volume (Faktor auf SOUND_VOLUMES), bus ("sfx" oder "music"), playbackRate
// (Abspielgeschwindigkeit - verschiebt auch die Tonhöhe, 2 = eine Oktave höher).
export function playSound(name, { delayMs = 0, volume = 1, bus = "sfx", playbackRate = 1 } = {}) {
  const buffer = buffers.get(name);
  if (!buffer) return null;
  resumeContext();
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
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
//   { "pool": "win" }                       - zufällige Datei aus
//                                             assets/audio/results/win/
//   [ ...obige Formen... ]                  - alle gleichzeitig (Layering)
// "delay_ms" und "volume" gelten bei "name" und "pool", "delay_ms" auch bei "pick".
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
  if (spec.pool) {
    const files = soundPools.get(spec.pool) ?? [];
    if (files.length === 0) return [];
    const choice = files[Math.floor(Math.random() * files.length)];
    const source = playSound(choice, { delayMs: ownDelay, volume: spec.volume ?? 1 });
    return source ? [source] : [];
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
// eventuell laufenden anderen Track dabei aus (Crossfade). Mit onEnded läuft
// der Track nur einmal durch und ruft danach onEnded auf (für die Playlist).
export function playMusic(name, { fadeMs = 1500, onEnded = null } = {}) {
  if (currentMusic?.name === name) return;
  const url = MUSIC_TRACKS[name];
  if (!url) {
    console.warn(`Unbekannter Musiktrack "${name}"`);
    return;
  }
  resumeContext();

  const el = new Audio(url);
  el.loop = !onEnded;
  if (onEnded) {
    el.addEventListener("ended", () => {
      // Nur reagieren, wenn der Track nicht inzwischen ersetzt/gestoppt wurde.
      if (currentMusic?.el === el) onEnded();
    });
  }
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

// Startet BACKGROUND_PLAYLIST - wird nach dem Ladebildschirm aufgerufen.
export function startBackgroundMusic() {
  if (BACKGROUND_PLAYLIST.length === 0) return;
  const playAt = (index, fadeMs) => {
    const name = BACKGROUND_PLAYLIST[index % BACKGROUND_PLAYLIST.length];
    // Bei nur einem Track wäre currentMusic.name gleich - playMusic würde
    // dann nichts tun, also vorher freigeben.
    if (currentMusic?.name === name) stopMusic(0);
    playMusic(name, { fadeMs, onEnded: () => playAt(index + 1, 300) });
  };
  playAt(0, 1500);
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
