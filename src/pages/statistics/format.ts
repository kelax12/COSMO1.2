// Formatage de durée pur pour StatisticsPage — extrait pour être testable et
// partagé. Comportement déplacé verbatim depuis StatisticsPage.tsx.

import { formatDurationMinutes } from '@/lib/duration';

// "90" → "1 h 30", "60" → "1 h", "45" → "45 min" (maquette 139 : une seule
// écriture des durées dans l'app, `@/lib/duration`).
export function formatTime(minutes: number): string {
  return formatDurationMinutes(minutes);
}

// Variante courte — comportement actuellement identique à formatTime.
export const formatTimeShort = formatTime;
