/* ============================================================
   Boot, scène, boucle de rendu, orchestration.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js';
import { Game, State } from './game.js';
import { Stack, MovingBox, Fragments, burnFactor } from './boxes.js';
import { getAtlas, setAnisotropy } from './textures.js';
import { Effects } from './effects.js';
import * as Scenery from './scenery.js';
import * as Haptics from './haptics.js';
import * as Audio from './audio.js';
import * as UI from './ui.js';
import * as Storage from './storage.js';
import * as Account from './account.js';
import * as Rewards from './rewards.js';
import { share } from './share.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

/* --- Renderer & scène ------------------------------------- */

const canvas = document.getElementById('scene');
// alpha: true — le fond est un dégradé CSS sous le canvas, ça évite un plan
// de fond dans la scène et ça couvre les safe areas sans effort.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, C.MAX_PIXEL_RATIO));
renderer.setClearAlpha(0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, C.CAMERA_NEAR, C.CAMERA_FAR);
let frustumHeight = C.VIEW_HEIGHT_MIN;
let viewScale = 1; // 1 = jeu, monte jusqu'à GAMEOVER_ZOOM_OUT à la mort

// Facteur de projection de l'axe Y sur la verticale de l'écran, pour l'angle
// de caméra choisi. Sert à placer le sommet de la tour à une fraction d'écran
// précise ; recalculé ici pour rester juste si on change l'angle.
const cameraDir = new THREE.Vector3(
  C.CAMERA_OFFSET_X,
  C.CAMERA_OFFSET_Y,
  C.CAMERA_OFFSET_Z
).normalize();
const Y_SCREEN_FACTOR = Math.sqrt(1 - cameraDir.y * cameraDir.y);

const hemi = new THREE.HemisphereLight(0xffffff, C.HEMI_GROUND_COLOR, C.HEMI_INTENSITY);
Scenery.skyColor(0, hemi.color);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(C.KEY_LIGHT_COLOR, C.KEY_LIGHT_INTENSITY);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 40;
scene.add(keyLight);
scene.add(keyLight.target);

// La salle et le four. Le sol s'éteint en alpha vers ses bords, donc il ne
// masque pas le dégradé de fond comme le faisait le plan provisoire.
const scenery = Scenery.buildScenery(scene);

/* --- Objets de jeu ---------------------------------------- */

const stack = new Stack(scene);
const movingBox = new MovingBox(scene);
const fragments = new Fragments(scene);
const effects = new Effects(scene);

getAtlas();
setAnisotropy(renderer.capabilities.getMaxAnisotropy());

Storage.load();
UI.setBest(Storage.get('best'));

Audio.setMuted(Storage.get('muted'));
UI.setupSoundToggle({
  supported: Audio.isSupported(),
  enabled: !Storage.get('muted'),
  onToggle(value) {
    Audio.unlock(); // on est dans un geste utilisateur : seule fenêtre pour iOS
    Audio.setMuted(!value);
    Storage.set('muted', !value);
  },
});

Haptics.setEnabled(Storage.get('haptics'));
UI.setupHapticsToggle({
  supported: Haptics.isSupported(),
  enabled: Haptics.isEnabled(),
  onToggle(value) {
    Haptics.setEnabled(value);
    Storage.set('haptics', value);
  },
});

let camY = 0;
let snapCamera = true;

