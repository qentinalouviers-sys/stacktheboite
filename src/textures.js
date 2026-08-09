/* ============================================================
   Génération procédurale des textures. Aucun fichier image :
   tout sort d'un canvas 2D.

   UNE seule texture pour toutes les boîtes, en atlas :

     moitié haute du canvas  -> tranche : carton + QENTINA, répétable
     moitié basse du canvas  -> dessus / dessous : carton uni

   Pourquoi un atlas : avec un matériau par face, une BoxGeometry coûte
   six appels de dessin. À 25 boîtes ça faisait 175 appels rien que pour
   la tour. Avec un atlas, une boîte = un seul matériau = un seul appel.

   Le découpage est vertical et la répétition horizontale : répéter les
   tranches en U ne déborde donc jamais sur la zone du couvercle.
   ============================================================ */

import * as THREE from 'three';
import * as C from './config.js';

let atlas = null;

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

/** Zone couvercle : carton crème uni, juste le grain. */
function drawCap(ctx, x, y, w, h) {
  ctx.fillStyle = C.CARDBOARD_COLOR;
  ctx.fillRect(x, y, w, h);
  addGrain(ctx, x, y, w, h, C.GRAIN_ALPHA);
}

export function getAtlas() {
  if (atlas) return atlas;

  const w = C.ATLAS_WIDTH;
  const bandHeight = C.ATLAS_HEIGHT / 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = C.ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  // flipY est actif par défaut dans Three.js : la moitié HAUTE du canvas
  // correspond aux v hauts, donc à SIDE_V0..SIDE_V1 (voir config).
  drawSideBand(ctx, w, bandHeight);
  ctx.save();
  ctx.translate(0, bandHeight);
  drawCap(ctx, 0, 0, w, bandHeight);
  ctx.restore();

  atlas = new THREE.CanvasTexture(canvas);
  atlas.wrapS = THREE.RepeatWrapping; // répétition horizontale des tranches
  atlas.wrapT = THREE.ClampToEdgeWrapping;
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  return atlas;
}

/** Le filtrage anisotrope sauve la lisibilité du texte vu de biais. */
export function setAnisotropy(value) {
  if (!atlas) return;
  atlas.anisotropy = value;
  atlas.needsUpdate = true;
}
