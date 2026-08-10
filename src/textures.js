/* ============================================================
   Génération procédurale des textures. Aucun fichier image :
   tout sort d'un canvas 2D.

   UNE seule texture pour toutes les boîtes, en atlas de quatre bandes :

     bande 0 -> tranche intacte : carton + QENTINA, répétable
     bande 1 -> tranche roussie
     bande 2 -> tranche calcinée
     bande 3 -> dessus / dessous : carton uni

   Les trois états de tranche donnent les marques de brûlure ; la teinte du
   matériau, elle, dérive en continu. On a donc une progression lisse sans
   avoir à mélanger deux textures dans un shader.

   Pourquoi un atlas : avec un matériau par face, une BoxGeometry coûte
   six appels de dessin. À 25 boîtes ça faisait 175 appels rien que pour
   la tour. Avec un atlas, une boîte = un seul matériau = un seul appel.

   Le découpage est vertical et la répétition horizontale : répéter les
   tranches en U ne déborde donc jamais sur la zone du couvercle.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js?v=4af5982';

let atlas = null;

/** Fabrique la texture Three.js à partir d'un canvas, réglages communs. */
function finish(canvas, repeat) {
  const texture = new THREE.CanvasTexture(canvas);
  const wrap = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Grain de carton : bruit monochrome de très faible amplitude. */
function addGrain(ctx, x, y, width, height, alpha) {
  const image = ctx.getImageData(x, y, width, height);
  const data = image.data;
  const amplitude = 255 * alpha;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * amplitude;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  ctx.putImageData(image, x, y);
}

/**
 * Texte en capitales avec interlettrage, dessiné caractère par caractère.
 * ctx.letterSpacing existe mais n'est pas supporté partout, et un logo qui
 * saute d'un navigateur à l'autre est pire que quelques lignes de code.
 */
function measureSpacedText(ctx, text, spacing) {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width;
  return width + spacing * (text.length - 1);
}

function drawSpacedText(ctx, text, centerX, baselineY, spacing) {
  const total = measureSpacedText(ctx, text, spacing);
  let x = centerX - total / 2;
  for (const char of text) {
    ctx.fillText(char, x, baselineY);
    x += ctx.measureText(char).width + spacing;
  }
}

/** Bande de tranche : carton crème, rainure de couvercle, QENTINA en noir. */
function drawSideBand(ctx, w, h) {
  ctx.fillStyle = C.CARDBOARD_COLOR;
  ctx.fillRect(0, 0, w, h);
  addGrain(ctx, 0, 0, w, h, C.GRAIN_ALPHA);

  // Rainure horizontale : la ligne couvercle / socle d'une boîte à pizza.
  ctx.fillStyle = C.SEAM_COLOR;
  ctx.fillRect(0, h * C.SEAM_POSITION_RATIO, w, C.SEAM_THICKNESS);

  // La police est mise à l'échelle pour que le mot occupe exactement
  // BRAND_WIDTH_RATIO du motif : rien à re-régler à la main si on change
  // le texte ou la longueur de référence.
  const probeSize = parseInt(C.BRAND_FONT.match(/(\d+)px/)[1], 10);
  ctx.font = C.BRAND_FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const probeWidth = measureSpacedText(
    ctx,
    C.BRAND_TEXT,
    probeSize * C.BRAND_LETTER_SPACING
  );
  const fontSize = Math.floor((probeSize * (w * C.BRAND_WIDTH_RATIO)) / probeWidth);

  ctx.font = C.BRAND_FONT.replace(/\d+px/, `${fontSize}px`);
  ctx.fillStyle = C.BRAND_COLOR;
  const baseline = h * C.BRAND_BASELINE_RATIO + fontSize * 0.36;
  drawSpacedText(ctx, C.BRAND_TEXT, w / 2, baseline, fontSize * C.BRAND_LETTER_SPACING);
}

/**
 * Marques de brûlure par-dessus une tranche déjà dessinée. `intensity` va de
 * 0 à 1. La chaleur vient du dessous, donc le bord bas noircit en premier.
 */
function drawScorch(ctx, w, h, intensity) {
  if (intensity <= 0) return;

  // Bord bas noirci : c'est de là que vient la chaleur.
  const edge = ctx.createLinearGradient(0, h, 0, h * 0.12);
  edge.addColorStop(0, `rgba(${C.SCORCH_EDGE_COLOR}, ${0.95 * intensity})`);
  edge.addColorStop(0.35, `rgba(${C.SCORCH_EDGE_COLOR}, ${0.5 * intensity})`);
  edge.addColorStop(1, `rgba(${C.SCORCH_EDGE_COLOR}, 0)`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  // Taches irrégulières, plus nombreuses et plus opaques vers le bas.
  const count = Math.round(C.SCORCH_BLOTCHES * intensity);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = h * (0.25 + Math.random() * 0.75);
    const r = h * (0.1 + Math.random() * 0.4);
    const alpha = (0.22 + Math.random() * 0.62) * intensity;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, `rgba(${C.SCORCH_BLOTCH_COLOR}, ${alpha})`);
    blob.addColorStop(1, `rgba(${C.SCORCH_BLOTCH_COLOR}, 0)`);
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grandes plaques quasi noires : le carton a cédé par endroits.
  if (intensity > 0.5) {
    const deep = (intensity - 0.5) / 0.5;
    for (let i = 0; i < Math.round(7 * deep); i++) {
      const x = Math.random() * w;
      const y = h * (0.45 + Math.random() * 0.55);
      const r = h * (0.22 + Math.random() * 0.3);
      const patch = ctx.createRadialGradient(x, y, 0, x, y, r);
      patch.addColorStop(0, `rgba(12, 7, 4, ${0.85 * deep})`);
      patch.addColorStop(0.6, `rgba(12, 7, 4, ${0.5 * deep})`);
      patch.addColorStop(1, 'rgba(12, 7, 4, 0)');
      ctx.fillStyle = patch;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Quelques points de braise sur le carton le plus attaqué. Sans eux, le
  // carton a l'air sale plutôt qu'en train de brûler.
  if (intensity > 0.6) {
    ctx.fillStyle = C.SCORCH_EMBER_COLOR;
    const specks = Math.round(C.SCORCH_EMBER_SPECKS * (intensity - 0.6) / 0.4);
    for (let i = 0; i < specks; i++) {
      const x = Math.random() * w;
      const y = h * (0.55 + Math.random() * 0.42);
      ctx.globalAlpha = 0.35 + Math.random() * 0.5;
      ctx.fillRect(x, y, 3 + Math.random() * 5, 2 + Math.random() * 3);
    }
    ctx.globalAlpha = 1;
  }
}

/** Zone couvercle : carton crème uni, juste le grain. */
function drawCap(ctx, x, y, w, h) {
  ctx.fillStyle = C.CARDBOARD_COLOR;
  ctx.fillRect(x, y, w, h);
  addGrain(ctx, x, y, w, h, C.GRAIN_ALPHA);
}

export function getAtlas() {
  if (atlas) return atlas;

  const w = C.ATLAS_WIDTH;
  const bands = C.SIDE_BANDS.length + 1;
  const bandHeight = C.ATLAS_HEIGHT / bands;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = C.ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  // flipY est actif par défaut dans Three.js : la bande du HAUT du canvas
  // correspond aux v les plus hauts, donc à SIDE_BANDS[0] (voir config).
  for (let i = 0; i < C.SIDE_BANDS.length; i++) {
    ctx.save();
    ctx.translate(0, i * bandHeight);
    drawSideBand(ctx, w, bandHeight);
    drawScorch(ctx, w, bandHeight, i / (C.SIDE_BANDS.length - 1));
    ctx.restore();
  }
  // Bande couvercle : une colonne par état de brûlure.
  const capTop = C.SIDE_BANDS.length * bandHeight;
  const columns = C.CAP_BANDS.length;
  const columnWidth = w / columns;
  for (let i = 0; i < columns; i++) {
    ctx.save();
    ctx.translate(i * columnWidth, capTop);
    drawCap(ctx, 0, 0, columnWidth, bandHeight);
    drawScorch(
      ctx,
      columnWidth,
      bandHeight,
      (i / (columns - 1)) * C.CAP_SCORCH_RATIO
    );
    ctx.restore();
  }

  atlas = finish(canvas, true);
  // Répétition horizontale seulement : en V, les zones tranche et couvercle
  // ne doivent jamais déborder l'une sur l'autre.
  atlas.wrapT = THREE.ClampToEdgeWrapping;
  return atlas;
}

/** Le filtrage anisotrope sauve la lisibilité du texte vu de biais. */
export function setAnisotropy(value) {
  if (!atlas) return;
  atlas.anisotropy = value;
  atlas.needsUpdate = true;
}

/* ============================================================
   Décor : mosaïque du four, carrelage de la salle, ombre au sol.
   ============================================================ */

let smokeTexture = null;
let mosaicTexture = null;
let marbleTexture = null;
let floorTexture = null;
let blobTexture = null;
let fireTexture = null;

/**
 * Faïence du four. Palette cuivre / or / bronze mélangée carreau par carreau,
 * joints sombres, et un reflet en coin sur chaque carreau : c'est ce triangle
 * clair qui donne la sensation de faïence vernie plutôt que d'aplat peint.
 */
export function getMosaicTexture() {
  if (mosaicTexture) return mosaicTexture;

  const size = C.MOSAIC_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.MOSAIC_GROUT_COLOR;
  ctx.fillRect(0, 0, size, size);

  const step = C.MOSAIC_TILE;
  const gap = C.MOSAIC_GROUT;
  const palette = C.MOSAIC_COLORS;

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.fillRect(x + gap, y + gap, step - gap * 2, step - gap * 2);

      ctx.fillStyle = C.MOSAIC_HIGHLIGHT;
      ctx.beginPath();
      ctx.moveTo(x + gap, y + gap);
      ctx.lineTo(x + step - gap, y + gap);
      ctx.lineTo(x + gap, y + step - gap);
      ctx.fill();
    }
  }

  mosaicTexture = finish(canvas, true);
  return mosaicTexture;
}

/** Marbre des plans de travail : fond très clair, veines brunes au bézier. */
export function getMarbleTexture() {
  if (marbleTexture) return marbleTexture;

  const size = C.MARBLE_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.MARBLE_BASE_COLOR;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = C.MARBLE_VEIN_COLOR;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < C.MARBLE_VEINS; i++) {
    ctx.beginPath();
    ctx.lineWidth = (Math.random() * 7 + 2) * (size / 1024);
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      const c1x = x + (Math.random() - 0.5) * size * 0.4;
      const c1y = y + (Math.random() - 0.5) * size * 0.4;
      const c2x = x + (Math.random() - 0.5) * size * 0.4;
      const c2y = y + (Math.random() - 0.5) * size * 0.4;
      x += (Math.random() - 0.5) * size * 0.5;
      y += (Math.random() - 0.5) * size * 0.5;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
    }
    ctx.stroke();
  }

  marbleTexture = finish(canvas, true);
  return marbleTexture;
}

