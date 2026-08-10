/* ============================================================
   Partage.

   Instagram et TikTok n'acceptent pas un simple partage de texte : leurs
   entrées n'apparaissent dans la feuille de partage native que si on
   partage une IMAGE. On génère donc une carte au format story
   (1080 x 1920) avec le score, et on la passe à navigator.share.

   Trois niveaux de repli, du meilleur au plus rustique :
     1. partage natif d'un fichier image   -> Instagram, TikTok, WhatsApp...
     2. partage natif de texte + lien      -> iOS ancien, Firefox Android
     3. copie dans le presse-papier        -> ordinateur de bureau
   ============================================================ */

import * as C from './config.js?v=4af5982';

/* --- Génération de la carte --------------------------------- */

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Une pile de boîtes en isométrie, dessinée en 2D. */
function drawStack(ctx, cx, baseY, count, unit) {
  const half = unit * 1.35;
  const rise = unit * 0.7;
  const thickness = unit * 0.34;

  for (let i = 0; i < count; i++) {
    const y = baseY - i * thickness;
    const wobble = Math.sin(i * 1.1) * unit * 0.12;
    const x = cx + wobble;
    const shade = 1 - Math.min(0.55, i / (count * 1.5));

    // Tranches
    ctx.fillStyle = `rgba(${Math.round(214 * shade)}, ${Math.round(
      208 * shade
    )}, ${Math.round(196 * shade)}, 1)`;
    ctx.beginPath();
    ctx.moveTo(x - half, y - rise / 2);
    ctx.lineTo(x, y);
    ctx.lineTo(x + half, y - rise / 2);
    ctx.lineTo(x + half, y - rise / 2 + thickness);
    ctx.lineTo(x, y + thickness);
    ctx.lineTo(x - half, y - rise / 2 + thickness);
    ctx.closePath();
    ctx.fill();

    // Couvercle
    ctx.fillStyle = `rgba(${Math.round(244 * shade)}, ${Math.round(
      241 * shade
    )}, ${Math.round(234 * shade)}, 1)`;
    ctx.beginPath();
    ctx.moveTo(x - half, y - rise / 2);
    ctx.lineTo(x, y - rise);
    ctx.lineTo(x + half, y - rise / 2);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }
}

export function buildShareCanvas({ score, pseudo, best }) {
  const w = C.SHARE_IMAGE_WIDTH;
  const h = C.SHARE_IMAGE_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Fond : le même dégradé nuit que le jeu, avec la lueur du four en bas.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#050710');
  sky.addColorStop(0.62, '#141726');
  sky.addColorStop(1, '#2c1a10');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w / 2, h * 1.02, 0, w / 2, h * 1.02, w * 0.9);
  glow.addColorStop(0, 'rgba(255, 122, 24, 0.55)');
  glow.addColorStop(1, 'rgba(255, 122, 24, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  drawStack(ctx, w / 2, h * 0.82, Math.min(24, Math.max(4, score)), w * 0.16);

  ctx.textAlign = 'center';

  // Marque
  ctx.font = '700 46px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(246, 242, 234, 0.72)';
  let x = w / 2;
  const brand = 'QENTINA';
  const spacing = 46 * 0.34;
  let total = 0;
  for (const ch of brand) total += ctx.measureText(ch).width;
  total += spacing * (brand.length - 1);
  x = w / 2 - total / 2;
  ctx.textAlign = 'left';
  for (const ch of brand) {
    ctx.fillText(ch, x, h * 0.14);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = 'center';

  ctx.font = '600 34px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(246, 242, 234, 0.42)';
  ctx.fillText('BOÎTES EMPILÉES', w / 2, h * 0.245);

  // Le score
  ctx.font = '200 330px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#f6f2ea';
  ctx.fillText(String(score), w / 2, h * 0.42);

  if (pseudo) {
    ctx.font = '600 44px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#e8b44a';
    ctx.fillText(pseudo, w / 2, h * 0.48);
  }

  if (best && best > score) {
    ctx.font = '500 34px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(246, 242, 234, 0.4)';
    ctx.fillText(`Record : ${best}`, w / 2, h * 0.535);
  }

  // Pied de carte
  const pad = 54;
  const boxH = 108;
  roundedRect(ctx, pad, h - pad - boxH, w - pad * 2, boxH, boxH / 2);
  ctx.fillStyle = 'rgba(246, 242, 234, 0.1)';
  ctx.fill();
  ctx.font = '600 36px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(246, 242, 234, 0.8)';
  ctx.fillText('QENTINA STACK · Louviers', w / 2, h - pad - boxH / 2 + 13);

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/* --- Partage ------------------------------------------------- */

function messageFor(score, pseudo) {
  const who = pseudo ? `${pseudo} a` : "J'ai";
  return `${who} empilé ${score} boîte${score > 1 ? 's' : ''} chez QENTINA. Tu fais mieux ?`;
}

/**
 * Renvoie comment le partage s'est terminé : 'shared', 'copied', 'downloaded'
 * ou 'cancelled'. L'appelant s'en sert pour le message à l'écran.
 */
export async function share({ score, pseudo, best }) {
  const text = messageFor(score, pseudo);

  // 1. Image en natif — c'est le seul chemin qui fait apparaître Instagram
  //    et TikTok dans la feuille de partage.
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await canvasToBlob(buildShareCanvas({ score, pseudo, best }));
      if (blob) {
        const file = new File([blob], 'qentina-stack.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text, title: C.SHARE_TITLE });
          return 'shared';
        }
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return 'cancelled';
      // sinon on tombe sur le repli suivant
    }
  }

  // 2. Texte et lien en natif.
  if (navigator.share) {
    try {
      await navigator.share({ text, title: C.SHARE_TITLE, url: C.SHARE_URL });
      return 'shared';
    } catch (error) {
      if (error && error.name === 'AbortError') return 'cancelled';
    }
  }

  // 3. Presse-papier.
  try {
    await navigator.clipboard.writeText(`${text} ${C.SHARE_URL}`);
    return 'copied';
  } catch {
    /* dernier repli plus bas */
  }

  // 4. Téléchargement de l'image.
  try {
    const blob = await canvasToBlob(buildShareCanvas({ score, pseudo, best }));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qentina-stack.png';
    link.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
