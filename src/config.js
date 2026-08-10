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

// Atlas 1024 x 1024, en quatre bandes de 1024 x 256 :
//   trois états de tranche (intacte, roussie, calcinée) puis le couvercle.
// Une bande de tranche fait 1024 x 256, et 1024 * BOX_HEIGHT /
// TEXTURE_REF_LENGTH = 256 exactement : aucune déformation du texte.
export const ATLAS_WIDTH = 1024;
export const ATLAS_HEIGHT = 1024;

// Sous-zones en coordonnées UV. Les marges évitent que le filtrage bilinéaire
// et les mipmaps ne fassent baver une bande sur sa voisine.
export const SIDE_BANDS = [
  { v0: 0.7520, v1: 0.9980 }, // carton intact
  { v0: 0.5020, v1: 0.7480 }, // roussi
  { v0: 0.2520, v1: 0.4980 }, // calciné
];
// La bande couvercle est découpée en trois colonnes, une par état de brûlure :
// sans ça le dessus d'une boîte reste crème alors que ses tranches sont noires.
export const CAP_BANDS = [
  { u0: 0.020, u1: 0.310 },
  { u0: 0.353, u1: 0.643 },
  { u0: 0.687, u1: 0.977 },
];
export const CAP_V0 = 0.035;
export const CAP_V1 = 0.215;
// Un couvercle est moins exposé qu'une tranche : il roussit moins fort.
export const CAP_SCORCH_RATIO = 0.6;

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

/* --- Le carton qui brûle ------------------------------------ */

// Rien ne brûle avant BURN_START_LEVEL : les premières boîtes doivent être
// impeccables, sinon l'effet n'a pas de point de comparaison et on croit à
// une texture sale. Ensuite la brûlure monte jusqu'à BURN_FULL_LEVEL.
export const BURN_START_LEVEL = 12;
export const BURN_FULL_LEVEL = 55;

// Teinte vers laquelle la boîte dérive une fois complètement calcinée. Elle
// s'applique PAR-DESSUS la rampe de chaleur : les paliers de texture donnent
// les marques, la teinte donne la progression continue entre deux paliers.
// Volontairement discrète : une teinte trop sombre écrase la texture et le
// carton lit « brun uni » au lieu de « brûlé ». Ce sont les marques qui
// doivent porter l'effet, pas l'assombrissement global.
export const CHAR_TINT = { h: 26, s: 0.20, l: 0.68 };

export const SCORCH_BLOTCHES = 44;
export const SCORCH_BLOTCH_COLOR = '42, 22, 10';
export const SCORCH_EDGE_COLOR = '18, 9, 4';
export const SCORCH_EMBER_COLOR = '#ff7a24';
export const SCORCH_EMBER_SPECKS = 22;

/* --- La fumée de la tour ------------------------------------ */

export const SMOKE_MAX = 14;
export const SMOKE_TEXTURE_SIZE = 128;
export const SMOKE_COLOR = 0xbdb5ac;
export const SMOKE_INTERVAL = 0.2; // à brûlure maximale
export const SMOKE_RISE_MIN = 0.55;
export const SMOKE_RISE_MAX = 1.15;
export const SMOKE_DRIFT = 0.28;
export const SMOKE_LIFE = 2.6;
export const SMOKE_SIZE_START = 0.85;
export const SMOKE_SIZE_END = 3.6;
export const SMOKE_OPACITY = 0.62;
export const SMOKE_SPREAD = 0.7; // part de l'empreinte de la boîte

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

// Socle cylindrique, comme le vrai four et comme la scène de cuisine fournie.
export const OVEN_BASE_RADIUS = 1.62;
export const OVEN_BASE_HEIGHT = 1.25;
export const OVEN_DOME_RADIUS = 1.62;
export const OVEN_DOME_FLATTEN = 0.60; // la coupole napolitaine est surbaissée
export const OVEN_MOUTH_WIDTH = 1.25;
export const OVEN_MOUTH_HEIGHT = 1.05;
export const OVEN_STONE_COLOR = 0x8a837a; // linteau et tablette en pierre
// Conduit d'extraction : montée verticale, coude, départ horizontal, et les
// anneaux de jointure. C'est une silhouette très reconnaissable de cuisine pro.
export const OVEN_FLUE_COLOR = 0xdfe2e4;
export const OVEN_FLUE_RADIUS = 0.34;
export const OVEN_FLUE_HEIGHT = 1.3;
export const OVEN_FLUE_ARM_LENGTH = 2.1;
export const OVEN_FLUE_RING_RADIUS = 0.03;

