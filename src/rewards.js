/* ============================================================
   Paliers de récompense et badges.

   AVERTISSEMENT, à lire avant de mettre ça en caisse : le code est
   généré côté client. Il est trivialement falsifiable — n'importe qui
   sachant ouvrir la console peut en fabriquer un. Traite-le comme un
   geste commercial, pas comme un bon de réduction sérieux.

   Pour du sécurisé il faut un endpoint qui signe le code côté serveur
   (Cloudflare Worker + KV). Tout passe par claimReward() ci-dessous,
   isolée exprès pour être remplacée sans toucher au reste.
   ============================================================ */

import * as C from './config.js?v=4af5982';
import * as Storage from './storage.js?v=4af5982';

/** Palier atteint avec ce score, ou null. */
export function tierFor(score) {
  let reached = null;
  for (const tier of C.REWARD_TIERS) {
    if (score >= tier.boxes) reached = tier;
  }
  return reached;
}

/** Prochain palier à viser, ou null si tout est atteint. */
export function nextTier(score) {
  return C.REWARD_TIERS.find((tier) => score < tier.boxes) || null;
}

/** Avancement vers le prochain palier, de 0 à 1. */
export function progressToNext(score) {
  const next = nextTier(score);
  if (!next) return 1;
  const previous = [...C.REWARD_TIERS]
    .reverse()
    .find((tier) => score >= tier.boxes);
  const floor = previous ? previous.boxes : 0;
  return Math.min(1, Math.max(0, (score - floor) / (next.boxes - floor)));
}

/** Suffixe lisible, sans caractères ambigus (ni O/0 ni I/1). */
function readableCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Code déjà obtenu pour ce palier, ou null. Ne génère rien. */
export function existingClaim(tier) {
  if (!tier) return null;
  return Storage.get('claimed').find((c) => c.boxes === tier.boxes) || null;
}

/**
 * Point d'accroche unique pour la sécurisation future. Aujourd'hui : génère
 * un code local. Demain : appelle un endpoint qui renvoie un code signé.
 *
 * N'est appelée QUE pour un joueur inscrit : le cadeau est annoncé à tout le
 * monde, mais le code ne se génère qu'une fois le profil créé.
 */
export function claimReward(tier) {
  const already = existingClaim(tier);
  if (already) return already;

  const claim = {
    boxes: tier.boxes,
    label: tier.label,
    code: `${C.REWARD_PREFIX}-${tier.boxes}-${readableCode(4)}`,
    date: new Date().toISOString().slice(0, 10),
  };
  Storage.addClaim(claim);
  return claim;
}

/** Badges méritant d'être débloqués au vu de la partie qui vient de finir. */
export function earnedBadges({ score, streak, games, best }) {
  const ids = [];
  if (score >= 10) ids.push('premiere-tour');
  if (streak >= C.PERFECT_STREAK_INTENSE) ids.push('belle-serie');
  if (streak >= 10) ids.push('main-sure');
  if (score >= C.BURN_START_LEVEL) ids.push('carton-roussi');
  if (score >= C.BURN_FULL_LEVEL) ids.push('carton-calcine');
  if (games >= 10) ids.push('habitue');
  if (best >= 50) ids.push('maison');
  return ids;
}

export function badgeById(id) {
  return C.BADGES.find((badge) => badge.id === id);
}
