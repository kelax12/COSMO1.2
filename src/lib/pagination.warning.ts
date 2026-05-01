const warned = new Set<string>();

/**
 * Avertit (console.warn) quand un getAll() Supabase atteint sa limite et que
 * les données peuvent être tronquées. À implémenter en pagination UI à terme
 * (cf. faille.md §9). console.warn n'est PAS droppé par vite en prod.
 */
export function warnIfTruncated<T>(rows: T[], limit: number, table: string): T[] {
  if (rows.length >= limit && !warned.has(table)) {
    warned.add(table);
    console.warn(
      `[pagination] ${table}: ${rows.length} lignes (limite ${limit}). ` +
      `Données potentiellement tronquées — implémenter pagination UI.`,
    );
  }
  return rows;
}
