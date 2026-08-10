/* ============================================================
   Machine à états + règles du jeu.
   AUCUN code de rendu ici : ce module ne connaît pas Three.js.
   Il expose un état lisible et appelle des hooks que main.js
   traduit en visuel / son / vibration.
   ============================================================ */

import * as C from './config.js?v=4af5982';

export const State = {
  READY: 'ready', // la boîte glisse déjà, on attend le premier tap
  PLAYING: 'playing',
  FALLING: 'falling', // partie perdue, la dernière boîte tombe encore
  OVER: 'over', // écran de fin affiché, un tap relance
};

export class Game {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.reset();
  }

  reset() {
    this.state = State.READY;
    this.level = 0; // nombre de boîtes posées par le joueur = score
    this.perfectStreak = 0;
    this.bestStreak = 0;
    this.overTimer = 0;

    // La boîte de base est posée d'office, elle n'est pas comptée.
    this.tower = [
      { x: 0, z: 0, y: 0, sizeX: C.BOX_SIZE_X, sizeZ: C.BOX_SIZE_Z },
    ];

    this.hooks.onReset?.(this.tower[0]);
    this.spawn();
  }

  get top() {
    return this.tower[this.tower.length - 1];
  }

  get speed() {
    return Math.min(
      C.SPEED_START + this.level * C.SPEED_PER_LEVEL,
      C.SPEED_MAX
    );
  }

  /* --- Apparition de la boîte suivante ---------------------- */

  spawn() {
    const below = this.top;
    const index = this.tower.length; // 1, 2, 3...
    const axis = index % 2 === 1 ? 'x' : 'z'; // alternance stricte
    const side = index % 4 < 2 ? 1 : -1; // on alterne aussi le côté d'arrivée

    const box = {
      x: below.x,
      z: below.z,
      y: below.y + C.BOX_HEIGHT,
      sizeX: below.sizeX,
      sizeZ: below.sizeZ,
      axis,
      dir: -side, // elle part vers le centre
    };
    box[axis] = side * C.SPAWN_OFFSET;

    this.moving = box;
    this.hooks.onSpawn?.(box, this.level + 1);
  }

  /* --- Boucle ----------------------------------------------- */

  update(dt) {
    if (this.state === State.READY || this.state === State.PLAYING) {
      const m = this.moving;
      const axis = m.axis;
      let p = m[axis] + this.speed * m.dir * dt;

      // Ping-pong : on réfléchit le dépassement, pas de téléportation
      // et pas de perte de distance parcourue.
      if (p > C.TRAVEL_LIMIT) {
        p = 2 * C.TRAVEL_LIMIT - p;
        m.dir = -1;
      } else if (p < -C.TRAVEL_LIMIT) {
        p = -2 * C.TRAVEL_LIMIT - p;
        m.dir = 1;
      }
      m[axis] = p;
    }

    if (this.state === State.FALLING) {
      this.overTimer += dt;
      if (this.overTimer >= C.GAMEOVER_SCREEN_DELAY) {
        this.state = State.OVER;
        this.hooks.onEndScreen?.(this.level, this.bestStreak);
      }
    }
  }

  /* --- Entrée joueur ---------------------------------------- */

  tap() {
    switch (this.state) {
      case State.READY:
        this.state = State.PLAYING;
        this.hooks.onStart?.();
        this.place();
        break;
      case State.PLAYING:
        this.place();
        break;
      case State.FALLING:
        break; // on laisse la chute se terminer, aucun tap ne l'écourte
      case State.OVER:
        this.reset();
        break;
    }
  }

  /* --- Pose d'une boîte ------------------------------------- */

  place() {
    const below = this.top;
    const m = this.moving;
    const axis = m.axis;
    const sizeKey = axis === 'x' ? 'sizeX' : 'sizeZ';
    const baseSize = axis === 'x' ? C.BOX_SIZE_X : C.BOX_SIZE_Z;

    const delta = m[axis] - below[axis];
    const dist = Math.abs(delta);
    const overlap = below[sizeKey] - dist;

    if (overlap <= 0) {
      this.gameOver(Math.sign(delta) || 1);
      return;
    }

    const perfect = dist <= C.PERFECT_TOLERANCE;
    let fragment = null;

    if (perfect) {
      // Recalage exact + regain de largeur : c'est ce qui rend les
      // longues séries possibles.
      m[axis] = below[axis];
      m[sizeKey] = Math.min(baseSize, below[sizeKey] + C.PERFECT_REGAIN);
      this.perfectStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.perfectStreak);
    } else {
      const cutSize = dist;
      const newPos = below[axis] + delta / 2;
      const side = Math.sign(delta);

      fragment = {
        axis,
        dir: side,
        x: m.x,
        z: m.z,
        y: m.y,
        sizeX: m.sizeX,
        sizeZ: m.sizeZ,
      };
      fragment[sizeKey] = cutSize;
      fragment[axis] = newPos + side * (overlap + cutSize) / 2;

      m[sizeKey] = overlap;
      m[axis] = newPos;
      this.perfectStreak = 0;
    }

    const placed = {
      x: m.x,
      z: m.z,
      y: m.y,
      sizeX: m.sizeX,
      sizeZ: m.sizeZ,
    };
    this.tower.push(placed);
    this.level += 1;

    this.hooks.onPlace?.(placed, fragment, perfect, this.perfectStreak, this.level);
    this.spawn();
  }

  gameOver(side) {
    const m = this.moving;
    this.state = State.FALLING;
    this.overTimer = 0;
    this.moving = null;

    // La dernière boîte tombe intégralement.
    this.hooks.onGameOver?.(
      {
        axis: m.axis,
        dir: side,
        x: m.x,
        z: m.z,
        y: m.y,
        sizeX: m.sizeX,
        sizeZ: m.sizeZ,
      },
      this.level
    );
  }

  /* Hauteur du sommet de la tour, utilisée par la caméra. */
  get towerTopY() {
    return this.top.y + C.BOX_HEIGHT;
  }
}
