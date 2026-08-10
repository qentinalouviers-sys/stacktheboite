/* ============================================================
   Effets de pose : écrasement de la boîte, onde au sol,
   particules dorées du perfect.

   Fichier hors de l'arborescence prévue par la spec : ces effets ne sont
   ni des boîtes ni du décor, et boxes.js fait déjà la découpe, la tour et
   les fragments.

   Deux règles tenues partout ici :
   - aucun setTimeout, tout avance avec le delta de la boucle de rendu ;
   - rien ne bloque l'entrée, on peut poser la boîte suivante alors que
     l'onde précédente n'est pas finie.

   Tout est mis en pool : aucune allocation de Mesh par frame, ni même par
   pose une fois le régime établi.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js';
import { getSmokeTexture } from './textures.js';

/**
 * Orientation face caméra, calculée une fois. La caméra ne tourne jamais et
 * la projection est orthographique : seule la direction de vue compte, et
 * elle est constante. Aucun billboard à recalculer par frame.
 */
const BILLBOARD = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(
    C.CAMERA_OFFSET_X,
    C.CAMERA_OFFSET_Y,
    C.CAMERA_OFFSET_Z
  ).normalize()
);

/* ------------------------------------------------------------
   Écrasement de la boîte posée.
   ------------------------------------------------------------ */

export class Squash {
  constructor() {
    this.active = [];
  }

  /** `bottomY` est le dessous de la boîte : c'est lui qui doit rester collé
   *  à la boîte du dessous pendant que le mesh s'écrase. */
  add(mesh, bottomY) {
    this.active.push({ mesh, bottomY, t: 0 });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      const mesh = item.mesh;

      // La boîte a pu être recyclée hors du champ pendant l'animation.
      if (!mesh.parent) {
        this.active.splice(i, 1);
        continue;
      }

      item.t += dt / C.SQUASH_DURATION;
      let scale;
      if (item.t >= 1) {
        scale = 1;
        this.active.splice(i, 1);
      } else if (item.t < C.SQUASH_PEAK_AT) {
        const k = item.t / C.SQUASH_PEAK_AT;
        const ease = 1 - Math.pow(1 - k, 3);
        const peak = 1 + C.SQUASH_OVERSHOOT;
        scale = C.SQUASH_SCALE + (peak - C.SQUASH_SCALE) * ease;
      } else {
        const k = (item.t - C.SQUASH_PEAK_AT) / (1 - C.SQUASH_PEAK_AT);
        const ease = k * k * (3 - 2 * k); // smoothstep
        scale = 1 + C.SQUASH_OVERSHOOT * (1 - ease);
      }

      mesh.scale.y = scale;
      mesh.position.y = item.bottomY + (C.BOX_HEIGHT * scale) / 2;
    }
  }

  clear() {
    for (const item of this.active) {
      if (item.mesh.parent) {
        item.mesh.scale.y = 1;
        item.mesh.position.y = item.bottomY + C.BOX_HEIGHT / 2;
      }
    }
    this.active.length = 0;
  }
}

/* ------------------------------------------------------------
   Onde au sol.
   ------------------------------------------------------------ */

export class Waves {
  constructor(scene) {
    this.scene = scene;
    // Un anneau de rayon 1 partagé : chaque onde n'est qu'une mise à l'échelle.
    this.geometry = new THREE.RingGeometry(
      C.WAVE_INNER_RATIO,
      1,
      C.WAVE_SEGMENTS
    );
    this.pool = [];
    this.active = [];
  }

  spawn(box, options) {
    let item = this.pool.pop();
    if (!item) {
      const mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      item = { mesh };
    }

    item.mesh.visible = true;
    item.mesh.material.color.setHex(options.color);
    item.mesh.position.set(box.x, box.y + C.BOX_HEIGHT + 0.006, box.z);
    item.base = Math.max(box.sizeX, box.sizeZ) / 2;
    item.maxScale = options.maxScale;
    item.opacity = options.opacity;
    item.duration = options.duration;
    item.t = 0;

    this.active.push(item);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const w = this.active[i];
      w.t += dt / w.duration;
      if (w.t >= 1) {
        this.active.splice(i, 1);
        this.recycle(w);
        continue;
      }
      const spread =
        C.WAVE_START_SCALE + (w.maxScale - C.WAVE_START_SCALE) * w.t;
      const scale = w.base * spread;
      w.mesh.scale.set(scale, scale, 1);
      w.mesh.material.opacity = w.opacity * (1 - w.t);
    }
  }

  recycle(w) {
    w.mesh.visible = false;
    if (this.pool.length < C.WAVE_POOL_MAX) this.pool.push(w);
    else {
      w.mesh.material.dispose();
      w.mesh.removeFromParent();
    }
  }

  clear() {
    this.active.forEach((w) => this.recycle(w));
    this.active.length = 0;
  }
}

