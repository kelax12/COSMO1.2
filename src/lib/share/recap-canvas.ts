// Rendu de l'image « bilan de la semaine » — story 1080×1920, <canvas> natif.
//
// Choix du rendu (P6) : canvas CLIENT plutôt que le pipeline hyperframes du
// repo cosmo-marketing. hyperframes rend de la vidéo par lots, en local, avec
// FFmpeg + Chromium : c'est un outil de production de contenu, pas un
// générateur à la demande pour un utilisateur final. Le canvas, lui, est
// natif (zéro dépendance, zéro octet de bundle en plus hors ce fichier),
// fonctionne hors ligne, en démo comme en prod, et rend en quelques
// millisecondes sur mobile. Ce module est chargé en import dynamique : il ne
// pèse sur aucun écran tant que l'utilisateur n'a pas demandé son bilan.
//
// Palette et typographie : BRAND.md du repo cosmo-marketing (fond `--night`
// #0a0a0a, texte `--snow` #f8fafc, gris `--slate` #475569, accent bleu COSMO
// #3b82f6 — le bilan couvre plusieurs modules, donc accent par défaut).
// L'image a sa propre palette figée, volontairement indépendante du thème de
// l'app : elle doit être identique pour tout le monde.
import { formatMinutes, type RecapData } from './recap-data';

export const RECAP_WIDTH = 1080;
export const RECAP_HEIGHT = 1920;
/** UI TikTok/Reels : rien d'important dans ces bandes (BRAND.md §3). */
const SAFE_TOP = 250;
const SAFE_BOTTOM = 250;

const COLORS = {
  night: '#0a0a0a',
  snow: '#f8fafc',
  slate: '#8a95a5', // --slate éclairci : #475569 est illisible sur fond noir
  accent: '#3b82f6',
  cellEmpty: '#1c1f26',
};

