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

// Spec d'origine : ±12. Ramené à ±3.5 car avec la caméra isométrique
// l'axe X se projette à l'écran avec un facteur 1/sqrt(3) ~ 0.577, et une
// boîte pleine ajoute (sizeX + sizeZ)/2 * 0.577 ~ 1.73 unités d'emprise
// écran. À ±3.5 l'extrémité de la course tombe à 3.75 unités du centre,
// ce qui tient dans la demi-largeur garantie par VIEW_WIDTH_MIN — et,
// surtout, permet un frustum plus serré donc des boîtes plus grosses
// à l'écran, ce qui manquait le plus en portrait.
export const SPAWN_OFFSET = 3.5;
export const TRAVEL_LIMIT = 3.5;

// Ralenti par rapport à la spec (6.0 / 0.28 / 22.0). Le plafond à 22 u/s
// rendait le perfect inatteignable : la fenêtre fait 0.24 unité alors qu'un
// frame à 60 fps déplaçait la boîte de 0.37 unité. À 12 u/s le pas d'un
// frame vaut 0.20 unité, le perfect reste jouable jusqu'au plafond.
export const SPEED_START = 4.2;
export const SPEED_PER_LEVEL = 0.16;
export const SPEED_MAX = 12.0;

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
export const VIEW_WIDTH_MIN = 7.8;
export const VIEW_HEIGHT_MIN = 9.0;

export const CAMERA_NEAR = -200;
export const CAMERA_FAR = 400;

// Lerp exponentiel : camY += (targetY - camY) * (1 - exp(-k * dt))
export const CAMERA_LERP = 6.0;

// Où poser le sommet de la tour à l'écran, en fraction de hauteur depuis le
// haut. 0.42 = un peu au-dessus du centre : la place au-dessus sert au score
// et à la boîte qui glisse, et tout le reste de l'écran montre la tour qui
// plonge. C'est ce réglage, plus que la taille des boîtes, qui décide si le
// jeu a l'air cadré ou perdu dans le vide.
export const TOWER_TOP_SCREEN_FRACTION = 0.42;

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

export const EDGE_COLOR = 0x2a2118;
export const EDGE_OPACITY = 0.5;

/* --- Texture carton QENTINA --------------------------------- */

// Longueur monde couverte par un motif de texture. Les UV des tranches sont
// mises à l'échelle de largeur/TEXTURE_REF_LENGTH à chaque redimensionnement :
// les lettres gardent donc TOUJOURS la même taille physique, quelle que soit
// la largeur de la boîte. C'est ce qui empêche QENTINA de s'étirer après
// vingt découpes. Le motif reste par ailleurs centré sur la tranche.
export const TEXTURE_REF_LENGTH = 2.4;

// Atlas 1024 x 512 : moitié haute = tranche, moitié basse = couvercle.
// La bande de tranche fait donc 1024 x 256, et 1024 * BOX_HEIGHT /
// TEXTURE_REF_LENGTH = 256 exactement : aucune déformation du texte.
export const ATLAS_WIDTH = 1024;
export const ATLAS_HEIGHT = 512;

// Sous-zones en coordonnées UV. Les marges évitent que le filtrage bilinéaire
// et les mipmaps ne fassent baver une zone sur l'autre.
export const SIDE_V0 = 0.503;
export const SIDE_V1 = 0.997;
export const CAP_U0 = 0.06;
export const CAP_U1 = 0.44;
export const CAP_V0 = 0.06;
export const CAP_V1 = 0.44;

export const CARDBOARD_COLOR = '#F4F1EA'; // pas de blanc pur : il crame en lumière chaude
export const BRAND_TEXT = 'QENTINA';
export const BRAND_COLOR = '#111111';
export const BRAND_LETTER_SPACING = 0.16; // en em
export const BRAND_WIDTH_RATIO = 0.70; // part du motif occupée par le mot
export const BRAND_BASELINE_RATIO = 0.46; // hauteur du texte sur la tranche
export const BRAND_FONT = '700 100px "Helvetica Neue", Helvetica, Arial, sans-serif';

export const SEAM_COLOR = 'rgba(60, 45, 30, 0.16)'; // rainure couvercle / socle
export const SEAM_POSITION_RATIO = 0.78;
export const SEAM_THICKNESS = 3;