/* ------------------------------------------------------------
   Particules dorées du perfect.
   ------------------------------------------------------------ */

export class Sparks {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.PlaneGeometry(C.SPARK_SIZE, C.SPARK_SIZE);
    this.pool = [];
    this.active = [];
  }

  burst(box, intense) {
    const count =
      C.SPARK_COUNT_MIN +
      Math.floor(Math.random() * (C.SPARK_COUNT_MAX - C.SPARK_COUNT_MIN + 1));
    const y = box.y + C.BOX_HEIGHT;

    // On recycle les plus anciennes plutôt que de dépasser le plafond.
    const overflow = this.active.length + count - C.SPARK_MAX;
    for (let i = 0; i < overflow; i++) this.recycle(this.active.shift());

    for (let i = 0; i < count; i++) {
      let item = this.pool.pop();
      if (!item) {
        const mesh = new THREE.Mesh(
          this.geometry,
          new THREE.MeshBasicMaterial({
            color: C.SPARK_COLOR,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
            side: THREE.DoubleSide,
          })
        );
        mesh.quaternion.copy(BILLBOARD);
        this.scene.add(mesh);
        item = { mesh };
      }

      // Éjection horizontale depuis le bord de la boîte, direction au hasard.
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed =
        (C.SPARK_SPEED_MIN +
          Math.random() * (C.SPARK_SPEED_MAX - C.SPARK_SPEED_MIN)) *
        (intense ? 1.25 : 1);
      const radius = Math.max(box.sizeX, box.sizeZ) * 0.42;

      item.mesh.visible = true;
      item.mesh.position.set(
        box.x + Math.cos(angle) * radius,
        y,
        box.z + Math.sin(angle) * radius
      );
      item.vx = Math.cos(angle) * speed;
      item.vz = Math.sin(angle) * speed;
      item.vy = C.SPARK_RISE * (0.6 + Math.random() * 0.8);
      item.t = 0;
      this.active.push(item);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.t += dt / C.SPARK_DURATION;
      if (s.t >= 1) {
        this.active.splice(i, 1);
        this.recycle(s);
        continue;
      }
      s.vy += C.SPARK_GRAVITY * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.material.opacity = 1 - s.t * s.t;
      const scale = 1 - s.t * 0.5;
      s.mesh.scale.set(scale, scale, 1);
    }
  }

  recycle(s) {
    s.mesh.visible = false;
    this.pool.push(s);
  }

  clear() {
    this.active.forEach((s) => this.recycle(s));
    this.active.length = 0;
  }
}

/* ------------------------------------------------------------
   Fumée de la tour. Elle ne démarre qu'une fois le carton attaqué, et
   son débit suit la brûlure : c'est le signal que ça chauffe.
   ------------------------------------------------------------ */