const FONT = (weight: number, size: number) =>
  `${weight} ${size}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Échelle de l'accent : plus le taux est haut, plus la case est franche. */
function cellColor(ratio: number | null): string {
  if (ratio === null) return 'transparent';
  if (ratio <= 0) return COLORS.cellEmpty;
  if (ratio < 0.34) return '#1e3a8a';
  if (ratio < 0.67) return '#2563eb';
  if (ratio < 1) return '#3b82f6';
  return '#93c5fd';
}

/**
 * Réduit la taille de police jusqu'à ce que le texte tienne dans `maxWidth`.
 * Sans ça, « 24 h 20 » (temps investi d'une grosse semaine) débordait du
 * tiers de colonne et sortait du cadre à droite.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  maxWidth: number
): void {
  let current = size;
  ctx.font = FONT(weight, current);
  while (ctx.measureText(text).width > maxWidth && current > 28) {
    current -= 4;
    ctx.font = FONT(weight, current);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** « 10 – 16 août 2026 » à partir des bornes 'YYYY-MM-DD' (dates locales). */
export function formatWeekRange(weekStart: string, weekEnd: string, locale = 'fr-FR'): string {
  const toDate = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  };
  const start = toDate(weekStart);
  const end = toDate(weekEnd);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(locale, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const endLabel = end.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

interface RecapLabels {
  title: string;
  tasks: string;
  streak: string;
  streakUnit: string;
  time: string;
  habits: string;
  cta: string;
  signature: string;
}

const DEFAULT_LABELS: RecapLabels = {
  title: 'Ma semaine',
  tasks: 'tâches terminées',
  streak: 'série en cours',
  streakUnit: 'jours',
  time: 'temps investi',
  habits: 'habitudes suivies',
  cta: 'Essayez sans inscription',
  signature: 'fait avec Cosmo · thecosmo.app',
};

/**
 * Dessine le bilan. Rien de ce qui est écrit ici n'est nominatif : uniquement
 * des agrégats produits par `buildRecap` (cf. l'avertissement de recap-data).
 */
export function drawRecap(
  canvas: HTMLCanvasElement,
  recap: RecapData,
  labels: Partial<RecapLabels> = {},
  locale = 'fr-FR'
): void {
  const text = { ...DEFAULT_LABELS, ...labels };
  canvas.width = RECAP_WIDTH;
  canvas.height = RECAP_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = COLORS.night;
  ctx.fillRect(0, 0, RECAP_WIDTH, RECAP_HEIGHT);

  // ── Titre ────────────────────────────────────────────────────────────
  let y = SAFE_TOP + 90;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.snow;
  ctx.font = FONT(700, 84);
  ctx.fillText(text.title, RECAP_WIDTH / 2, y);

  y += 62;
  ctx.fillStyle = COLORS.slate;
  ctx.font = FONT(400, 38);
  ctx.fillText(formatWeekRange(recap.weekStart, recap.weekEnd, locale), RECAP_WIDTH / 2, y);

  // Barre d'accent — le seul aplat coloré large, volontairement fin.
  y += 46;
  ctx.fillStyle = COLORS.accent;
  roundRect(ctx, RECAP_WIDTH / 2 - 60, y, 120, 8, 4);
  ctx.fill();

  // ── Trois chiffres ───────────────────────────────────────────────────
  y += 150;
  const stats: Array<[string, string]> = [
    [String(recap.tasksCompleted), text.tasks],
    [recap.streak > 0 ? String(recap.streak) : '—', `${text.streak} (${text.streakUnit})`],
    [formatMinutes(recap.minutes), text.time],
  ];
  // Les colonnes vivent dans la zone de contenu (marge 80 px de BRAND.md), pas
  // sur toute la largeur : sinon « 24 h 20 » vient lécher le bord de l'image.
  const contentX = 80;
  const contentWidth = RECAP_WIDTH - contentX * 2;
  const columnWidth = contentWidth / stats.length;
  stats.forEach(([value, label], index) => {
    const cx = contentX + columnWidth * index + columnWidth / 2;
    ctx.fillStyle = COLORS.snow;
    fitFont(ctx, value, 700, 96, columnWidth - 40);
    ctx.fillText(value, cx, y);
    ctx.fillStyle = COLORS.slate;
    fitFont(ctx, label, 400, 28, columnWidth - 24);
    ctx.fillText(label, cx, y + 48);
  });

  // ── Heatmap ──────────────────────────────────────────────────────────
  const weeks = recap.grid.length;
  const gap = 6;
  const cell = Math.floor((RECAP_WIDTH - 160 - gap * (weeks - 1)) / weeks);
  const gridWidth = weeks * cell + (weeks - 1) * gap;
  const gridX = (RECAP_WIDTH - gridWidth) / 2;
  const gridY = y + 230;

  recap.grid.forEach((column, weekIndex) => {
    column.forEach((ratio, dayIndex) => {
      if (ratio === null) return; // jour futur : case absente, pas grise
      ctx.fillStyle = cellColor(ratio);
      roundRect(ctx, gridX + weekIndex * (cell + gap), gridY + dayIndex * (cell + gap), cell, cell, 5);
      ctx.fill();
    });
  });

  const gridBottom = gridY + 7 * cell + 6 * gap;
  ctx.fillStyle = COLORS.slate;
  ctx.font = FONT(400, 26);
  ctx.fillText(
    `${weeks} semaines · ${recap.habitCount} ${text.habits}`,
    RECAP_WIDTH / 2,
    gridBottom + 52
  );

  // ── Invitation (CTA de marque) ───────────────────────────────────────
  ctx.fillStyle = COLORS.snow;
  ctx.font = FONT(600, 40);
  ctx.fillText(text.cta, RECAP_WIDTH / 2, gridBottom + 190);

  // ── Signature ────────────────────────────────────────────────────────
  // La pastille est positionnée à partir de la LARGEUR MESURÉE du texte :
  // un décalage en dur chevauchait la signature dès que le libellé changeait
  // (traduction anglaise, notamment).
  const signatureY = RECAP_HEIGHT - SAFE_BOTTOM - 40;
  ctx.font = FONT(600, 32);
  const signatureWidth = ctx.measureText(text.signature).width;
  const dotRadius = 7;
  const dotGap = 20;
  const blockLeft = (RECAP_WIDTH - (signatureWidth + dotRadius * 2 + dotGap)) / 2;

  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(blockLeft + dotRadius, signatureY - 11, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.snow;
  ctx.fillText(text.signature, blockLeft + dotRadius * 2 + dotGap, signatureY);
  ctx.textAlign = 'center';
}

/**
 * Rend l'image et renvoie un PNG. `document.fonts.ready` est attendu avant de
 * dessiner : sans ça, le premier rendu tombe sur la police système et le
 * cadrage change d'un appel à l'autre.
 */
export async function renderRecapPng(
  recap: RecapData,
  labels?: Partial<RecapLabels>,
  locale?: string
): Promise<{ canvas: HTMLCanvasElement; blob: Blob | null; dataUrl: string }> {
  const canvas = document.createElement('canvas');
  try {
    await document.fonts?.ready;
  } catch {
    // Police indisponible : on dessine quand même, avec le repli système.
  }
  drawRecap(canvas, recap, labels, locale);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { canvas, blob, dataUrl: canvas.toDataURL('image/png') };
}
