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
      scenery.flash(); // le four accuse le coup (§3)
    } else {
      Haptics.place();
    }

    UI.setScore(level);
    Scenery.updateBackground(level);
    Scenery.skyColor(level, hemi.color);
  },

  onGameOver(lastBox, score) {
    movingBox.hide();
    fragments.spawn(lastBox, score + 1);
    Haptics.gameOver();
  },

  onEndScreen(score, bestStreak) {
    const record = Storage.submitScore(score, bestStreak);
    const best = Storage.get('best');
    UI.setBest(best);

    // Paliers et badges se calculent sur le score de LA partie, pas sur le
    // record : c'est ce qu'on vient de faire qui est récompensé.
    const tier = Rewards.tierFor(score);
    const claim = tier ? Rewards.claimReward(tier) : null;
    const fresh = Storage.unlockBadges(
      Rewards.earnedBadges({
        score,
        streak: bestStreak,
        games: Storage.get('games'),
        best,
      })
    );

    const account = Account.current();
    UI.showEnd({
      score,
      best,
      record,
      claim,
      nextTier: Rewards.nextTier(score),
      progress: Rewards.progressToNext(score),
      badges: Storage.get('badges'),
      freshBadges: fresh,
      signedIn: Boolean(account),
      pseudo: account ? account.pseudo : '',
    });

    lastScore = score;
    lastStreak = bestStreak;

    // Un joueur déjà inscrit n'a rien à faire : son score part tout seul.
    if (account) Account.saveScore(score, bestStreak);
  },
});

/* --- Compte, récompenses, partage --------------------------- */

let lastScore = 0;
let lastStreak = 0;

UI.showForgetButton(Account.isSignedIn());

UI.setupAccount({
  onOpenSheet() {
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
    UI.setEndStatus(`Score enregistré. À bientôt, ${result.account.pseudo}.`);
    refreshEndAccount();
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
    UI.setEndStatus(`Content de te revoir, ${result.account.pseudo}.`);
    refreshEndAccount();
  },

  async onForget() {
    await Account.forget();
    UI.showForgetButton(false);
    UI.closeSheet();
    UI.setBest(0);
    UI.setEndStatus('Toutes tes données ont été effacées de cet appareil.');
    refreshEndAccount();
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

/** Réaffiche l'écran de fin avec l'état de compte à jour. */
function refreshEndAccount() {
  const account = Account.current();
  const best = Storage.get('best');
  const status = document.getElementById('end-status').textContent;
  UI.showEnd({
    score: lastScore,
    best,
    record: false,
    claim: Storage.get('claimed').find((c) => lastScore >= c.boxes) || null,
    nextTier: Rewards.nextTier(lastScore),
    progress: Rewards.progressToNext(lastScore),
    badges: Storage.get('badges'),
    freshBadges: [],
    signedIn: Boolean(account),
    pseudo: account ? account.pseudo : '',
  });
  UI.setEndStatus(status);
}

/* --- Entrée ------------------------------------------------ */

function onPointerDown(event) {
  // La feuille de compte est modale : tant qu'elle est ouverte, un tap ne
  // doit surtout pas relancer une partie derrière elle.
  if (UI.isBlocking()) return;
  event.preventDefault();
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

Scenery.reset();
requestAnimationFrame(frame);