export class Smoke {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshBasicMaterial({
      map: getSmokeTexture(),
      color: C.SMOKE_COLOR,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.pool = [];
    this.active = [];
    this.timer = 0;
  }

  /** `source` décrit la boîte du sommet, `burn` va de 0 à 1. */
  update(dt, source, burn) {
    if (burn > 0 && source) {
      this.timer -= dt * burn;
      if (this.timer <= 0) {
        this.timer = C.SMOKE_INTERVAL;
        this.emit(source, burn);
      }
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.t += dt / C.SMOKE_LIFE;
      if (s.t >= 1) {
        this.active.splice(i, 1);
        this.recycle(s);
        continue;
      }
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      const size = THREE.MathUtils.lerp(
        C.SMOKE_SIZE_START,
        C.SMOKE_SIZE_END,
        s.t
      );
      s.mesh.scale.set(size, size, 1);
      // Montée rapide puis longue extinction : une bouffée se dissipe, elle
      // ne s'éteint pas d'un coup.
      s.mesh.material.opacity =
        Math.min(1, s.t * 5) * (1 - s.t) * C.SMOKE_OPACITY * s.strength;
    }
  }

  emit(source, burn) {
    let item = this.pool.pop();
    if (!item) {
      if (this.active.length >= C.SMOKE_MAX) return;
      const mesh = new THREE.Mesh(this.geometry, this.material.clone());
      mesh.quaternion.copy(BILLBOARD);
      this.scene.add(mesh);
      item = { mesh };
    }

    const spread = Math.max(source.sizeX, source.sizeZ) * C.SMOKE_SPREAD;
    item.mesh.visible = true;
    item.mesh.position.set(
      source.x + (Math.random() - 0.5) * spread,
      source.y + C.BOX_HEIGHT + 0.12, // au-dessus du couvercle, pas dedans
      source.z + (Math.random() - 0.5) * spread
    );
    item.vy =
      C.SMOKE_RISE_MIN + Math.random() * (C.SMOKE_RISE_MAX - C.SMOKE_RISE_MIN);
    item.vx = (Math.random() - 0.5) * C.SMOKE_DRIFT;
    item.vz = (Math.random() - 0.5) * C.SMOKE_DRIFT;
    item.strength = burn;
    item.t = 0;
    this.active.push(item);
  }

  recycle(s) {
    s.mesh.visible = false;
    this.pool.push(s);
  }

  clear() {
    this.active.forEach((s) => this.recycle(s));
    this.active.length = 0;
    this.timer = 0;
  }
}

/* ------------------------------------------------------------
   Orchestration : un seul point d'entrée depuis main.js.
   ------------------------------------------------------------ */

export class Effects {
  constructor(scene) {
    this.squash = new Squash();
    this.waves = new Waves(scene);
    this.sparks = new Sparks(scene);
    this.smoke = new Smoke(scene);
    this.shakeLeft = 0;
    this.smokeSource = null;
    this.burn = 0;
  }

  /** La fumée sort du sommet de la tour : main.js lui dit où il est. */
  setSmokeSource(box, burn) {
    this.smokeSource = box;
    this.burn = burn;
  }

  /** Appelé à chaque pose. Renvoie true si la caméra doit trembler. */
  onPlace(mesh, box, perfect, streak) {
    this.squash.add(mesh, box.y);

    if (!perfect) {
      this.waves.spawn(box, {
        color: C.WAVE_COLOR,
        maxScale: C.WAVE_MAX_SCALE,
        opacity: C.WAVE_OPACITY,
        duration: C.WAVE_DURATION,
      });
      return false;
    }

    const intense = streak >= C.PERFECT_STREAK_INTENSE;
    this.waves.spawn(box, {
      color: C.WAVE_PERFECT_COLOR,
      maxScale: intense ? C.WAVE_STREAK_MAX_SCALE : C.WAVE_PERFECT_MAX_SCALE,
      opacity: intense ? C.WAVE_STREAK_OPACITY : C.WAVE_PERFECT_OPACITY,
      duration: C.WAVE_PERFECT_DURATION,
    });
    this.sparks.burst(box, intense);

    if (intense) this.shakeLeft = C.SHAKE_DURATION;
    return intense;
  }

  /**
   * Décalage de caméra du tremblement, en unités monde. Ne consomme pas de
   * temps : le compte à rebours est tenu par update(), sinon appeler cette
   * méthode une fois par axe ferait décroître le tremblement deux fois plus
   * vite que sa durée annoncée.
   */
  shakeOffset() {
    if (this.shakeLeft <= 0) return 0;
    const decay = this.shakeLeft / C.SHAKE_DURATION;
    return (Math.random() - 0.5) * 2 * C.SHAKE_AMPLITUDE * decay;
  }

  update(dt) {
    if (this.shakeLeft > 0) this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    this.squash.update(dt);
    this.waves.update(dt);
    this.sparks.update(dt);
    this.smoke.update(dt, this.smokeSource, this.burn);
  }

  clear() {
    this.squash.clear();
    this.waves.clear();
    this.sparks.clear();
    this.smoke.clear();
    this.shakeLeft = 0;
    this.smokeSource = null;
    this.burn = 0;
  }
}
