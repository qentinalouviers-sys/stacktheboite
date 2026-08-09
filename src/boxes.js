/* ============================================================
   Création des boîtes, gestion de la tour visible et des
   fragments qui tombent. Tout le Three.js « boîtes » est ici.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js';

const _color = new THREE.Color();

/** Teinte du carton selon la hauteur (§4 : dérive lente, jamais criarde). */
export function boxColor(level) {
  const t = Math.min(level / C.COLOR_RAMP_LEVELS, 1);
  const h = THREE.MathUtils.lerp(C.COLOR_START.h, C.COLOR_END.h, t) / 360;
  const s = THREE.MathUtils.lerp(C.COLOR_START.s, C.COLOR_END.s, t);
  const l = THREE.MathUtils.lerp(C.COLOR_START.l, C.COLOR_END.l, t);
  return _color.setHSL(h, s, l).getHex();
}

/**
 * Une boîte = un Mesh + ses arêtes en enfant. Sans les arêtes, une pile
 * de boîtes claires devient illisible : c'est le principal risque visuel.
 */
export function createBoxMesh(sizeX, sizeZ, level) {
  const geometry = new THREE.BoxGeometry(sizeX, C.BOX_HEIGHT, sizeZ);
  const material = new THREE.MeshLambertMaterial({ color: boxColor(level) });
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

function disposeMesh(mesh) {
  const edges = mesh.getObjectByName('edges');
  if (edges) {
    edges.geometry.dispose();
    edges.material.dispose();
  }
  mesh.geometry.dispose();
  mesh.material.dispose();
  mesh.removeFromParent();
}

/** Remplace la géométrie d'un mesh existant (et de ses arêtes) sans réallouer le Mesh. */
function reshape(mesh, sizeX, sizeZ) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BoxGeometry(sizeX, C.BOX_HEIGHT, sizeZ);
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
    reshape(this.mesh, box.sizeX, box.sizeZ);
    this.mesh.material.color.setHex(boxColor(level));
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
    reshape(item.mesh, spec.sizeX, spec.sizeZ);
    item.mesh.material.color.setHex(boxColor(level));
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