const game = new Game({
  onReset(baseBox) {
    stack.clear();
    fragments.clear();
    effects.clear();
    stack.add(baseBox, 0);
    viewScale = 1;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    snapCamera = true;
    Scenery.reset();
    Scenery.skyColor(0, hemi.color);
    UI.setScore(0);
    UI.hideEnd();
    UI.showStart();
  },

  onSpawn(box, level) {
    movingBox.spawn(box, level);
  },

  onStart() {
    UI.hideStart();
  },

  onPlace(placed, fragment, perfect, streak, level) {
    const mesh = stack.add(placed, level);
    movingBox.hide();
    if (fragment) fragments.spawn(fragment, level);
    effects.onPlace(mesh, placed, perfect, streak);
    effects.setSmokeSource(placed, burnFactor(level));

    if (perfect) {
      UI.showPerfect(streak);
      Haptics.perfect(streak);
      Audio.perfect(streak);
      scenery.flash(); // le four accuse le coup (§3)
    } else {
      Haptics.place();
      Audio.place();
      if (fragment) Audio.cut();
    }

    UI.setScore(level);
    Scenery.updateBackground(level);
    Scenery.skyColor(level, hemi.color);
  },

  onGameOver(lastBox, score) {
    movingBox.hide();
    fragments.spawn(lastBox, score + 1);
    Haptics.gameOver();
    Audio.gameOver();
  },

  onEndScreen(score, bestStreak) {
    const record = Storage.submitScore(score, bestStreak);
    UI.setBest(Storage.get('best'));

    lastScore = score;
    lastStreak = bestStreak;
    freshBadges = Storage.unlockBadges(
      Rewards.earnedBadges({
        score,
        streak: bestStreak,
        games: Storage.get('games'),
        best: Storage.get('best'),
      })
    );

    UI.showEnd(buildEndData({ record }));

    // Un joueur déjà inscrit n'a rien à faire : son score part tout seul.
    if (Account.isSignedIn()) Account.saveScore(score, bestStreak);
  },
});

/* --- Compte, récompenses, partage --------------------------- */

let lastScore = 0;
let lastStreak = 0;
let freshBadges = [];

/**
 * Assemble l'état de l'écran de fin. Le cadeau gagné est annoncé à tout le
 * monde, mais le CODE n'est généré que pour un joueur inscrit : c'est la
 * récompense qui donne la raison de créer un profil, pas l'inverse.
 */
function buildEndData({ record = false, justRevealed = false } = {}) {
  const account = Account.current();
  const tier = Rewards.tierFor(lastScore);
  const claim = tier
    ? account
      ? Rewards.claimReward(tier)
      : Rewards.existingClaim(tier)
    : null;

  return {
    score: lastScore,
    best: Storage.get('best'),
    record,
    reward: tier
      ? {
          boxes: tier.boxes,
          label: tier.label,
          code: claim ? claim.code : null,
          justRevealed,
        }
      : null,
    nextTier: Rewards.nextTier(lastScore),
    progress: Rewards.progressToNext(lastScore),
    badges: Storage.get('badges'),
    freshBadges,
    signedIn: Boolean(account),
    pseudo: account ? account.pseudo : '',
  };
}

/** Y a-t-il un cadeau gagné dont le code n'est pas encore débloqué ? */
function hasLockedReward() {
  const tier = Rewards.tierFor(lastScore);
  return Boolean(tier) && !Rewards.existingClaim(tier);
}

/** Réaffiche l'écran de fin après un changement d'état du compte. */
function refreshEnd(status) {
  freshBadges = []; // les badges ne doivent pas rejouer leur animation
  UI.showEnd(buildEndData({ justRevealed: true }));
  UI.setEndStatus(status);
}

UI.showForgetButton(Account.isSignedIn());

