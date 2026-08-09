/* ============================================================
   HUD DOM et écrans. Aucune logique de jeu ici.
   ============================================================ */

const el = {
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  perfect: document.getElementById('perfect'),
  start: document.getElementById('start'),
  end: document.getElementById('end'),
  endScore: document.getElementById('end-score'),
  endBest: document.getElementById('end-best'),
  endRecord: document.getElementById('end-record'),
  debug: document.getElementById('debug'),
};

export function setScore(n) {
  el.score.textContent = String(n);
}

export function setBest(n) {
  el.best.textContent = `MEILLEUR ${n}`;
}

export function showPerfect(streak) {
  el.perfect.textContent = streak > 1 ? `PERFECT ×${streak}` : 'PERFECT';
  // Relance l'animation CSS même si la précédente n'est pas terminée.
  el.perfect.classList.remove('pop');
  void el.perfect.offsetWidth;
  el.perfect.classList.add('pop');
}

export function hideStart() {
  el.start.classList.add('hidden');
}

export function showStart() {
  el.start.classList.remove('hidden');
}

export function showEnd(score, best, isRecord) {
  el.endScore.textContent = String(score);
  el.endBest.textContent = `MEILLEUR ${best}`;
  el.endRecord.classList.toggle('hidden', !isRecord);
  el.end.classList.remove('hidden');
}

export function hideEnd() {
  el.end.classList.add('hidden');
}

export function setDebug(text) {
  if (el.debug) el.debug.textContent = text;
}
