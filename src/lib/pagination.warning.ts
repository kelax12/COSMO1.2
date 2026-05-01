const warned = new Set<string>();

/**
 * Avertit (console.warn) quand un getAll() Supabase atteint sa limite et que
 * les données peuvent être tronquées. Dev-only : console.warn est droppé en
 * build prod (faille §14). À remplacer par une pagination UI (faille §9).
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