export const GRAIN_ALPHA = 0.04; // grain de carton, très faible

/* --- Rampe de teinte des boîtes selon la hauteur (§4) ------- */

// Ces valeurs multiplient la texture crème : on reste sur du carton blanc,
// la dérive est une chaleur qui monte, pas un changement de couleur.
export const COLOR_RAMP_LEVELS = 60;
export const COLOR_START = { h: 35, s: 0.10, l: 0.99 };
export const COLOR_END = { h: 15, s: 0.22, l: 0.86 };

// Boîte « signature » tous les N niveaux : liseré doré.
export const SIGNATURE_EVERY = 10;
export const SIGNATURE_EDGE_COLOR = 0xd8a13a;
export const SIGNATURE_EDGE_OPACITY = 0.95;

/* --- Fond dégradé (§4 : salle chaude en bas, nuit en haut) -- */

export const BACKGROUND_LEVELS = 25; // transition étalée sur les 25 premiers niveaux
export const BG_TOP_START = { h: 20, s: 38, l: 7 };
export const BG_BOTTOM_START = { h: 27, s: 52, l: 24 };
export const BG_TOP_END = { h: 236, s: 46, l: 4 };
export const BG_BOTTOM_END = { h: 224, s: 38, l: 17 };

// Lueur du four, en bas de cadre. Elle s'éteint à mesure qu'on quitte la salle.
export const BG_GLOW = { h: 24, s: 90, l: 52 };
export const BG_GLOW_ALPHA_START = 0.22;
export const BG_GLOW_ALPHA_END = 0.0;

/* --- Lumières (le four du §4 les remplacera) ---------------- */

// Une HemisphereLight plutôt qu'une ambiante uniforme : les tranches
// verticales reçoivent la moyenne ciel/sol et restent claires, ce qui est
// la condition pour que le carton lise BLANC et pas gris. Le ciel dérive
// du chaud (four, en bas) vers le bleu nuit (en haut).
export const HEMI_SKY_START = { h: 28, s: 0.26, l: 0.92 };
export const HEMI_SKY_END = { h: 222, s: 0.22, l: 0.90 };
export const HEMI_GROUND_COLOR = 0xefe7dd; // rebond chaud de la salle
export const HEMI_INTENSITY = 1.75;

export const KEY_LIGHT_COLOR = 0xfff0d8;
export const KEY_LIGHT_INTENSITY = 0.55; // juste de quoi sculpter et porter l'ombre
export const KEY_LIGHT_POSITION = { x: 5, y: 16, z: 4 };

/* --- Décor : le four napolitain (§4) ------------------------ */

// Le four est posé dans le coin arrière-gauche, hors du volume balayé par la
// boîte en mouvement. Celle-ci décrit une croix (|x| jusqu'à 5 avec z ~ 0, et
// l'inverse) : la diagonale arrière est donc libre.
export const OVEN_POSITION = { x: -5.4, y: 0, z: -2.7 };
export const OVEN_ROTATION_Y = 0.62; // la bouche tournée vers la caméra
// La caméra est orthographique : rien ne rapetisse avec la distance. Un four
// à sa taille réelle par rapport à une boîte à pizza occuperait tout l'écran.
// On triche donc à l'échelle, et le cerveau lit « four au fond de la salle ».
export const OVEN_SCALE = 0.62;

export const OVEN_BASE_SIZE = 3.2;
export const OVEN_BASE_HEIGHT = 1.25;
export const OVEN_DOME_RADIUS = 1.62;
export const OVEN_DOME_FLATTEN = 0.78; // la coupole napolitaine est surbaissée
export const OVEN_MOUTH_WIDTH = 1.25;
export const OVEN_MOUTH_HEIGHT = 1.05;
export const OVEN_STONE_COLOR = 0x9d968c; // linteau et tablette en pierre
export const OVEN_FLUE_COLOR = 0x6e6a66; // conduit d'extraction, acier terni
export const OVEN_FLUE_RADIUS = 0.34;
export const OVEN_FLUE_HEIGHT = 1.5;

/* --- Braises qui montent du four ----------------------------- */

