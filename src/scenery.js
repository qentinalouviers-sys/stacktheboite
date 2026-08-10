/* ============================================================
   Décor : le fond dégradé, la lumière qui dérive avec la hauteur,
   et la salle avec son four napolitain.

   Le fond est un dégradé CSS derrière un canvas transparent plutôt
   qu'un plan dans la scène : zéro draw call, zéro texture, et il
   couvre nativement les zones de safe area.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js?v=4af5982';
import {
  getMosaicTexture,
  getMarbleTexture,
  getFloorTexture,
  getBlobShadowTexture,
  getFireTexture,
} from './textures.js?v=4af5982';

const root = document.documentElement;
let lastLevel = -1;

/** Orientation face caméra : la direction de vue ne change jamais. */
const BILLBOARD = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(
    C.CAMERA_OFFSET_X,
    C.CAMERA_OFFSET_Y,
    C.CAMERA_OFFSET_Z
  ).normalize()
);

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

/* ============================================================
   Le four napolitain et la salle.

   Construit d'après la photo du vrai four : coupole en mosaïque dorée à
   joints noirs, bouche en arche sombre avec les braises au fond, socle
   carrelé de la même faïence, tablette en pierre, plan de travail en
   marbre, rack à bûches.

   Tout est stylisé et basse fréquence : le décor ne doit jamais
   concurrencer la lisibilité de la tour. Il est en un seul Group, ce qui
   permet de le sortir de la scène d'un coup quand la caméra est montée
   assez haut pour l'avoir quitté.
   ============================================================ */

