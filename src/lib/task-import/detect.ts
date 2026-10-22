// Quel export est-ce ? Todoist et TickTick ont un en-tête reconnaissable ;
// tout le reste passe par la correspondance de colonnes (`generic`).
import type { ImportSource } from './types';
import { findTickTickHeader } from './ticktick';

/** Lignes examinées pour trouver l'en-tête TickTick, derrière ses métadonnées. */
const TICKTICK_SCAN = 30;

export function detectFormat(rows: readonly string[][]): ImportSource {
  const first = (rows[0] ?? []).map((c) => c.trim().toUpperCase());
  if (first.includes('TYPE') && first.includes('CONTENT')) return 'todoist';
  if (findTickTickHeader(rows.slice(0, TICKTICK_SCAN)) !== -1) return 'ticktick';
  return 'generic';
}
