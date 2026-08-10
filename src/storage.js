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
  bestStreak: 0,
  account: null, // { pseudo, email, consents, createdAt, synced }
  badges: [], // identifiants des badges débloqués
  claimed: [], // paliers déjà récompensés : { boxes, code, date }
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
export function submitScore(score, streak = 0) {
  state.games += 1;
  const record = score > state.best;
  if (record) state.best = score;
  if (streak > state.bestStreak) state.bestStreak = streak;
  persist();
  return record;
}

/** Ajoute des badges et renvoie ceux qui viennent réellement d'être obtenus. */
export function unlockBadges(ids) {
  const fresh = ids.filter((id) => !state.badges.includes(id));
  if (fresh.length) {
    state.badges = state.badges.concat(fresh);
    persist();
  }
  return fresh;
}

export function addClaim(claim) {
  state.claimed = state.claimed.concat(claim);
  persist();
}

/** Efface tout, y compris le compte : sert au droit à l'effacement (RGPD). */
export function wipe() {
  state = { ...DEFAULTS, badges: [], claimed: [] };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* rien à faire */
  }
}