/** Encadrement de bouche : un rectangle percé d'une arche, puis extrudé. */
function makeArchFrame(width, height, mouthWidth, mouthHeight, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();

  const radius = mouthWidth / 2;
  const straight = Math.max(0.01, mouthHeight - radius);
  const hole = new THREE.Path();
  hole.moveTo(-radius, 0);
  hole.lineTo(-radius, straight);
  hole.absarc(0, straight, radius, Math.PI, 0, true);
  hole.lineTo(radius, 0);
  hole.closePath();
  shape.holes.push(hole);

  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function buildOven(materials) {
  const oven = new THREE.Group();
  oven.position.set(C.OVEN_POSITION.x, C.OVEN_POSITION.y, C.OVEN_POSITION.z);
  oven.rotation.y = C.OVEN_ROTATION_Y;
  oven.scale.setScalar(C.OVEN_SCALE);

  const radius = C.OVEN_BASE_RADIUS;
  const baseH = C.OVEN_BASE_HEIGHT;

  // Panneau de marbre en fond : il détache la coupole du dégradé de nuit.
  const backsplash = new THREE.Mesh(
    new THREE.BoxGeometry(
      C.OVEN_BACKSPLASH.width,
      C.OVEN_BACKSPLASH.height,
      C.OVEN_BACKSPLASH.depth
    ),
    materials.wall
  );
  backsplash.position.set(0, C.OVEN_BACKSPLASH.height / 2, -radius - 0.5);
  oven.add(backsplash);

  // Socle cylindrique carrelé de la même faïence.
  const socle = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, baseH, 24),
    materials.mosaicBase
  );
  socle.position.y = baseH / 2;
  socle.castShadow = true;
  oven.add(socle);

  // Bûches rangées sous le four.
  const logGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.5, 7);
  for (let i = 0; i < C.LOG_COUNT; i++) {
    const log = new THREE.Mesh(logGeo, materials.log);
    log.rotation.x = Math.PI / 2;
    log.position.set(
      -0.5 + (i % 3) * 0.34,
      0.18 + Math.floor(i / 3) * 0.27,
      radius * 0.45
    );
    oven.add(log);
  }

  // Tablette de marbre entre le socle et la coupole.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 2 + 0.3, 0.16, radius * 2 + 0.3),
    materials.marble
  );
  slab.position.y = baseH + 0.08;
  slab.castShadow = true;
  oven.add(slab);

  // Coupole surbaissée.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(C.OVEN_DOME_RADIUS, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.mosaicDome
  );
  dome.position.y = baseH + 0.16;
  dome.scale.y = C.OVEN_DOME_FLATTEN;
  dome.castShadow = true;
  oven.add(dome);

  // Conduit d'extraction au sommet. En prime, il masque le point où les UV
  // sphériques convergent, qui donnait au sommet un aspect de panier tressé.
  const flue = new THREE.Group();
  const domeTop = baseH + 0.16 + C.OVEN_DOME_RADIUS * C.OVEN_DOME_FLATTEN;
  flue.position.y = domeTop - 0.15;
  oven.add(flue);

  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(C.OVEN_FLUE_RADIUS, C.OVEN_FLUE_RADIUS, C.OVEN_FLUE_HEIGHT, 14),
    materials.steel
  );
  riser.position.y = C.OVEN_FLUE_HEIGHT / 2;
  riser.castShadow = true;
  flue.add(riser);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(C.OVEN_FLUE_RADIUS, C.OVEN_FLUE_RADIUS, C.OVEN_FLUE_ARM_LENGTH, 14),
    materials.steel
  );
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-C.OVEN_FLUE_ARM_LENGTH / 2, C.OVEN_FLUE_HEIGHT, 0);
  arm.castShadow = true;
  flue.add(arm);

  const ringGeo = new THREE.TorusGeometry(
    C.OVEN_FLUE_RADIUS + 0.02,
    C.OVEN_FLUE_RING_RADIUS,
    8,
    20
  );
  const ringA = new THREE.Mesh(ringGeo, materials.steel);
  ringA.rotation.x = Math.PI / 2;
  ringA.position.y = C.OVEN_FLUE_HEIGHT * 0.55;
  flue.add(ringA);

  const ringB = new THREE.Mesh(ringGeo, materials.steel);
  ringB.rotation.y = Math.PI / 2;
  ringB.position.set(-C.OVEN_FLUE_ARM_LENGTH * 0.55, C.OVEN_FLUE_HEIGHT, 0);
  flue.add(ringB);

  // Bloc sombre devant la coupole : c'est le massif qui porte la bouche.
  const front = new THREE.Group();
  front.position.set(0, baseH + 0.16, radius * 0.86);
  oven.add(front);

  const frameW = 1.6;
  const frameH = 1.3;
  const frame = new THREE.Mesh(
    makeArchFrame(frameW, frameH, C.OVEN_MOUTH_WIDTH, C.OVEN_MOUTH_HEIGHT, 0.26),
    materials.dark
  );
  frame.castShadow = true;
  front.add(frame);

  // Braises au fond de la bouche, légèrement en retrait.
  const fire = new THREE.Mesh(
    new THREE.PlaneGeometry(C.OVEN_MOUTH_WIDTH * 1.05, C.OVEN_MOUTH_HEIGHT * 1.05),
    materials.fire
  );
  fire.position.set(0, C.OVEN_MOUTH_HEIGHT * 0.5, -0.16);
  front.add(fire);

  // Linteau de pierre au-dessus de la bouche.
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(frameW + 0.3, 0.2, 0.5),
    materials.stone
  );
  lintel.position.set(0, frameH + 0.1, 0.1);
  front.add(lintel);

  // Tablette de travail devant la bouche.
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(frameW + 0.5, 0.13, 0.62),
    materials.stone
  );
  shelf.position.set(0, 0.06, 0.42);
  shelf.castShadow = true;
  front.add(shelf);

  // La lumière du feu : c'est la source principale de la scène.
  const light = new THREE.PointLight(
    C.FIRE_COLOR,
    C.FIRE_LIGHT_INTENSITY,
    C.FIRE_LIGHT_DISTANCE,
    C.FIRE_LIGHT_DECAY
  );
  light.position.set(0, C.OVEN_MOUTH_HEIGHT * 0.5, 0.3);
  front.add(light);

  return { group: oven, light, fire };
}

