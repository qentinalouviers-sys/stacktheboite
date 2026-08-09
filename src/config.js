/* ============================================================
   QENTINA STACK — toutes les constantes de tuning du jeu.
   Aucun nombre magique ailleurs dans le code : si tu veux
   retoucher le feel, tout se passe ici.
   ============================================================ */

/* --- Boîte -------------------------------------------------- */

export const BOX_SIZE_X = 3.0;
export const BOX_SIZE_Z = 3.0;
export const BOX_HEIGHT = 0.6;

/* --- Déplacement de la boîte -------------------------------- */

// Spec d'origine : ±12. Ramené à ±4.5 car avec la caméra isométrique
// l'axe X se projette à l'écran avec un facteur 1/sqrt(3) ~ 0.577, et une
// boîte pleine ajoute (sizeX + sizeZ)/2 * 0.577 ~ 1.73 unités d'emprise
// écran. À ±4.5 l'extrémité de la course tombe à 4.33 unités du centre,
// soit juste dans la demi-largeur de 4.5 garantie par VIEW_WIDTH_MIN.
// Au-delà, la boîte disparaît du cadre à chaque bout de course.
export const SPAWN_OFFSET = 4.5;
export const TRAVEL_LIMIT = 4.5;

export const SPEED_START = 6.0;
export const SPEED_PER_LEVEL = 0.28;
export const SPEED_MAX = 22.0;

// Clamp du delta de la boucle de rendu : sans lui, un retour d'onglet
// projette la boîte à l'autre bout du monde en un frame.
export const MAX_FRAME_DELTA = 0.05;

/* --- Perfect ------------------------------------------------ */

export const PERFECT_TOLERANCE = 0.12;
export const PERFECT_REGAIN = 0.06;
export const PERFECT_STREAK_INTENSE = 5;

/* --- Caméra ------------------------------------------------- */

export const CAMERA_OFFSET_X = 6;
export const CAMERA_OFFSET_Y = 6;
export const CAMERA_OFFSET_Z = 6;

// Le frustum garantit AU MOINS cette largeur ET cette hauteur monde.
// En portrait c'est la largeur qui commande (sinon la boîte de 3 unités
// ne tient pas à l'écran), en paysage c'est la hauteur.
export const VIEW_WIDTH_MIN = 9.0;
export const VIEW_HEIGHT_MIN = 10.0;

export const CAMERA_NEAR = -200;
export const CAMERA_FAR = 400;

// Lerp exponentiel : camY += (targetY - camY) * (1 - exp(-k * dt))
export const CAMERA_LERP = 6.0;

// Le sommet de la tour est placé sous le centre de l'écran, d'une
// fraction de la hauteur du frustum, pour laisser voir la boîte qui glisse.
export const CAMERA_LOOK_AHEAD_RATIO = 0.12;

/* --- Game over ---------------------------------------------- */

export const GAMEOVER_ZOOM_OUT = 1.25;
export const GAMEOVER_ZOOM_DURATION = 0.9;
export const GAMEOVER_SCREEN_DELAY = 0.7;

/* --- Fragments qui tombent ---------------------------------- */

export const FRAGMENT_SPEED_H = 2.2;
export const FRAGMENT_SPEED_V = 1.0;
export const GRAVITY = -32;
export const FRAGMENT_SPIN_MIN = 1.8;
export const FRAGMENT_SPIN_RANGE = 1.2;
export const FRAGMENT_CULL_BELOW = 15;
export const FRAGMENT_POOL_MAX = 12;

/* --- Rendu -------------------------------------------------- */

export const MAX_VISIBLE_BOXES = 25;
export const MAX_PIXEL_RATIO = 2;
export const BACKGROUND_COLOR = 0x15121b; // v0 — remplacé par le dégradé (§4)
export const FOG_COLOR = 0x15121b;

export const EDGE_COLOR = 0x3a3229;
export const EDGE_OPACITY = 0.45;

/* --- Rampe de couleur des boîtes selon la hauteur (§4) ------ */

export const COLOR_RAMP_LEVELS = 60;
export const COLOR_START = { h: 35, s: 0.18, l: 0.88 };
export const COLOR_END = { h: 15, s: 0.26, l: 0.82 };

// Boîte « signature » tous les N niveaux : liseré doré.
export const SIGNATURE_EVERY = 10;
export const SIGNATURE_EDGE_COLOR = 0xd8a13a;
export const SIGNATURE_EDGE_OPACITY = 0.95;

/* --- Lumières (v0, remplacées par le four en §4) ------------ */

export const AMBIENT_COLOR = 0x7f889c;
export const AMBIENT_INTENSITY = 1.05;
export const KEY_LIGHT_COLOR = 0xffd9b0;
export const KEY_LIGHT_INTENSITY = 1.35;
export const KEY_LIGHT_POSITION = { x: 5, y: 16, z: 4 };

// L'ombre portée au sol est désactivée en v0 : projetée depuis une lumière
// qui suit la caméra, elle se détache de la tour en un pâté noir à mesure
// qu'on monte. Le §4 prévoit une fausse ombre douce sous la tour, elle
// arrivera avec le décor. Les boîtes s'ombrent entre elles, ce qui est ce
// qui compte pour lire les débords.
export const GROUND_RECEIVES_SHADOW = false;

/* --- Rétention (§8, branché à l'étape 4) -------------------- */

export const STORAGE_KEY = 'qentina_stack_v1';
export const REWARD_TIERS = [15, 30, 50];