UI.setupAccount({
  onOpenSheet() {
    UI.setSheetReason(hasLockedReward() ? 'reward' : 'score');
    UI.openSheet(Account.isSignedIn() ? 'signin' : 'signup');
  },

  async onRegister(form) {
    UI.setSubmitting(true);
    const result = await Account.register(form, Storage.get('best'));
    UI.setSubmitting(false);
    if (!result.ok) {
      UI.showErrors(result.errors);
      UI.setFormStatus('');
      return;
    }
    await Account.saveScore(lastScore, lastStreak);
    UI.showForgetButton(true);
    UI.closeSheet();
    refreshEnd(
      hasLockedReward()
        ? `Voilà ton code, ${result.account.pseudo} !`
        : `Score enregistré. À bientôt, ${result.account.pseudo}.`
    );
  },

  async onSignIn(email) {
    UI.setSubmitting(true);
    const result = await Account.signIn(email);
    UI.setSubmitting(false);
    if (!result.ok) {
      UI.showErrors(result.errors);
      return;
    }
    await Account.saveScore(lastScore, lastStreak);
    UI.showForgetButton(true);
    UI.closeSheet();
    refreshEnd(`Content de te revoir, ${result.account.pseudo}.`);
  },

  async onForget() {
    await Account.forget();
    UI.showForgetButton(false);
    UI.closeSheet();
    UI.setBest(0);
    refreshEnd('Toutes tes données ont été effacées de cet appareil.');
  },

  async onShare() {
    const account = Account.current();
    UI.setEndStatus('Préparation du partage…');
    const result = await share({
      score: lastScore,
      pseudo: account ? account.pseudo : '',
      best: Storage.get('best'),
    });
    UI.setEndStatus(
      {
        shared: 'Merci du partage !',
        copied: 'Message copié dans le presse-papier.',
        downloaded: 'Image enregistrée.',
        cancelled: '',
        failed: 'Le partage a échoué, réessaie.',
      }[result] || ''
    );
  },
});


/* --- Entrée ------------------------------------------------ */

function onPointerDown(event) {
  // La feuille de compte est modale : tant qu'elle est ouverte, un tap ne
  // doit surtout pas relancer une partie derrière elle.
  if (UI.isBlocking()) return;
  event.preventDefault();
  // Créé ici et nulle part ailleurs : iOS n'autorise l'audio que dans un
  // geste utilisateur. Sans son, c'est un contexte muet qui ne coûte rien.
  Audio.unlock();
  game.tap();
}
window.addEventListener('pointerdown', onPointerDown, { passive: false });

/* --- Redimensionnement ------------------------------------- */

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;

  // On garantit une largeur ET une hauteur minimales de monde visible :
  // en portrait c'est la largeur qui commande, sinon la boîte sort du cadre.
  frustumHeight = Math.max(C.VIEW_HEIGHT_MIN, C.VIEW_WIDTH_MIN / aspect);
  const frustumWidth = frustumHeight * aspect;

  camera.left = -frustumWidth / 2;
  camera.right = frustumWidth / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = -frustumHeight / 2;
  camera.zoom = 1 / viewScale;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(devicePixelRatio, C.MAX_PIXEL_RATIO));
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
// Sur mobile, la barre d'URL qui se rétracte ne déclenche pas toujours resize.
window.visualViewport?.addEventListener('resize', resize);
resize();

/* --- Pause propre au retour d'onglet ----------------------- */

let paused = false;
document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
  lastTime = 0; // le prochain frame repart d'un delta nul
  if (paused) Audio.suspend();
  else Audio.resume();
});

/* --- Boucle ------------------------------------------------ */

let lastTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (paused) return;

  const dt = lastTime ? Math.min((now - lastTime) / 1000, C.MAX_FRAME_DELTA) : 0;
  lastTime = now;

  game.update(dt);
  scenery.update(dt);
  effects.update(dt);
  if (game.moving) movingBox.sync(game.moving);
  fragments.update(dt, camY);
  updateCamera(dt);

  renderer.render(scene, camera);
  if (DEBUG) reportDebug();
}