// Mur derrière le four. En marbre clair il virait au rose sous la lumière du
// feu et volait la lecture aux boîtes : on garde un mur sombre, qui détache la
// coupole du fond sans se faire remarquer.
export const OVEN_BACKSPLASH = { width: 4.4, height: 1.9, depth: 0.16 };
export const OVEN_BACKSPLASH_COLOR = 0x413733;

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
export const MOSAIC_GROUT_COLOR = '#1c1a17';
// Cuivre, or, bronze, terre : c'est le mélange carreau par carreau qui fait
// la faïence, un or uni lit comme de la peinture.
export const MOSAIC_COLORS = [
  '#b87333',
  '#d4af37',
  '#a0522d',
  '#cd7f32',
  '#8b4513',
  '#c98a4b',
];
export const MOSAIC_HIGHLIGHT = 'rgba(255, 255, 255, 0.08)';
export const MOSAIC_SPECULAR = 0xffd98c;
export const MOSAIC_SHININESS = 64;
// Volontairement moins de carreaux que dans la réalité : à l'échelle où la
// coupole est vue, de vrais carreaux de 2 cm partent en bouillie de mipmap et
// on perd les joints noirs, qui sont tout le caractère du four.
export const MOSAIC_REPEAT_DOME = { x: 1.0, y: 0.55 };
export const MOSAIC_REPEAT_BASE = 1.1;

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
export const COUNTER_WOOD_COLOR = 0xc19a6b; // comptoir de service

// Plan de travail inox avec évier, robinet et vitrine de préparation.
export const STEEL_POSITION = { x: -3.0, y: 0, z: -6.2 };
export const STEEL_SIZE = { x: 2.6, y: 0.95, z: 1.1 };
export const STEEL_COLOR = 0x9aa0a6;
export const STEEL_SPECULAR = 0xffffff;
export const STEEL_SHININESS = 90;
export const GLASS_COLOR = 0xaaddff;
export const GLASS_OPACITY = 0.2;

export const MARBLE_TEXTURE_SIZE = 512;
export const MARBLE_BASE_COLOR = '#dcd8d2';
export const MARBLE_VEIN_COLOR = 'rgba(86, 74, 68, 0.26)';
export const MARBLE_VEINS = 7;
export const MARBLE_REPEAT = 0.75;

// Les bûches sont rangées sous le four, comme sur la photo.
export const LOG_COLOR = 0x6b5236;
export const LOG_COUNT = 5;

// Fausse ombre douce sous la tour : une DirectionalLight qui suit la caméra
// projette un pâté qui se détache. Un disque dégradé posé au sol, lui, reste
// juste sous la tour.
export const TOWER_SHADOW_SIZE = 5.4;
export const TOWER_SHADOW_OPACITY = 0.5;

/* --- Effets de pose (§3) ------------------------------------ */

// Écrasement de la boîte posée. Deux phases explicites plutôt qu'une élastique
// paramétrique : montée en ease-out jusqu'à 1 + SQUASH_OVERSHOOT, puis retour
// en smoothstep jusqu'à 1. Le dépassement vaut donc exactement la valeur
// demandée, au lieu de dépendre d'une constante magique d'easing.
export const SQUASH_SCALE = 0.72;
export const SQUASH_DURATION = 0.18;
export const SQUASH_OVERSHOOT = 0.06;
export const SQUASH_PEAK_AT = 0.55; // part de la durée passée à monter

// Onde au sol. Le rayon de départ suit la taille de la boîte posée, donc une
// petite boîte fait une petite onde : le feedback reste proportionné.
export const WAVE_SEGMENTS = 44;
export const WAVE_INNER_RATIO = 0.86; // anneau fin
export const WAVE_POOL_MAX = 8;
// La spec fait naître l'onde à 0. Mais elle naît sur le dessus de la boîte
// posée, et une onde blanc cassé sur un carton blanc, à l'intérieur de
// l'empreinte de la boîte, est strictement invisible : la moitié de
// l'animation était perdue. Elle démarre donc au bord de la boîte.
export const WAVE_START_SCALE = 0.85;
export const WAVE_DURATION = 0.32;
export const WAVE_MAX_SCALE = 2.5;
export const WAVE_OPACITY = 0.5;
export const WAVE_COLOR = 0xf4f1ea;