/**
 * Sol de la salle. L'alpha s'éteint vers les bords : sans ça, le plan se
 * termine par une arête franche en plein écran et on voit qu'on est sur un
 * décor posé sur rien. Là il se fond dans le dégradé de fond.
 */
export function getFloorTexture() {
  if (floorTexture) return floorTexture;

  const size = C.FLOOR_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.FLOOR_GROUT;
  ctx.fillRect(0, 0, size, size);
  const step = C.FLOOR_TILE;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const jitter = 1 + (Math.random() - 0.5) * 0.12;
      ctx.fillStyle = `hsl(258 8% ${Math.max(3, 12 * jitter)}%)`;
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
    }
  }

  // Dégradé d'alpha vers les bords.
  const fade = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.14,
    size / 2, size / 2, size * 0.5
  );
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  floorTexture = finish(canvas, false);
  return floorTexture;
}

/** Fausse ombre douce sous la tour : un simple disque dégradé. */
export function getBlobShadowTexture() {
  if (blobTexture) return blobTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  blobTexture = finish(canvas, false);
  return blobTexture;
}

/** Braises au fond de la bouche : dégradé chaud, plus clair au centre bas. */
export function getFireTexture() {
  if (fireTexture) return fireTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#140502';
  ctx.fillRect(0, 0, size, size);

  const g = ctx.createRadialGradient(
    size * 0.5, size * 0.78, size * 0.04,
    size * 0.5, size * 0.78, size * 0.55
  );
  g.addColorStop(0, '#fff0c0');
  g.addColorStop(0.25, '#ffa326');
  g.addColorStop(0.55, '#d2450a');
  g.addColorStop(1, 'rgba(20, 5, 2, 1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Quelques bûches sombres en silhouette devant les braises.
  ctx.fillStyle = 'rgba(28, 12, 6, 0.9)';
  for (let i = 0; i < 4; i++) {
    const w = size * (0.3 + Math.random() * 0.3);
    const x = size * 0.12 + Math.random() * size * 0.5;
    const y = size * (0.74 + Math.random() * 0.16);
    ctx.fillRect(x, y, w, size * 0.055);
  }

  fireTexture = finish(canvas, false);
  return fireTexture;
}

/** Bouffée de fumée : un disque doux, bords fondus. */
export function getSmokeTexture() {
  if (smokeTexture) return smokeTexture;

  const size = C.SMOKE_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const g = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Un peu de relief, sinon la bouffée est un disque trop net.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.06 + Math.random() * 0.12);
    const hole = ctx.createRadialGradient(x, y, 0, x, y, r);
    hole.addColorStop(0, 'rgba(0,0,0,0.35)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  smokeTexture = finish(canvas, false);
  return smokeTexture;
}