function updateCamera(dt) {
  // On vise un point tel que le sommet de la tour tombe à la fraction d'écran
  // voulue : au-dessus, la place du score et de la boîte qui glisse ; en
  // dessous, la tour qui plonge.
  const screenOffset =
    (1 - 2 * C.TOWER_TOP_SCREEN_FRACTION) * frustumHeight * viewScale;
  const targetY = game.towerTopY - screenOffset / (2 * Y_SCREEN_FACTOR);

  if (snapCamera) {
    camY = targetY;
    snapCamera = false;
  } else {
    camY += (targetY - camY) * (1 - Math.exp(-C.CAMERA_LERP * dt));
  }

  // Le tremblement décale la caméra ET sa cible du même vecteur : la vue se
  // translate, elle ne pivote pas.
  const sx = effects.shakeOffset();
  const sy = effects.shakeOffset();
  camera.position.set(
    C.CAMERA_OFFSET_X + sx,
    camY + C.CAMERA_OFFSET_Y + sy,
    C.CAMERA_OFFSET_Z
  );
  camera.lookAt(sx, camY + sy, 0);

  // Dézoom de fin de partie, révèle la tour entière.
  const wanted = game.state === State.FALLING || game.state === State.OVER
    ? C.GAMEOVER_ZOOM_OUT
    : 1;
  if (viewScale !== wanted) {
    const step = (C.GAMEOVER_ZOOM_OUT - 1) * (dt / C.GAMEOVER_ZOOM_DURATION);
    viewScale = wanted > viewScale
      ? Math.min(wanted, viewScale + step)
      : Math.max(wanted, viewScale - step * 4);
    camera.zoom = 1 / viewScale;
    camera.updateProjectionMatrix();
  }

  keyLight.position.set(
    C.KEY_LIGHT_POSITION.x,
    camY + C.KEY_LIGHT_POSITION.y,
    C.KEY_LIGHT_POSITION.z
  );
  keyLight.target.position.set(0, camY, 0);
  keyLight.target.updateMatrixWorld();
}

function reportDebug() {
  const m = renderer.info.memory;
  UI.setDebug(
    `geo ${m.geometries} tex ${m.textures} calls ${renderer.info.render.calls} ` +
    `lvl ${game.level} v ${game.speed.toFixed(1)}`
  );
}

// Exposé uniquement avec ?debug=1, pour l'inspection et les tests automatisés.
if (DEBUG) {
  window.__qentina = { game, renderer, scene, camera, stack, fragments, effects };
}

/* --- Hors ligne --------------------------------------------- */

// On est arrivés jusqu'ici : tous les modules sont chargés, le jeu tourne.
// Le message d'échec de démarrage posé dans index.html n'a plus lieu d'être.
clearTimeout(window.__bootWatchdog);

// Le jeu est entièrement local : rien, dans une partie, ne dépend du réseau.
// Reste à le faire savoir, sinon une coupure passe pour une panne.
function showNetworkState() {
  UI.setNetworkState(navigator.onLine ? '' : 'HORS LIGNE — LE JEU CONTINUE');
}
window.addEventListener('online', showNetworkState);
window.addEventListener('offline', showNetworkState);
showNetworkState();

// Enregistré après le chargement pour ne pas disputer la bande passante au
// premier rendu : le but est de jouer vite, pas d'être prêt hors ligne vite.
if ('serviceWorker' in navigator) {
  // Le worker prévient quand son cache est réellement rempli. C'est le seul
  // moment où la promesse « jouable hors ligne » est vraie, donc le seul où
  // on a le droit de l'annoncer.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'offline-ready' && navigator.onLine) {
      UI.flashNetwork('JOUABLE HORS LIGNE');
    }
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');

      // On demande explicitement la vérification de mise à jour. Le navigateur
      // la fait bien de lui-même, mais quand ça lui chante : sans cet appel,
      // une nouvelle version peut attendre plusieurs visites avant d'être
      // installée. L'installation étant atomique, la déclencher tôt ne risque
      // rien — au pire elle échoue et la version en place continue de servir.
      if (navigator.onLine) registration.update().catch(() => {});

      const worker = registration.active || (await navigator.serviceWorker.ready).active;
      if (!worker) return;

      // Le worker se remplit tout seul à l'installation. Mais une entrée peut
      // avoir été évincée depuis, et il ne réinstalle pas tant que sw.js n'a
      // pas changé : on lui demande de vérifier pendant qu'on a du réseau.
      if (navigator.onLine) worker.postMessage({ type: 'verify' });

      // Et on lui confie ce que la page vient réellement de charger, au cas où
      // un fichier aurait échappé à sa liste.
      const urls = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.startsWith(location.origin));
      worker.postMessage({
        type: 'precache',
        urls: [location.href.split('#')[0], ...urls],
      });
    } catch {
      /* pas de hors ligne, le jeu marche quand même */
    }
  });
}

Scenery.reset();
requestAnimationFrame(frame);
