/* ============================================================
   Persistance locale. Rien ne quitte le téléphone (§8).
   localStorage peut lever en navigation privée : tout est gardé.
   ============================================================ */

import { STORAGE_KEY } from './config.js';

const DEFAULTS = {
  best: 0,
  games: 0,
  muted: true, // le son démarre coupé : on est dans une salle de restaurant
  haptics: true,
};

let state = { ...DEFAULTS };

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* navigation privée ou quota : on continue en mémoire */
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    state = { ...DEFAULTS };
  }
  return state;
}

export function get(key) {
  return state[key];
}

export function set(key, value) {
  state[key] = value;
  persist();
}

/** Renvoie true si c'est un nouveau record. */
export function submitScore(score) {
  state.games += 1;
  const record = score > state.best;
  if (record) state.best = score;
  persist();
  return record;
}
