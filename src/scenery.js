/* ============================================================
   Décor. Pour l'instant : le fond dégradé et la couleur de la
   lumière ambiante, qui dérivent tous deux avec la hauteur.

   Le fond est un dégradé CSS derrière un canvas transparent plutôt
   qu'un plan dans la scène : zéro draw call, zéro texture, et il
   couvre nativement les zones de safe area.

   Le four, la salle et les braises viendront ici même (§4).
   ============================================================ */

import * as C from './config.js';

const root = document.documentElement;
let lastLevel = -1;

function mix(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Interpolation de teinte par le chemin le plus court sur le cercle.
 * En interpolant bêtement de 20° (orange du four) à 236° (bleu nuit) on
 * traverse le vert : le fond virait à l'olive en milieu de partie. Par le
 * chemin court on passe par le rouge et le violet, ce qui donne une fin de
 * journée au lieu d'un marécage.
 */
function mixHue(a, b, t) {
  const delta = (((b - a) % 360) + 540) % 360 - 180;
  return (a + delta * t + 360) % 360;
}

function mixHsl(from, to, t) {
  const h = Math.round(mixHue(from.h, to.h, t));
  const s = Math.round(mix(from.s, to.s, t));
  const l = Math.round(mix(from.l, to.l, t));
  return `hsl(${h} ${s}% ${l}%)`;
}

/**
 * Fait progresser le fond de l'intérieur chaud vers le ciel nocturne.
 * Appelé à chaque pose seulement, pas à chaque frame : écrire une variable
 * CSS invalide le style du document.
 */
export function updateBackground(level) {
  if (level === lastLevel) return;
  lastLevel = level;

  const t = Math.min(level / C.BACKGROUND_LEVELS, 1);
  root.style.setProperty('--bg-top', mixHsl(C.BG_TOP_START, C.BG_TOP_END, t));
  root.style.setProperty(
    '--bg-bottom',
    mixHsl(C.BG_BOTTOM_START, C.BG_BOTTOM_END, t)
  );

  const glow = mix(C.BG_GLOW_ALPHA_START, C.BG_GLOW_ALPHA_END, t);
  root.style.setProperty(
    '--glow',
    `hsl(${C.BG_GLOW.h} ${C.BG_GLOW.s}% ${C.BG_GLOW.l}% / ${glow.toFixed(3)})`
  );
}

/** Couleur du ciel au niveau donné : chaude en bas, bleu nuit en haut. */
export function skyColor(level, target) {
  const t = Math.min(level / C.BACKGROUND_LEVELS, 1);
  return target.setHSL(
    mixHue(C.HEMI_SKY_START.h, C.HEMI_SKY_END.h, t) / 360,
    mix(C.HEMI_SKY_START.s, C.HEMI_SKY_END.s, t),
    mix(C.HEMI_SKY_START.l, C.HEMI_SKY_END.l, t)
  );
}

export function reset() {
  lastLevel = -1;
  updateBackground(0);
}
