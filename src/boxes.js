/* ============================================================
   Création des boîtes, gestion de la tour visible et des
   fragments qui tombent. Tout le Three.js « boîtes » est ici.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js';
import { getAtlas } from './textures.js';

const _color = new THREE.Color();

/**
 * Où en est la brûlure à ce niveau, de 0 (carton intact) à 1 (calciné).
 * Exporté : la fumée de la tour s'en sert aussi.
 */
export function burnFactor(level) {
  return THREE.MathUtils.clamp(
    (level - C.BURN_START_LEVEL) / (C.BURN_FULL_LEVEL - C.BURN_START_LEVEL),
    0,
    1
  );
}

/** Indice d'état de brûlure dans l'atlas : 0 intact, dernier calciné. */
function charStage(level) {
  const last = C.SIDE_BANDS.length - 1;
  return Math.min(last, Math.round(burnFactor(level) * last));
}

/**
 * Teinte du carton : elle multiplie la texture. Deux dérives se composent —
 * la chaleur qui monte avec la hauteur (§4), puis l'assombrissement de la
 * brûlure. Les paliers de texture donnent les marques, cette teinte-là donne
 * la progression continue entre deux paliers.
 */
export function boxTint(level) {
  const t = Math.min(level / C.COLOR_RAMP_LEVELS, 1);
  const h = THREE.MathUtils.lerp(C.COLOR_START.h, C.COLOR_END.h, t);
  const s = THREE.MathUtils.lerp(C.COLOR_START.s, C.COLOR_END.s, t);
  const l = THREE.MathUtils.lerp(C.COLOR_START.l, C.COLOR_END.l, t);

  const burn = burnFactor(level);
  return _color
    .setHSL(
      THREE.MathUtils.lerp(h, C.CHAR_TINT.h, burn) / 360,
      THREE.MathUtils.lerp(s, C.CHAR_TINT.s, burn),
      THREE.MathUtils.lerp(l, C.CHAR_TINT.l, burn)
    )
    .getHex();
}

/**
 * Envoie les UV d'une face dans une sous-zone de l'atlas.
 * Ordre des faces d'une BoxGeometry : +X, -X, +Y, -Y, +Z, -Z, 4 sommets chacune.
 */
function mapFaceUV(uv, face, u0, u1, v0, v1) {
  const start = face * 4;
  for (let i = start; i < start + 4; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
}

/**
 * Une tranche est cadrée sur la bande QENTINA, et son étendue horizontale
 * est proportionnelle à la largeur réelle de la face. C'est le cœur de la
 * gestion du rétrécissement : la bande couvre toujours TEXTURE_REF_LENGTH
 * unités monde, donc les lettres gardent exactement la même taille physique
 * et ne s'étirent JAMAIS, même après vingt découpes. Le motif reste par
 * ailleurs centré sur la tranche, ce qui évite qu'une boîte étroite tombe
 * systématiquement sur un blanc entre deux mots.
 */
function mapSideUV(uv, face, width, band) {
  const span = width / C.TEXTURE_REF_LENGTH;
  const u0 = (1 - span) / 2; // valeurs hors [0,1] : RepeatWrapping s'en charge
  mapFaceUV(uv, face, u0, u0 + span, band.v0, band.v1);
}

function applyUVs(geometry, sizeX, sizeZ, level) {
  const uv = geometry.attributes.uv;
  const stage = charStage(level);
  const band = C.SIDE_BANDS[stage];
  const cap = C.CAP_BANDS[stage];

  mapSideUV(uv, 0, sizeZ, band); // +X : sa largeur est sizeZ
  mapSideUV(uv, 1, sizeZ, band); // -X
  mapSideUV(uv, 4, sizeX, band); // +Z : sa largeur est sizeX
  mapSideUV(uv, 5, sizeX, band); // -Z

  // Dessus et dessous : carton uni. On reste dans la zone couvercle sans
  // répétition — le grain s'étire avec la boîte, invisible à cette opacité.
  mapFaceUV(uv, 2, cap.u0, cap.u1, C.CAP_V0, C.CAP_V1);
  mapFaceUV(uv, 3, cap.u0, cap.u1, C.CAP_V0, C.CAP_V1);

  uv.needsUpdate = true;
}

function makeGeometry(sizeX, sizeZ, level) {
  const geometry = new THREE.BoxGeometry(sizeX, C.BOX_HEIGHT, sizeZ);
  applyUVs(geometry, sizeX, sizeZ, level);
  return geometry;
}

/**
 * Une boîte = un Mesh (matériaux par face) + ses arêtes en enfant. Sans les
 * arêtes, une pile de boîtes blanches devient une bouillie illisible : c'est
 * le principal risque visuel du projet.
 */
export function createBoxMesh(sizeX, sizeZ, level) {
  const geometry = makeGeometry(sizeX, sizeZ, level);
  // Un seul matériau, un seul appel de dessin par boîte : toutes les faces
  // tapent dans le même atlas, la distinction se fait par les UV.
  const material = new THREE.MeshLambertMaterial({
    map: getAtlas(),
    color: boxTint(level),
  });
  const mesh = new THREE.Mesh(geometry, material);

  const signature = level > 0 && level % C.SIGNATURE_EVERY === 0;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: signature ? C.SIGNATURE_EDGE_COLOR : C.EDGE_COLOR,
      transparent: true,
      opacity: signature ? C.SIGNATURE_EDGE_OPACITY : C.EDGE_OPACITY,
    })
  );
  edges.name = 'edges';
  mesh.add(edges);
  return mesh;
}