export const EMBER_COUNT = 9;
export const EMBER_SIZE = 0.07;
export const EMBER_RISE_MIN = 0.9;
export const EMBER_RISE_MAX = 1.8;
export const EMBER_DRIFT = 0.35;
export const EMBER_LIFE_MIN = 1.6;
export const EMBER_LIFE_MAX = 3.2;
export const EMBER_COLOR = 0xff9a3c;
export const EMBER_SPREAD = 0.5;
export const OVEN_DARK_COLOR = 0x2b231c; // encadrement de bouche, intérieur

export const MOSAIC_TEXTURE_SIZE = 512;
export const MOSAIC_TILE = 32;
export const MOSAIC_GROUT = 5;
export const MOSAIC_GROUT_COLOR = '#0b0a09';
export const MOSAIC_GOLD = { h: 36, s: 42, l: 31 };
export const MOSAIC_JITTER = 0.14; // variation de luminosité par carreau
export const MOSAIC_SPECULAR = 0xffd98c;
export const MOSAIC_SHININESS = 64;
// Volontairement moins de carreaux que dans la réalité : à l'échelle où la
// coupole est vue, de vrais carreaux de 2 cm partent en bouillie de mipmap et
// on perd les joints noirs, qui sont tout le caractère du four.
export const MOSAIC_REPEAT_DOME = { x: 1.6, y: 0.9 };
export const MOSAIC_REPEAT_BASE = 1.5;

/* --- Le feu -------------------------------------------------- */

export const FIRE_COLOR = 0xff7a18;
export const FIRE_LIGHT_INTENSITY = 5.5;
export const FIRE_LIGHT_DISTANCE = 18;
export const FIRE_LIGHT_DECAY = 1.6;
export const FIRE_FLICKER_HZ = 6;
export const FIRE_FLICKER_MIN = 0.8;
export const FIRE_FLICKER_MAX = 1.25;
export const FIRE_FLASH_FACTOR = 1.5; // flash au perfect (§3)
export const FIRE_FLASH_DURATION = 0.12;

/* --- La salle ------------------------------------------------ */

export const FLOOR_SIZE = 26;
export const FLOOR_TEXTURE_SIZE = 512;
export const FLOOR_TILE = 64;
export const FLOOR_REPEAT = 5;
export const FLOOR_GROUT = '#191520';

// En avant-plan à droite : le plan de travail passe devant la base de la
// tour, ce qui donne de la profondeur à une scène sans perspective.
export const COUNTER_POSITION = { x: 6.0, y: 0, z: 2.5 };
export const COUNTER_SIZE = { x: 3.8, y: 0.16, z: 1.5 };
export const COUNTER_HEIGHT = 1.1;
export const COUNTER_MARBLE_COLOR = 0x8e8880;
export const COUNTER_BASE_COLOR = 0x2b2730;

export const LOG_RACK_POSITION = { x: -2.6, y: 0, z: -6.2 };
export const LOG_COLOR = 0x6b5236;
export const LOG_COUNT = 6;

// Fausse ombre douce sous la tour : une DirectionalLight qui suit la caméra
// projette un pâté qui se détache. Un disque dégradé posé au sol, lui, reste
// juste sous la tour.
export const TOWER_SHADOW_SIZE = 5.4;
export const TOWER_SHADOW_OPACITY = 0.5;

/* --- Haptique (§6) ------------------------------------------ */

export const HAPTIC_PLACE = 10;
export const HAPTIC_PERFECT = [0, 14, 30, 22];
export const HAPTIC_PERFECT_STREAK = [0, 18, 25, 18, 25, 30];
export const HAPTIC_GAME_OVER = [0, 40, 70, 90];

// L'ombre portée au sol est désactivée en v0 : projetée depuis une lumière
// qui suit la caméra, elle se détache de la tour en un pâté noir à mesure
// qu'on monte. Le §4 prévoit une fausse ombre douce sous la tour, elle
// arrivera avec le décor. Les boîtes s'ombrent entre elles, ce qui est ce
// qui compte pour lire les débords.
export const GROUND_RECEIVES_SHADOW = false;

/* --- Rétention (§8, branché à l'étape 4) -------------------- */

export const STORAGE_KEY = 'qentina_stack_v1';
export const REWARD_TIERS = [15, 30, 50];
