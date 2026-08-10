/* ============================================================
   Compte joueur : pseudo, e-mail, consentements.

   ÉTAT ACTUEL : le jeu est un site statique, il n'y a pas de serveur.
   Tant que C.ACCOUNT_ENDPOINT est vide, RIEN ne quitte le téléphone —
   ni le pseudo, ni l'e-mail, ni le score. Le profil est écrit dans le
   localStorage de l'appareil et rien d'autre.

   Toute la communication réseau passe par les deux fonctions marquées
   « point d'accroche serveur » plus bas. Le jour où un endpoint existe,
   il suffit de renseigner C.ACCOUNT_ENDPOINT : le reste du jeu n'a pas
   une ligne à changer.
   ============================================================ */

import * as C from './config.js';
import * as Storage from './storage.js';

/* --- Validation --------------------------------------------- */

export function validate({ pseudo, email, terms, marketing }) {
  const errors = {};

  const name = (pseudo || '').trim();
  if (!name) errors.pseudo = 'Choisis un pseudo.';
  else if (name.length < C.PSEUDO_MIN)
    errors.pseudo = `Au moins ${C.PSEUDO_MIN} caractères.`;
  else if (name.length > C.PSEUDO_MAX)
    errors.pseudo = `${C.PSEUDO_MAX} caractères maximum.`;
  else if (!C.PSEUDO_PATTERN.test(name))
    errors.pseudo = 'Lettres, chiffres, espace, tiret ou point uniquement.';

  const mail = (email || '').trim().toLowerCase();
  if (!mail) errors.email = 'Indique ton adresse e-mail.';
  else if (!C.EMAIL_PATTERN.test(mail))
    errors.email = 'Cette adresse ne semble pas valide.';

  if (!terms)
    errors.terms = 'Il faut accepter les conditions pour créer un profil.';
  if (C.MARKETING_CONSENT_REQUIRED && !marketing)
    errors.marketing = 'Cette autorisation est nécessaire pour continuer.';

  return { valid: Object.keys(errors).length === 0, errors, name, mail };
}

/* --- Lecture ------------------------------------------------- */

export function current() {
  return Storage.get('account');
}

export function isSignedIn() {
  return Boolean(current());
}

/* --- Point d'accroche serveur -------------------------------- */

/**
 * Envoie un objet au serveur si un endpoint est configuré. Renvoie l'état de
 * synchronisation, jamais une exception : une panne réseau ne doit pas empêcher
 * de jouer ni de garder son score en local.
 */
async function post(path, body) {
  if (!C.ACCOUNT_ENDPOINT) return { synced: false, reason: 'no-endpoint' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.ACCOUNT_TIMEOUT_MS);
  try {
    const response = await fetch(`${C.ACCOUNT_ENDPOINT}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return { synced: false, reason: `http-${response.status}` };
    return { synced: true, data: await response.json().catch(() => null) };
  } catch (error) {
    return { synced: false, reason: error.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/* --- Écriture ------------------------------------------------ */

/**
 * Crée le profil localement, puis tente de le synchroniser. Le profil est
 * enregistré AVANT l'appel réseau : le joueur ne doit jamais perdre son
 * inscription parce que le wifi du restaurant a hoqueté.
 */
export async function register(form, best) {
  const { valid, errors, name, mail } = validate(form);
  if (!valid) return { ok: false, errors };

  const account = {
    pseudo: name,
    email: mail,
    consents: {
      // Horodatés : en cas de contrôle, il faut pouvoir prouver QUAND et à
      // QUELLE version des conditions le consentement a été donné.
      terms: { given: true, at: new Date().toISOString(), version: C.LEGAL_VERSION },
      marketing: {
        given: Boolean(form.marketing),
        at: new Date().toISOString(),
        version: C.LEGAL_VERSION,
      },
    },
    createdAt: new Date().toISOString(),
    synced: false,
  };

  Storage.set('account', account);

  const result = await post('/register', {
    pseudo: account.pseudo,
    email: account.email,
    consents: account.consents,
    best,
  });
  if (result.synced) {
    Storage.set('account', { ...account, synced: true });
  }
  return { ok: true, account, sync: result };
}

/**
 * « Connexion ». Sans serveur, elle ne peut que retrouver le profil déjà
 * présent sur CET appareil — c'est une limite du site statique, pas un oubli.
 * Avec un endpoint, elle interroge le serveur.
 */
export async function signIn(email) {
  const mail = (email || '').trim().toLowerCase();
  if (!C.EMAIL_PATTERN.test(mail)) {
    return { ok: false, errors: { email: 'Cette adresse ne semble pas valide.' } };
  }

  const local = current();
  if (local && local.email === mail) return { ok: true, account: local };

  const result = await post('/signin', { email: mail });
  if (result.synced && result.data && result.data.pseudo) {
    const account = { ...result.data, email: mail, synced: true };
    Storage.set('account', account);
    return { ok: true, account };
  }

  return {
    ok: false,
    errors: {
      email: C.ACCOUNT_ENDPOINT
        ? 'Aucun profil trouvé pour cette adresse.'
        : "Aucun profil enregistré sur cet appareil. Crée-en un, c'est instantané.",
    },
  };
}

/** Enregistre un score sur le profil. Local d'abord, serveur ensuite. */
export async function saveScore(score, streak) {
  const account = current();
  if (!account) return { ok: false, reason: 'no-account' };

  const result = await post('/score', {
    email: account.email,
    pseudo: account.pseudo,
    score,
    streak,
  });
  return { ok: true, sync: result };
}

/** Droit à l'effacement : on efface tout, y compris le profil. */
export async function forget() {
  const account = current();
  if (account) await post('/forget', { email: account.email });
  Storage.wipe();
}
