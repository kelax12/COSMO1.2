import { toast } from 'sonner';

const warned = new Set<string>();

// User-friendly labels for the truncation toast. Keep keys aligned with the
// `table` argument passed by each repository.
const TABLE_LABELS: Record<string, string> = {
  tasks: 'tâches',
  habits: 'habitudes',
  events: 'événements',
  okrs: 'OKR',
  kr_completions: 'complétions de KR',
  categories: 'catégories',
  lists: 'listes',
  friends: 'amis',
  team_tasks: 'tâches d\'équipe',
};

/**
 * Avertit quand un getAll() Supabase atteint sa limite et que les données
 * peuvent être tronquées :
 * - console.warn (dev only — droppé en build prod, faille §14)
 * - toast.warning visible utilisateur (prod ET dev), une fois par table par
 *   session via Set `warned`. Faille §9 — pagination UI à venir.
 */
export function warnIfTruncated<T>(rows: T[], limit: number, table: string): T[] {
  if (rows.length >= limit && !warned.has(table)) {
    warned.add(table);
    console.warn(
      `[pagination] ${table}: ${rows.length} lignes (limite ${limit}). ` +
      `Données potentiellement tronquées — implémenter pagination UI.`,
    );
    const label = TABLE_LABELS[table] ?? table;
    toast.warning(`Plus de ${limit} ${label} détectées`, {
      description: 'Seules les plus récentes sont affichées. Utilisez les filtres pour réduire la liste.',
      duration: 8000,
    });
  }
  return rows;
}
