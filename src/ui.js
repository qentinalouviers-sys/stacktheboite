/* ============================================================
   HUD DOM, écran de fin et feuille de compte.
   Aucune logique de jeu ici : ce module affiche et remonte des
   événements, il ne décide de rien.
   ============================================================ */

import * as C from './config.js';

const el = {
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  perfect: document.getElementById('perfect'),
  start: document.getElementById('start'),
  end: document.getElementById('end'),
  endScore: document.getElementById('end-score'),
  endBest: document.getElementById('end-best'),
  endRecord: document.getElementById('end-record'),
  endStatus: document.getElementById('end-status'),
  debug: document.getElementById('debug'),
  haptics: document.getElementById('haptics-toggle'),
  sound: document.getElementById('sound-toggle'),
  soundHint: document.getElementById('sound-hint'),

  tier: document.getElementById('tier'),
  tierLabel: document.getElementById('tier-label'),
  tierCount: document.getElementById('tier-count'),
  tierBar: document.getElementById('tier-bar'),
  reward: document.getElementById('reward'),
  rewardLabel: document.getElementById('reward-label'),
  rewardCode: document.getElementById('reward-code'),
  badges: document.getElementById('badges'),
  btnSave: document.getElementById('btn-save'),
  btnShare: document.getElementById('btn-share'),

  sheet: document.getElementById('sheet'),
  sheetClose: document.getElementById('sheet-close'),
  sheetTitle: document.getElementById('sheet-title'),
  tabSignup: document.getElementById('tab-signup'),
  tabSignin: document.getElementById('tab-signin'),
  form: document.getElementById('account-form'),
  fieldPseudo: document.getElementById('field-pseudo'),
  inPseudo: document.getElementById('in-pseudo'),
  inEmail: document.getElementById('in-email'),
  inTerms: document.getElementById('in-terms'),
  inMarketing: document.getElementById('in-marketing'),
  consents: document.getElementById('consents'),
  marketingText: document.getElementById('marketing-text'),
  btnSubmit: document.getElementById('btn-submit'),
  formStatus: document.getElementById('form-status'),
  btnForget: document.getElementById('btn-forget'),
  errors: {
    pseudo: document.getElementById('err-pseudo'),
    email: document.getElementById('err-email'),
    terms: document.getElementById('err-terms'),
    marketing: document.getElementById('err-marketing'),
  },
};

let sheetMode = 'signup';

/* --- HUD ----------------------------------------------------- */

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

export function setDebug(text) {
  if (el.debug) el.debug.textContent = text;
}

/**
 * Bascule générique du HUD. Le pointerdown est stoppé net : sans ça, le tap
 * sur le bouton poserait aussi une boîte, tout l'écran étant zone de tap.
 */
function setupToggle(node, { supported, enabled, onToggle, labels }) {
  if (!node) return () => {};
  if (!supported) {
    node.hidden = true;
    return () => {};
  }

  const render = (value) => {
    node.classList.toggle('off', !value);
    node.setAttribute('aria-pressed', String(value));
    node.setAttribute('aria-label', value ? labels.on : labels.off);
  };

  let current = enabled;
  render(current);

  node.addEventListener(
    'pointerdown',
    (event) => {
      event.stopPropagation();
      event.preventDefault();
      current = !current;
      render(current);
      onToggle(current);
    },
    { passive: false }
  );

  return render;
}

/**
 * Bouton vibration. Masqué si le navigateur ne sait pas vibrer (Safari iOS) :
 * un interrupteur qui ne commande rien est pire que pas d'interrupteur.
 */
export function setupHapticsToggle(options) {
  setupToggle(el.haptics, {
    ...options,
    labels: { on: 'Vibration activée', off: 'Vibration coupée' },
  });
}

/**
 * Bouton son. Le son démarre coupé — on est en salle — et la pastille
 * « Son coupé » signale qu'il existe. Elle disparaît au premier appui.
 */
export function setupSoundToggle(options) {
  setupToggle(el.sound, {
    ...options,
    labels: { on: 'Couper le son', off: 'Activer le son' },
    onToggle(value) {
      hideSoundHint();
      options.onToggle(value);
    },
  });
  if (!options.supported || options.enabled) hideSoundHint();
}

export function hideSoundHint() {
  if (el.soundHint) el.soundHint.classList.add('hidden');
}

/* --- Écran de fin -------------------------------------------- */

function renderTier({ score, nextTier, progress }) {
  if (!nextTier) {
    el.tier.classList.remove('hidden');
    el.tierLabel.textContent = 'TOUS LES PALIERS ATTEINTS';
    el.tierCount.textContent = '';
    el.tierBar.style.width = '100%';
    return;
  }
  el.tier.classList.remove('hidden');
  el.tierLabel.textContent = nextTier.label.toUpperCase();
  el.tierCount.textContent = `${score} / ${nextTier.boxes}`;
  // Reflow avant d'écrire la largeur, pour que la transition rejoue.
  el.tierBar.style.width = '0%';
  void el.tierBar.offsetWidth;
  el.tierBar.style.width = `${Math.round(progress * 100)}%`;
}

function renderReward(claim) {
  if (!claim) {
    el.reward.classList.add('hidden');
    return;
  }
  el.reward.classList.remove('hidden');
  el.rewardLabel.textContent = claim.label.toUpperCase();
  el.rewardCode.textContent = claim.code;
}

