// Formatage de durée pur pour StatisticsPage — extrait pour être testable et
// partagé. Comportement déplacé verbatim depuis StatisticsPage.tsx.

// "90" → "1h30", "60" → "1h", "45" → "45min".
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m < 10 ? '0' : ''}${m}`;
}

// Variante courte — comportement actuellement identique à formatTime.
export const formatTimeShort = formatTime;
