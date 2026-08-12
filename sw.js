/* ============================================================
   Service worker : le jeu tourne hors ligne après le premier
   chargement.

   Le principe : le déploiement tamponne une empreinte de version
   (?v=<sha>) sur toutes les URL internes ET dans VERSION ci-dessous.
   Le worker connaît donc l'empreinte du jour, il peut reconstruire
   seul la liste exacte de ce qu'il doit mettre en cache. Il n'attend
   rien de la page pour être prêt.

   Deux stratégies de service, et le choix n'est pas cosmétique :

   - Les DOCUMENTS (index.html, legal.html) passent par le réseau
     d'abord. Ils ne portent pas d'empreinte de version dans leur URL :
     s'ils étaient servis depuis le cache en priorité, une mise en ligne
     ne serait jamais vue. Hors ligne, on retombe sur le cache.

   - Tout le RESTE (modules, styles, Three.js) passe par le cache
     d'abord. Ces URL portent l'empreinte, donc une entrée en cache ne
     peut pas être périmée : une nouvelle version a forcément une
     nouvelle URL.

   Deux règles rendent le hors-ligne fiable plutôt que probable :

   1. L'installation est ATOMIQUE (addAll). Si un seul fichier
      essentiel manque à l'appel, l'installation entière échoue, la
      version précédente reste active avec son cache intact. On ne
      remplace jamais une version qui marche par une version à trous.

   2. Le cache précédent n'est purgé qu'à l'activation, donc seulement
      après une installation réussie. Et si malgré tout une requête
      tombe à côté hors ligne, on ressert la même ressource dans une
      autre version plutôt que de laisser le jeu mourir.
   ============================================================ */

const VERSION = '__BUILD__';
const CACHE = `qentina-stack-${VERSION}`;

// En local, les fichiers sont servis tels quels : le déploiement n'est pas
// passé, il n'y a pas d'empreinte à coller sur les URL.
//
// On reconnaît le gabarit non remplacé à ses tirets bas de tête, et surtout
// PAS en le réécrivant en toutes lettres ici : le déploiement remplace le
// motif partout où il l'écrit, il retournerait cette comparaison contre
// elle-même et le worker mettrait en cache des URL sans empreinte, que la
// page ne demande jamais.
const STAMPED = !VERSION.startsWith('__');
const stamp = (path) => (STAMPED ? `${path}?v=${VERSION}` : path);

// Tous les modules de src/. Cette liste doit rester exacte : le workflow de
// déploiement la compare au contenu réel de src/ et refuse de publier en cas
// d'écart, parce qu'un oubli ici rendrait le jeu injouable hors ligne.
const MODULES = [
  'main', 'config', 'game', 'boxes', 'textures', 'effects', 'scenery',
  'haptics', 'audio', 'ui', 'storage', 'account', 'rewards', 'share',
];

// L'essentiel : sans un seul de ces fichiers, le jeu ne démarre pas.
// Mis en cache en bloc, tout ou rien.
const CRITICAL = [
  './',
  './index.html',
  stamp('./styles.css'),
  stamp('./vendor/three.module.min.js'),
  ...MODULES.map((name) => stamp(`./src/${name}.js`)),
];

// Le confort : le jeu tourne sans, mais leur absence se voit. legal.html est
// le lien des conditions dans le formulaire d'inscription — sans lui, hors
// ligne, ce lien ouvrait le jeu à la place des CGU.
const OPTIONAL = ['./legal.html', './manifest.webmanifest', './icon.svg'];

/* --- Installation -------------------------------------------- */

async function precache() {
  const cache = await caches.open(CACHE);
  // addAll rejette en bloc si une seule requête échoue, et n'écrit alors rien.
  // C'est exactement le comportement voulu (règle 1 ci-dessus).
  await cache.addAll(CRITICAL);
  // Le reste au mieux : un échec ici ne doit pas condamner l'installation.
  await Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => null)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

/* --- Activation ---------------------------------------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // On n'arrive ici qu'après une installation réussie : le nouveau cache
      // est complet, purger les anciens ne peut plus laisser le joueur à sec.
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();

      // La page peut enfin annoncer au joueur qu'il est libre de couper le
      // réseau. On ne le dit qu'une fois le cache réellement rempli.
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'offline-ready', version: VERSION });
      }
    })()
  );
});

/* --- Stratégies ---------------------------------------------- */

const OFFLINE_RESPONSE = () =>
  new Response('Hors ligne', { status: 503, statusText: 'Hors ligne' });

/* Toutes les lectures passent par LE cache de cette version, jamais par
   caches.match() global. Ce dernier balaie tous les caches du domaine, y
   compris ceux que l'activation est en train de supprimer, et il pourrait
   ressortir un fichier d'une version périmée. Ici on sait exactement dans
   quoi on cherche. */

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    // Le document exact d'abord : c'est ce qui fait que legal.html hors ligne
    // sert bien les conditions, et non le jeu.
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Une navigation vers une page jamais visitée : on sert le jeu.
    return (await cache.match('./index.html')) || OFFLINE_RESPONSE();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Hors ligne et rien à cette URL exacte : le même fichier est peut-être
    // là sans son empreinte, déposé par le filet tendu depuis la page. Un
    // module servi vaut infiniment mieux qu'un écran noir.
    const stale = await cache.match(request, { ignoreSearch: true });
    return stale || OFFLINE_RESPONSE();
  }
}

/* --- Recollement des trous ----------------------------------- */

/**
 * Remet en cache ce qui aurait disparu. Les navigateurs évincent des entrées
 * sous la pression du stockage — iOS ne s'en prive pas — et l'installation ne
 * rejoue pas tant que sw.js n'a pas changé. Sans ce rattrapage, un fichier
 * évincé manquerait jusqu'au prochain déploiement, et le jeu mourrait à la
 * première coupure de réseau.
 */
async function heal() {
  const cache = await caches.open(CACHE);
  const wanted = [...CRITICAL, ...OPTIONAL];
  const present = await Promise.all(wanted.map((url) => cache.match(url)));
  const missing = wanted.filter((_, i) => !present[i]);
  if (!missing.length) return;
  await Promise.all(missing.map((url) => cache.add(url).catch(() => null)));
}

/* --- Filet de rattrapage tendu par la page ------------------- */

/**
 * La page nous liste ce qu'elle vient réellement de charger. L'installation
 * suffit normalement, mais ce filet rattrape ce que la liste ci-dessus ne
 * prévoit pas : un fichier ajouté sans mise à jour de MODULES, ou une toute
 * première visite dont l'installation a échoué.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'verify') {
    event.waitUntil(heal());
    return;
  }

  if (data.type !== 'precache' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls.map((url) =>
          cache.match(url).then((hit) => (hit ? null : cache.add(url).catch(() => null)))
        )
      )
    )
  );
});

/* --- Routage ------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // rien d'externe à gérer

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
