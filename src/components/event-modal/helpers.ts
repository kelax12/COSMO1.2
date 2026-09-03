// Logique pure de EventModal — extraite pour être testable indépendamment.
// Comportement déplacé verbatim depuis EventModal.tsx.
import type { EventModalMode } from '@/components/EventModal';

// ⚠️ Ce module est PUR : il n'a pas de locale. Il rendait des libellés
// FRANÇAIS EN DUR — jours abrégés, titres de la modale, bouton de validation —
// affichés tels quels à un anglophone (revue du 2026-09-02, point 7). Il rend
// désormais des CLÉS du catalogue `eventModal`, mises en mots par l'écran.

/** Clés des jours abrégés, indexées sur Date.getDay() (0 = dimanche). */
export const DAY_LABEL_KEYS = [
  'dayShort.0', 'dayShort.1', 'dayShort.2', 'dayShort.3',
  'dayShort.4', 'dayShort.5', 'dayShort.6',
] as const;
// Ordre d'affichage lundi → dimanche pour le sélecteur de jours.
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Durée entre début et fin.
 *
 * `invalid` plutôt qu'une phrase : « fin avant début » est un FAIT, et sa
 * formulation appartient au catalogue. `null` = saisie incomplète.
 */
export type EventDuration = { kind: 'invalid' } | { kind: 'duration'; text: string };

export function formatEventDuration(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): EventDuration | null {
  if (!startDate || !startTime || !endDate || !endTime) return null;
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffMs <= 0) return { kind: 'invalid' };
  if (diffHours === 0) return { kind: 'duration', text: `${diffMinutes} min` };
  if (diffMinutes === 0) return { kind: 'duration', text: `${diffHours}h` };
  return { kind: 'duration', text: `${diffHours}h${diffMinutes}min` };
}

/** Clé de catalogue du titre de la modale. */
export function headerTitleKey(mode: EventModalMode): string {
  switch (mode) {
    case 'add':
      return 'headerAdd';
    case 'edit':
      return 'headerEdit';
    case 'convert':
      return 'headerConvert';
  }
}

/** Clé de catalogue du bouton de validation. */
export function submitButtonKey(mode: EventModalMode): string {
  switch (mode) {
    case 'add':
      return 'submitAdd';
    case 'edit':
      return 'submitEdit';
    case 'convert':
      return 'headerConvert';
  }
}

// Champs requis manquants (alimente le shake). Mêmes règles que doSave().
export function getMissingEventFields(fields: {
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}): string[] {
  const missing: string[] = [];
  if (!fields.title.trim()) missing.push('title');
  if (!fields.startDate || !fields.endDate) missing.push('date');
  if (!fields.startTime) missing.push('startTime');
  if (!fields.endTime) missing.push('endTime');
  return missing;
}

export type EventRangeStatus = 'ok' | 'invalid-date' | 'end-before-start';

// Valide l'intervalle ISO start/end (après construction des dates).
export function validateEventRange(startISO: string, endISO: string): EventRangeStatus {
  if (isNaN(new Date(startISO).getTime()) || isNaN(new Date(endISO).getTime())) {
    return 'invalid-date';
  }
  if (new Date(endISO) <= new Date(startISO)) {
    return 'end-before-start';
  }
  return 'ok';
}
