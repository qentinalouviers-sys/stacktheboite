/* ============================================================
   Retour haptique. Enveloppe navigator.vibrate avec détection de
   support et un no-op silencieux sinon.

   À SAVOIR : navigator.vibrate n'existe pas sur Safari iOS, et Apple
   n'expose aucune alternative au web. Environ la moitié des clients
   n'aura donc AUCUNE vibration, et ce n'est pas contournable de façon
   fiable. Le retour visuel doit rester auto-suffisant : aucune mécanique
   ne doit s'appuyer sur l'haptique.
   ============================================================ */

import * as C from './config.js';

const supported =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled = true;

export function isSupported() {
  return supported;
}

export function setEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) fire(0); // coupe une vibration en cours
}

export function isEnabled() {
  return enabled;
}

function fire(pattern) {
  if (!supported || (!enabled && pattern !== 0)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* certains navigateurs lèvent si le document n'a pas encore été touché */
  }
}

export function place() {
  fire(C.HAPTIC_PLACE);
}

export function perfect(streak) {
  fire(
    streak >= C.PERFECT_STREAK_INTENSE
      ? C.HAPTIC_PERFECT_STREAK
      : C.HAPTIC_PERFECT
  );
}

export function gameOver() {
  fire(C.HAPTIC_GAME_OVER);
}