function buildRoom(materials) {
  const room = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(C.FLOOR_SIZE, C.FLOOR_SIZE),
    materials.floor
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01; // sous la boîte de base, jamais en z-fight avec
  room.add(floor);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(C.TOWER_SHADOW_SIZE, C.TOWER_SHADOW_SIZE),
    materials.blob
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  room.add(shadow);

  // Plan de travail inox avec évier, robinet et vitrine de préparation :
  // le poste de travail de la cuisine, au fond.
  const steel = new THREE.Group();
  steel.position.set(C.STEEL_POSITION.x, 0, C.STEEL_POSITION.z);
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(C.STEEL_SIZE.x, C.STEEL_SIZE.y, C.STEEL_SIZE.z),
    materials.steel
  );
  block.position.y = C.STEEL_SIZE.y / 2;
  block.castShadow = true;
  steel.add(block);

  const sink = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.05, 0.6),
    materials.dark
  );
  sink.position.set(-0.75, C.STEEL_SIZE.y + 0.01, 0);
  steel.add(sink);

  const faucet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8),
    materials.steel
  );
  faucet.position.set(-0.75, C.STEEL_SIZE.y + 0.21, -0.32);
  steel.add(faucet);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.36, 0.75),
    materials.glass
  );
  glass.position.set(0.7, C.STEEL_SIZE.y + 0.22, 0);
  steel.add(glass);
  room.add(steel);

  // Comptoir de service en bois, plateau de marbre, en avant-plan : il passe
  // devant la base de la tour, ce qui donne de la profondeur à une scène sans
  // perspective.
  const counter = new THREE.Group();
  counter.position.set(C.COUNTER_POSITION.x, 0, C.COUNTER_POSITION.z);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(C.COUNTER_SIZE.x, C.COUNTER_SIZE.y, C.COUNTER_SIZE.z),
    materials.marble
  );
  top.position.y = C.COUNTER_HEIGHT;
  counter.add(top);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(C.COUNTER_SIZE.x - 0.3, C.COUNTER_HEIGHT, C.COUNTER_SIZE.z - 0.3),
    materials.wood
  );
  body.position.y = C.COUNTER_HEIGHT / 2;
  counter.add(body);
  room.add(counter);

  return room;
}

/**
 * Braises qui montent de la bouche du four. Des quads simples, pas un système
 * de particules : la caméra ne tourne jamais, donc l'orientation face caméra
 * est fixe et il n'y a rien à recalculer par frame.
 */
function buildEmbers(materials, parent) {
  const group = new THREE.Group();
  // Origine : au-dessus de la bouche, d'où la chaleur sort.
  group.position.set(0, C.OVEN_BASE_HEIGHT + 1.0, C.OVEN_DOME_RADIUS * 0.7);
  // Le groupe reste aligné sur les axes du monde : c'est dans son repère que
  // les braises montent. L'orientation face caméra va sur chaque quad, sinon
  // l'axe vertical local part de travers et les braises montent en biais.
  parent.add(group);

  const geometry = new THREE.PlaneGeometry(C.EMBER_SIZE, C.EMBER_SIZE);
  const items = [];
  for (let i = 0; i < C.EMBER_COUNT; i++) {
    const mesh = new THREE.Mesh(geometry, materials.ember.clone());
    mesh.quaternion.copy(BILLBOARD);
    group.add(mesh);
    items.push({ mesh, life: 0, span: 1, vy: 1, vx: 0 });
  }

  function respawn(e, stagger) {
    e.span =
      C.EMBER_LIFE_MIN + Math.random() * (C.EMBER_LIFE_MAX - C.EMBER_LIFE_MIN);
    e.life = stagger ? Math.random() * e.span : 0;
    e.vy = C.EMBER_RISE_MIN + Math.random() * (C.EMBER_RISE_MAX - C.EMBER_RISE_MIN);
    e.vx = (Math.random() - 0.5) * C.EMBER_DRIFT;
    e.mesh.position.set(
      (Math.random() - 0.5) * C.EMBER_SPREAD,
      0,
      (Math.random() - 0.5) * C.EMBER_SPREAD * 0.5
    );
  }
  items.forEach((e) => respawn(e, true));

  return {
    update(dt) {
      for (const e of items) {
        e.life += dt;
        if (e.life >= e.span) respawn(e, false);
        e.mesh.position.y += e.vy * dt;
        e.mesh.position.x += e.vx * dt;
        const t = e.life / e.span;
        // Apparition rapide, extinction lente : une braise s'éteint, elle ne
        // disparaît pas d'un coup.
        e.mesh.material.opacity = Math.min(1, t * 6) * (1 - t) * 0.9;
        e.mesh.scale.setScalar(1 - t * 0.45);
      }
    },
  };
}

/**
 * Construit tout le décor et renvoie de quoi l'animer.
 * `flash()` sert au perfect (§3 : intensité x1.5 pendant 120 ms).
 */
