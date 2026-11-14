// Colonnes d'échéance présentes en base pour `tasks`, le temps de la bascule
// DAT-01 (mig. 251 puis 253). Le front est déployé AVANT les migrations : il
// sert les trois états, et c'est la base qui dit dans lequel on est.
//
//   avant 251 : `deadline` (timestamptz) seule
//   après 251 : `deadline` et `due_date` (date), tenues d'accord par trigger
//   après 253 : `due_date` seule
//
// Ce fichier tient l'état, une fois par session ; la sonde elle-même (deux
// `select(col).limit(0)`) vit dans `supabase.repository.ts`, seul lieu des
// requêtes. Règles : src/lib/CLAUDE.md § Échéances.

export interface DeadlineColumns {
  /** `due_date date` existe. */
  day: boolean;
  /** `deadline timestamptz` existe encore. */
  instant: boolean;
}

/** L'état de la production tant que la mig. 251 n'est pas appliquée. */
export const BEFORE_MIGRATION_251: DeadlineColumns = { day: false, instant: true };

/** Ce que rend une sonde : `true` présente, `false` absente, `null` inconnue (réseau). */
export type ColumnProbe = (column: 'due_date' | 'deadline') => Promise<boolean | null>;

let known: Promise<DeadlineColumns> | null = null;

async function probe(columnExists: ColumnProbe): Promise<DeadlineColumns> {
  const [day, instant] = await Promise.all([columnExists('due_date'), columnExists('deadline')]);
  if (day === null || instant === null || (!day && !instant)) {
    // Sonde en échec : on ne mémorise rien, la suivante réessaiera.
    known = null;
    return day ? { day: true, instant: instant ?? false } : BEFORE_MIGRATION_251;
  }
  return { day, instant };
}

export function deadlineColumns(columnExists: ColumnProbe): Promise<DeadlineColumns> {
  if (!known) known = probe(columnExists);
  return known;
}

/** Tests : fixe l'état sans sonder (`null` : sonder de nouveau). */
export function setDeadlineColumnsForTests(columns: DeadlineColumns | null): void {
  known = columns ? Promise.resolve(columns) : null;
}
