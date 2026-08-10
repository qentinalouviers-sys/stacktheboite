/* ============================================================
   Service worker : le jeu tourne hors ligne après le premier
   chargement.

   Deux stratégies, et le choix n'est pas cosmétique :

   - Les DOCUMENTS (index.html, legal.html) passent par le réseau
     d'abord. Ils ne portent pas d'empreinte de version dans leur URL :
     s'ils étaient servis depuis le cache en priorité, une mise en ligne
     ne serait jamais vue. Hors ligne, on retombe sur le cache.

   - Tout le RESTE (modules, styles, Three.js) passe par le cache
     d'abord. Le déploiement tamponne une empreinte de version dans ces
     URL, donc une entrée en cache ne peut pas être périmée : une
     nouvelle version a forcément une nouvelle URL.

   Le cache est purgé à chaque changement de VERSION, remplacée au
   déploiement par le sha du commit.
   ============================================================ */

const VERSION = '4af5982';
const CACHE = `qentina-stack-${VERSION}`;

// Coquille minimale mise en cache dès l'installation, pour que le tout
// premier passage hors ligne fonctionne même si l'utilisateur n'a pas
// navigué partout.
const SHELL = ['./', './index.html', './styles.css', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll échoue en bloc si une seule requête échoue : on ajoute donc
      // pièce par pièce, une coquille incomplète valant mieux que rien.
      .then((cache) =>
        Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Une navigation vers une page jamais visitée : on sert le jeu.
    return (
      (await caches.match('./index.html')) ||
      new Response('Hors ligne', { status: 503, statusText: 'Hors ligne' })
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * La page nous dit ce qu'elle vient réellement de charger, et on le met en
 * cache. C'est ce qui rend le jeu jouable hors ligne dès le PREMIER
 * chargement : au tout premier passage, les modules ont été demandés avant
 * que ce worker ne soit actif, donc ils ne sont jamais passés par le fetch
 * ci-dessous. Les faire lister par la page évite aussi d'avoir à connaître
 * ici les empreintes de version que le déploiement colle dans les URL.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'precache' || !Array.isArray(data.urls)) return;
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
