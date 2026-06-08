// Logique pure de EventModal — extraite pour être testable indépendamment.
// Comportement déplacé verbatim depuis EventModal.tsx.
import type { EventModalMode } from '../EventModal';

// Libellés courts des jours, indexés sur Date.getDay() (0 = dimanche).
export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
// Ordre d'affichage lundi → dimanche pour le sélecteur de jours.
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Durée affichée entre début et fin, ou null si incomplet.
export function formatEventDuration(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): string | null {
  if (!startDate || !startTime || !endDate || !endTime) return null;
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffMs <= 0) return "⚠️ Fin avant début";
  if (diffHours === 0) return `${diffMinutes} min`;
  if (diffMinutes === 0) return `${diffHours}h`;
  return `${diffHours}h${diffMinutes}min`;
}

export function headerTitle(mode: EventModalMode): string {
  switch (mode) {
    case 'add':
      return "Ajouter un événement";
    case 'edit':
      return "Modifier l'événement";
    case 'convert':
      return "Convertir en événement";
  }
}

export function submitButtonText(mode: EventModalMode): string {
  switch (mode) {
    case 'add':
      return "Valider";
    case 'edit':
      return "Enregistrer";
    case 'convert':
      return "Convertir en événement";
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