function renderBadges(earned, fresh) {
  el.badges.replaceChildren();
  for (const badge of C.BADGES) {
    const has = earned.includes(badge.id);
    const item = document.createElement('span');
    item.className = `badge${has ? ' is-earned' : ''}${
      fresh.includes(badge.id) ? ' is-new' : ''
    }`;
    item.title = badge.hint;
    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = badge.icon;
    const label = document.createElement('span');
    label.textContent = has ? badge.label : badge.hint;
    item.append(emoji, label);
    el.badges.append(item);
  }
}

export function showEnd(data) {
  el.endScore.textContent = String(data.score);
  el.endBest.textContent = `MEILLEUR ${data.best}`;
  el.endRecord.classList.toggle('hidden', !data.record);
  el.endStatus.textContent = '';

  renderTier(data);
  renderReward(data.claim);
  renderBadges(data.badges, data.freshBadges);

  el.btnSave.textContent = data.signedIn
    ? `Score enregistré · ${data.pseudo}`
    : 'Sauvegarder mon score';
  el.btnSave.disabled = Boolean(data.signedIn);

  el.end.classList.remove('hidden');
  document.body.classList.add('is-over');
  el.end.scrollTop = 0;
}

export function hideEnd() {
  el.end.classList.add('hidden');
  document.body.classList.remove('is-over');
  closeSheet();
}

export function setEndStatus(text) {
  el.endStatus.textContent = text || '';
}

/* --- Feuille de compte --------------------------------------- */

export function isBlocking() {
  return !el.sheet.classList.contains('hidden');
}

function setMode(mode) {
  sheetMode = mode;
  const signup = mode === 'signup';
  el.tabSignup.classList.toggle('is-active', signup);
  el.tabSignin.classList.toggle('is-active', !signup);
  el.tabSignup.setAttribute('aria-selected', String(signup));
  el.tabSignin.setAttribute('aria-selected', String(!signup));
  el.fieldPseudo.classList.toggle('hidden', !signup);
  el.consents.classList.toggle('hidden', !signup);
  el.btnSubmit.textContent = signup ? 'Créer mon profil' : 'Retrouver mon profil';
  el.sheetTitle.textContent = signup
    ? 'Sauvegarde ton score'
    : 'Retrouve ton profil';
  clearErrors();
  el.formStatus.textContent = '';
}

function clearErrors() {
  for (const [key, node] of Object.entries(el.errors)) {
    node.textContent = '';
    node.classList.remove('is-shown');
    if (key === 'pseudo') el.fieldPseudo.classList.remove('is-invalid');
    if (key === 'email') el.inEmail.parentElement.classList.remove('is-invalid');
  }
}

export function showErrors(errors) {
  clearErrors();
  for (const [key, message] of Object.entries(errors)) {
    const node = el.errors[key];
    if (!node) continue;
    node.textContent = message;
    node.classList.add('is-shown');
  }
  if (errors.pseudo) el.fieldPseudo.classList.add('is-invalid');
  if (errors.email) el.inEmail.parentElement.classList.add('is-invalid');
}

export function openSheet(mode = 'signup') {
  setMode(mode);
  el.sheet.classList.remove('hidden');
  el.btnForget.classList.toggle('hidden', !el.btnForget.dataset.enabled);
  // Le focus part sur le premier champ utile, sans forcer le clavier à
  // s'ouvrir avant que la feuille ait fini de monter.
  setTimeout(() => {
    (mode === 'signup' ? el.inPseudo : el.inEmail).focus({ preventScroll: true });
  }, 330);
}

export function closeSheet() {
  el.sheet.classList.add('hidden');
  el.formStatus.textContent = '';
}

export function setFormStatus(text) {
  el.formStatus.textContent = text || '';
}

export function setSubmitting(busy) {
  el.btnSubmit.disabled = busy;
  if (busy) el.formStatus.textContent = 'Un instant…';
}

export function showForgetButton(enabled) {
  el.btnForget.dataset.enabled = enabled ? '1' : '';
  el.btnForget.classList.toggle('hidden', !enabled);
}

/**
 * Câble tous les contrôles interactifs. Chacun stoppe la propagation du
 * pointerdown : sans ça, appuyer sur un bouton de l'écran de fin relancerait
 * aussi une partie, puisque tout l'écran est une zone de tap.
 */
export function setupAccount(handlers) {
  const stop = (event) => event.stopPropagation();
  for (const node of [el.sheet, el.btnSave, el.btnShare]) {
    node.addEventListener('pointerdown', stop);
  }

  if (!C.MARKETING_CONSENT_REQUIRED) {
    el.marketingText.textContent +=
      ' (facultatif, sans conséquence sur le jeu)';
  }

  el.btnSave.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onOpenSheet();
  });

  el.btnShare.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onShare();
  });

  el.sheetClose.addEventListener('click', (event) => {
    event.stopPropagation();
    closeSheet();
  });

  el.tabSignup.addEventListener('click', () => setMode('signup'));
  el.tabSignin.addEventListener('click', () => setMode('signin'));

  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = {
      pseudo: el.inPseudo.value,
      email: el.inEmail.value,
      terms: el.inTerms.checked,
      marketing: el.inMarketing.checked,
    };
    if (sheetMode === 'signup') handlers.onRegister(form);
    else handlers.onSignIn(form.email);
  });

  el.btnForget.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onForget();
  });

  // Échap ferme la feuille : attendu sur ordinateur, sans effet sur mobile.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isBlocking()) closeSheet();
  });
}
