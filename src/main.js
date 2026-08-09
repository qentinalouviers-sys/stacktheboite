/* ============================================================
   Boot, scène, boucle de rendu, orchestration.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js';
import { Game, State } from './game.js';
import { Stack, MovingBox, Fragments } from './boxes.js';
import * as UI from './ui.js';
import * as Storage from './storage.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

/* --- Renderer & scène ------------------------------------- */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, C.MAX_PIXEL_RATIO));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.BACKGROUND_COLOR);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, C.CAMERA_NEAR, C.CAMERA_FAR);
let frustumHeight = C.VIEW_HEIGHT_MIN;
let viewScale = 1; // 1 = jeu, monte jusqu'à GAMEOVER_ZOOM_OUT à la mort

scene.add(new THREE.AmbientLight(C.AMBIENT_COLOR, C.AMBIENT_INTENSITY));

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

// Sol provisoire : remplacé par le carrelage de la salle (§4).
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshLambertMaterial({ color: 0x1d1822 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = C.GROUND_RECEIVES_SHADOW;
scene.add(ground);

/* --- Objets de jeu ---------------------------------------- */

const stack = new Stack(scene);
const movingBox = new MovingBox(scene);
const fragments = new Fragments(scene);

Storage.load();
UI.setBest(Storage.get('best'));

let camY = 0;
let snapCamera = true;

const game = new Game({
  onReset(baseBox) {
    stack.clear();
    fragments.clear();
    stack.add(baseBox, 0);
    viewScale = 1;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    snapCamera = true;
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
    stack.add(placed, level);
    movingBox.hide();
    if (fragment) fragments.spawn(fragment, level);
    if (perfect) UI.showPerfect(streak);
    UI.setScore(level);
  },

  onGameOver(lastBox, score) {
    movingBox.hide();
    fragments.spawn(lastBox, score + 1);
  },

  onEndScreen(score) {
    const record = Storage.submitScore(score);
    UI.setBest(Storage.get('best'));
    UI.showEnd(score, Storage.get('best'), record);
  },
});

/* --- Entrée ------------------------------------------------ */

function onPointerDown(event) {
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
  if (game.moving) movingBox.sync(game.moving);
  fragments.update(dt, camY);
  updateCamera(dt);

  renderer.render(scene, camera);
  if (DEBUG) reportDebug();
}

function updateCamera(dt) {
  const targetY = game.towerTopY + frustumHeight * C.CAMERA_LOOK_AHEAD_RATIO;

  if (snapCamera) {
    camY = targetY;
    snapCamera = false;
  } else {
    camY += (targetY - camY) * (1 - Math.exp(-C.CAMERA_LERP * dt));
  }

  camera.position.set(C.CAMERA_OFFSET_X, camY + C.CAMERA_OFFSET_Y, C.CAMERA_OFFSET_Z);
  camera.lookAt(0, camY, 0);

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
  window.__qentina = { game, renderer, scene, camera, stack, fragments };
}

requestAnimationFrame(frame);