/** Recolore une boîte existante sans toucher à sa géométrie. */
function retint(mesh, level, signature) {
  mesh.material.color.setHex(boxTint(level));
  const edges = mesh.getObjectByName('edges');
  if (edges) {
    edges.material.color.setHex(
      signature ? C.SIGNATURE_EDGE_COLOR : C.EDGE_COLOR
    );
    edges.material.opacity = signature
      ? C.SIGNATURE_EDGE_OPACITY
      : C.EDGE_OPACITY;
  }
}

function disposeMesh(mesh) {
  const edges = mesh.getObjectByName('edges');
  if (edges) {
    edges.geometry.dispose();
    edges.material.dispose();
  }
  mesh.geometry.dispose();
  // L'atlas est partagé par toutes les boîtes : on ne dispose que le matériau.
  mesh.material.dispose();
  mesh.removeFromParent();
}

/** Remplace la géométrie d'un mesh existant sans réallouer le Mesh. */
function reshape(mesh, sizeX, sizeZ, level) {
  mesh.geometry.dispose();
  mesh.geometry = makeGeometry(sizeX, sizeZ, level);
  const edges = mesh.getObjectByName('edges');
  if (edges) {
    edges.geometry.dispose();
    edges.geometry = new THREE.EdgesGeometry(mesh.geometry);
  }
}

/* ------------------------------------------------------------
   La tour : on ne garde que les N dernières boîtes en mémoire.
   ------------------------------------------------------------ */

export class Stack {
  constructor(scene) {
    this.scene = scene;
    this.meshes = [];
  }

  add(box, level) {
    const mesh = createBoxMesh(box.sizeX, box.sizeZ, level);
    mesh.position.set(box.x, box.y + C.BOX_HEIGHT / 2, box.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    while (this.meshes.length > C.MAX_VISIBLE_BOXES) {
      disposeMesh(this.meshes.shift());
    }
    return mesh;
  }

  clear() {
    this.meshes.forEach(disposeMesh);
    this.meshes.length = 0;
  }
}

/* ------------------------------------------------------------
   La boîte en mouvement : un seul mesh réutilisé de bout en bout.
   ------------------------------------------------------------ */

export class MovingBox {
  constructor(scene) {
    this.scene = scene;
    this.mesh = createBoxMesh(C.BOX_SIZE_X, C.BOX_SIZE_Z, 1);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  spawn(box, level) {
    reshape(this.mesh, box.sizeX, box.sizeZ, level);
    retint(this.mesh, level, false);
    this.mesh.visible = true;
    this.sync(box);
  }

  sync(box) {
    this.mesh.position.set(box.x, box.y + C.BOX_HEIGHT / 2, box.z);
  }

  hide() {
    this.mesh.visible = false;
  }
}

/* ------------------------------------------------------------
   Fragments : pool de meshes, physique de chute triviale.
   ------------------------------------------------------------ */

export class Fragments {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
  }

  spawn(spec, level) {
    let item = this.pool.pop();
    if (!item) {
      item = { mesh: createBoxMesh(1, 1, level) };
      this.scene.add(item.mesh);
    }
    reshape(item.mesh, spec.sizeX, spec.sizeZ, level);
    retint(item.mesh, level, false);
    item.mesh.visible = true;
    item.mesh.position.set(spec.x, spec.y + C.BOX_HEIGHT / 2, spec.z);
    item.mesh.rotation.set(0, 0, 0);

    const dir = spec.dir || 1;
    item.vx = spec.axis === 'x' ? dir * C.FRAGMENT_SPEED_H : 0;
    item.vz = spec.axis === 'z' ? dir * C.FRAGMENT_SPEED_H : 0;
    item.vy = C.FRAGMENT_SPEED_V; // petit rebond vers le haut avant la chute
    // Rotation sur l'axe perpendiculaire à la chute.
    item.spinAxis = spec.axis === 'x' ? 'z' : 'x';
    item.spin =
      -dir * (C.FRAGMENT_SPIN_MIN + Math.random() * C.FRAGMENT_SPIN_RANGE);

    this.active.push(item);
    return item;
  }

  update(dt, camY) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      f.vy += C.GRAVITY * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.rotation[f.spinAxis] += f.spin * dt;

      if (f.mesh.position.y < camY - C.FRAGMENT_CULL_BELOW) {
        this.active.splice(i, 1);
        this.recycle(f);
      }
    }
  }

  recycle(f) {
    f.mesh.visible = false;
    if (this.pool.length < C.FRAGMENT_POOL_MAX) {
      this.pool.push(f);
    } else {
      disposeMesh(f.mesh);
    }
  }

  clear() {
    this.active.forEach((f) => this.recycle(f));
    this.active.length = 0;
  }
}