export const WAVE_PERFECT_DURATION = 0.26;
export const WAVE_PERFECT_MAX_SCALE = 3.2;
export const WAVE_PERFECT_OPACITY = 0.62;
export const WAVE_PERFECT_COLOR = 0xe8b44a;
export const WAVE_STREAK_OPACITY = 0.82; // à partir de PERFECT_STREAK_INTENSE
export const WAVE_STREAK_MAX_SCALE = 3.8;

// Particules dorées du perfect.
export const SPARK_COUNT_MIN = 8;
export const SPARK_COUNT_MAX = 14;
// Plafond du nombre de particules simultanées. Sans lui, quatre perfects
// enchaînés en faisaient coexister 69, soit 69 appels de dessin de plus, et
// le pool débordait donc on réallouait en pleine partie. Au plafond, les plus
// anciennes sont recyclées : le pool se remplit une fois et ne bouge plus.
export const SPARK_MAX = 26;
export const SPARK_SIZE = 0.11;
export const SPARK_SPEED_MIN = 2.2;
export const SPARK_SPEED_MAX = 4.4;
export const SPARK_RISE = 1.7;
export const SPARK_GRAVITY = -18;
export const SPARK_DURATION = 0.6;
export const SPARK_COLOR = 0xffd070;

// Tremblement de caméra à partir de PERFECT_STREAK_INTENSE perfects d'affilée.
export const SHAKE_AMPLITUDE = 0.04;
export const SHAKE_DURATION = 0.15;

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

/* --- Compte joueur ------------------------------------------ */

// Vide tant qu'il n'y a pas de serveur. Dès qu'un endpoint est renseigné ici,
// account.js lui envoie les inscriptions et les scores. Contrat de l'API
// documenté dans le README. Tant que c'est vide, RIEN ne quitte le téléphone.
export const ACCOUNT_ENDPOINT = '';
export const ACCOUNT_TIMEOUT_MS = 6000;

export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 20;
// Lettres accentuées comprises, plus espace, tiret, souligné et point.
export const PSEUDO_PATTERN = /^[\p{L}\p{N} ._-]{2,20}$/u;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Le RGPD exige un consentement LIBRE : la CNIL considère qu'un consentement
// marketing qui conditionne l'accès à un service n'est pas valide. Passer
// cette constante à false rend la case facultative, sans rien changer d'autre.
export const MARKETING_CONSENT_REQUIRED = true;

// Âge du consentement numérique en France.
export const MIN_AGE = 15;

// Version des conditions acceptées. À incrémenter à CHAQUE modification du
// texte : les consentements sont horodatés avec cette version, c'est ce qui
// permet de prouver à quoi le joueur a consenti, et de savoir qui doit
// re-consentir après une mise à jour.
export const LEGAL_VERSION = '2026-08-10';
export const LEGAL_URL = './legal.html';

/* --- Rétention et gamification (§8) ------------------------- */

export const STORAGE_KEY = 'qentina_stack_v1';

// Paliers de récompense. Le code est généré côté client : il est trivialement
// falsifiable, c'est un geste commercial et pas un bon de réduction sérieux.
// Voir rewards.js pour le point d'accroche serveur.
export const REWARD_TIERS = [
  { boxes: 15, label: 'Un café offert' },
  { boxes: 30, label: 'Une boisson offerte' },
  { boxes: 50, label: 'Un dessert offert' },
];
export const REWARD_PREFIX = 'QEN';

// Badges. Le seuil `burn` correspond au niveau où le carton commence à roussir,
// histoire que l'effet de brûlure serve aussi de jalon.
export const BADGES = [
  { id: 'premiere-tour', icon: '🍕', label: 'Première tour', hint: '10 boîtes empilées' },
  { id: 'belle-serie', icon: '✨', label: 'Belle série', hint: '5 perfects d\'affilée' },
  { id: 'main-sure', icon: '🎯', label: 'Main sûre', hint: '10 perfects d\'affilée' },
  { id: 'carton-roussi', icon: '🔥', label: 'Ça chauffe', hint: '12 boîtes : le carton roussit' },
  { id: 'carton-calcine', icon: '🌋', label: 'Carton calciné', hint: '55 boîtes' },
  { id: 'habitue', icon: '🧑‍🍳', label: 'Habitué', hint: '10 parties jouées' },
  { id: 'maison', icon: '🏆', label: 'Record maison', hint: '50 boîtes' },
];

/* --- Partage ------------------------------------------------ */

export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1920;
export const SHARE_URL = 'https://qentinalouviers-sys.github.io/stacktheboite/';
export const SHARE_TITLE = 'QENTINA STACK';