export function buildScenery(scene) {
  const mosaicDome = getMosaicTexture().clone();
  mosaicDome.needsUpdate = true;
  mosaicDome.repeat.set(C.MOSAIC_REPEAT_DOME.x, C.MOSAIC_REPEAT_DOME.y);

  const mosaicBase = getMosaicTexture().clone();
  mosaicBase.needsUpdate = true;
  mosaicBase.repeat.setScalar(C.MOSAIC_REPEAT_BASE);

  const floorMap = getFloorTexture();
  const marbleMap = getMarbleTexture();
  marbleMap.repeat.setScalar(C.MARBLE_REPEAT);

  const materials = {
    // Phong et pas Lambert : la faïence doit accrocher la lumière du feu.
    mosaicDome: new THREE.MeshPhongMaterial({
      map: mosaicDome,
      specular: C.MOSAIC_SPECULAR,
      shininess: C.MOSAIC_SHININESS,
    }),
    mosaicBase: new THREE.MeshPhongMaterial({
      map: mosaicBase,
      specular: C.MOSAIC_SPECULAR,
      shininess: C.MOSAIC_SHININESS,
    }),
    stone: new THREE.MeshLambertMaterial({ color: C.OVEN_STONE_COLOR }),
    // Phong et pas Standard/metalness : sans environment map, un matériau
    // métallique n'a rien à réfléchir et rend sombre et terne. Le specular
    // de Phong, lui, brille avec les lumières de la scène.
    steel: new THREE.MeshPhongMaterial({
      color: C.STEEL_COLOR,
      specular: C.STEEL_SPECULAR,
      shininess: C.STEEL_SHININESS,
    }),
    glass: new THREE.MeshPhongMaterial({
      color: C.GLASS_COLOR,
      transparent: true,
      opacity: C.GLASS_OPACITY,
      shininess: 100,
      depthWrite: false,
    }),
    wood: new THREE.MeshLambertMaterial({ color: C.COUNTER_WOOD_COLOR }),
    wall: new THREE.MeshLambertMaterial({ color: C.OVEN_BACKSPLASH_COLOR }),
    ember: new THREE.MeshBasicMaterial({
      color: C.EMBER_COLOR,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    dark: new THREE.MeshLambertMaterial({ color: C.OVEN_DARK_COLOR }),
    fire: new THREE.MeshBasicMaterial({ map: getFireTexture(), toneMapped: false }),
    floor: new THREE.MeshLambertMaterial({
      map: floorMap,
      transparent: true,
      depthWrite: false,
    }),
    blob: new THREE.MeshBasicMaterial({
      map: getBlobShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: C.TOWER_SHADOW_OPACITY,
    }),
    marble: new THREE.MeshPhongMaterial({
      map: marbleMap,
      specular: 0x4a4a4a,
      shininess: 36,
    }),
    log: new THREE.MeshLambertMaterial({ color: C.LOG_COLOR }),
  };

  const oven = buildOven(materials);
  const room = buildRoom(materials);
  const embers = buildEmbers(materials, oven.group);

  const group = new THREE.Group();
  group.add(room);
  group.add(oven.group);
  scene.add(group);

  // Bruit lissé pour le vacillement : deux cibles aléatoires interpolées,
  // ça donne un feu qui respire au lieu d'un stroboscope.
  let noiseFrom = 1;
  let noiseTo = Math.random();
  let noisePhase = 0;
  let flashLeft = 0;

  return {
    group,

    flash() {
      flashLeft = C.FIRE_FLASH_DURATION;
    },

    update(dt) {
      embers.update(dt);
      noisePhase += dt * C.FIRE_FLICKER_HZ;
      while (noisePhase >= 1) {
        noisePhase -= 1;
        noiseFrom = noiseTo;
        noiseTo = Math.random();
      }
      // Lissage en cosinus : pas de cassure à chaque nouvelle cible.
      const smooth = (1 - Math.cos(noisePhase * Math.PI)) / 2;
      const noise = noiseFrom + (noiseTo - noiseFrom) * smooth;

      let factor = C.FIRE_FLICKER_MIN + noise * (C.FIRE_FLICKER_MAX - C.FIRE_FLICKER_MIN);
      if (flashLeft > 0) {
        flashLeft -= dt;
        factor *= C.FIRE_FLASH_FACTOR;
      }
      oven.light.intensity = C.FIRE_LIGHT_INTENSITY * factor;
    },
  };
}
