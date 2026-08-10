/* ============================================================
   Audio, entièrement synthétisé à la Web Audio API. Aucun fichier
   son : le jeu ne charge pas un octet pour sonner.

   Deux contraintes structurantes :

   - L'AudioContext est créé au PREMIER TAP, jamais au chargement.
     iOS refuse tout contexte audio créé hors d'un geste utilisateur,
     et un contexte créé trop tôt reste « suspended » à vie.

   - Le son démarre COUPÉ. On est dans une salle de restaurant : un jeu
     qui hurle depuis la table d'à côté est un problème commercial avant
     d'être un problème technique. Le HUD invite à l'activer.
   ============================================================ */

import * as C from './config.js';

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = true;

const Ctor =
  typeof window !== 'undefined'
    ? window.AudioContext || window.webkitAudioContext
    : null;

export function isSupported() {
  return Boolean(Ctor);
}

export function isMuted() {
  return muted;
}

export function isRunning() {
  return Boolean(ctx) && ctx.state === 'running';
}

/** Bruit blanc d'une seconde, généré une fois et rejoué à volonté. */
function makeNoise() {
  const length = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * À appeler DANS un gestionnaire de geste utilisateur — c'est la seule
 * fenêtre où iOS accepte de démarrer l'audio.
 */
export function unlock() {
  if (!Ctor) return;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : C.AUDIO_MASTER_GAIN;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(value) {
  muted = Boolean(value);
  if (!ctx) return;
  // Rampe très courte plutôt qu'un saut : couper net un gain produit un clic.
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(muted ? 0 : C.AUDIO_MASTER_GAIN, now + 0.02);
  if (!muted && ctx.state === 'suspended') ctx.resume();
}

/** Rien à jouer si le contexte n'existe pas ou si on est coupé. */
function ready() {
  return Boolean(ctx) && !muted;
}

function envelope(gain, peak, attack, release, start) {
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
}

function noiseBurst({ start, duration, gain, type, cutoff }) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = cutoff;
  const amp = ctx.createGain();
  envelope(amp, gain, 0.004, duration, start);
  source.connect(filter).connect(amp).connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

/* --- Les quatre sons du jeu ---------------------------------- */

/** Pose normale : un thud mat. */
export function place() {
  if (!ready()) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(C.THUD_FREQ, t);
  osc.frequency.exponentialRampToValueAtTime(C.THUD_FREQ_END, t + C.THUD_DURATION);
  const amp = ctx.createGain();
  envelope(amp, C.THUD_GAIN, 0.004, C.THUD_DURATION, t);
  osc.connect(amp).connect(master);
  osc.start(t);
  osc.stop(t + C.THUD_DURATION + 0.05);

  noiseBurst({
    start: t,
    duration: C.THUD_DURATION,
    gain: C.THUD_NOISE_GAIN,
    type: 'lowpass',
    cutoff: C.THUD_NOISE_CUTOFF,
  });
}

/** Découpe : un froissement bref. */
export function cut() {
  if (!ready()) return;
  noiseBurst({
    start: ctx.currentTime,
    duration: C.CUT_DURATION,
    gain: C.CUT_GAIN,
    type: 'highpass',
    cutoff: C.CUT_CUTOFF,
  });
}

/**
 * Perfect : une note qui monte d'un demi-ton à chaque perfect consécutif.
 * `streak` commence à 1.
 */
export function perfect(streak) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const semitone = (Math.max(1, streak) - 1) % C.PERFECT_SEMITONE_CAP;
  const freq = C.PERFECT_BASE_FREQ * Math.pow(2, semitone / 12);

  for (const [multiple, gain] of [
    [1, C.PERFECT_GAIN],
    [2, C.PERFECT_HARMONIC_GAIN],
  ]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * multiple, t);
    const amp = ctx.createGain();
    envelope(amp, gain, C.PERFECT_ATTACK, C.PERFECT_DECAY, t);
    osc.connect(amp).connect(master);
    osc.start(t);
    osc.stop(t + C.PERFECT_ATTACK + C.PERFECT_DECAY + 0.05);
  }
}

/** Game over : glissando descendant. */
export function gameOver() {
  if (!ready()) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(C.GAMEOVER_FREQ_START, t);
  osc.frequency.exponentialRampToValueAtTime(
    C.GAMEOVER_FREQ_END,
    t + C.GAMEOVER_DURATION
  );

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(C.GAMEOVER_GAIN, t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + C.GAMEOVER_DURATION);

  osc.connect(amp).connect(master);
  osc.start(t);
  osc.stop(t + C.GAMEOVER_DURATION + 0.05);
}

/** Coupe tout son en cours, par exemple quand l'onglet passe en arrière-plan. */
export function suspend() {
  if (ctx && ctx.state === 'running') ctx.suspend();
}

export function resume() {
  if (ctx && ctx.state === 'suspended' && !muted) ctx.resume();
}
