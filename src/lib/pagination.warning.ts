import { toast } from 'sonner';
import * as Sentry from '@sentry/react';
import { translator } from '@/i18n/useT';

const warned = new Set<string>();

// User-friendly labels for the truncation toast. Keep keys aligned with the
// `table` argument passed by each repository.
// Libelles lisibles du toast de troncature. Les cles suivent l'argument
// `table` passe par chaque repository.
//
// ⚠️ Ils vivent dans le catalogue `common` (`pagination.tables.*`) et non ici :
// le toast est traduit, donc un libelle francais en dur au milieu produirait
// une phrase moitie anglaise moitie francaise (R-05). Une table absente de
// cette liste retombe sur son nom technique, ce qui reste comprehensible.
const TABLE_LABEL_KEYS: readonly string[] = [
  'tasks', 'habits', 'events', 'okrs', 'kr_completions',
  'categories', 'lists', 'friends', 'team_tasks',
];

/**
 * Avertit quand un getAll() Supabase atteint sa limite et que les données
 * peuvent être tronquées :
 * - console.warn (dev only — droppé en build prod, faille §14)
 * - toast.warning visible utilisateur (prod ET dev), une fois par table par
 *   session via Set `warned`. Faille §9 — pagination UI à venir.
 * - Sentry (prod ET dev) — voir ci-dessous.
 *
 * ⚠️ Pourquoi Sentry ici (audit archi 2026-08-07, point H4/M6)
 *
 * L'utilisateur était prévenu (toast), mais PERSONNE côté équipe ne l'était :
 * `console.warn` est retiré au build prod (`vite.config.ts → esbuild.pure`).
 * Concrètement, un power-user pouvait perdre des lignes à l'écran pendant des
 * mois sans qu'aucun signal ne remonte — et c'est précisément l'événement qui
 * doit déclencher le chantier « pagination serveur ».
 *
 * Niveau `warning` : ce n'est pas une erreur (l'app fonctionne), c'est un
 * signal de capacité. Aucune PII : seuls le nom de table et un COMPTE partent.
 */
export function warnIfTruncated<T>(rows: T[], limit: number, table: string): T[] {
  if (rows.length >= limit && !warned.has(table)) {
    warned.add(table);
    console.warn(
      `[pagination] ${table}: ${rows.length} lignes (limite ${limit}). ` +
      `Données potentiellement tronquées — implémenter pagination UI.`,
    );
    Sentry.captureMessage(`pagination truncated: ${table}`, {
      level: 'warning',
      tags: { pagination_table: table },
      extra: { rows: rows.length, limit },
    });
    const t = translator('common').t;
    const label = TABLE_LABEL_KEYS.includes(table)
      ? t(`pagination.tables.${table}` as Parameters<typeof t>[0])
      : table;
    toast.warning(t('pagination.truncated', { limit: String(limit), label }), {
      description: t('pagination.truncatedHint'),
      duration: 8000,
    });
  }
  return rows;
}
