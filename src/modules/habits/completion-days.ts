// ═══════════════════════════════════════════════════════════════════
// HABITS · jours cochés (DAT-02)
//
// L'historique est UNE LIGNE PAR JOUR COCHÉ (`habit_completions`, mig. 248),
// clé = date LOCALE `YYYY-MM-DD` figée à l'écriture. Ces deux helpers sont la
// règle commune des deux repositories : même filtre, même refus.
// ═══════════════════════════════════════════════════════════════════

/** Jour réel au format `YYYY-MM-DD` (le 30 février est refusé, comme par `habit_day_from_key` en SQL). */
export function isRealDayKey(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

/**
 * Jours COCHÉS d'une carte `completions` : valeur `true` ET clé qui est un jour
 * réel. Un `false` ou une clé invalide n'a pas de ligne (absence = non coché).
 */
export function checkedDays(completions: Record<string, boolean> | undefined): string[] {
  return Object.entries(completions ?? {})
    .filter(([day, on]) => on === true && isRealDayKey(day))
    .map(([day]) => day);
}
