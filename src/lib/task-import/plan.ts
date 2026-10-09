// ═══════════════════════════════════════════════════════════════════
// Plan d'import : ce qui sera créé, AVANT de créer quoi que ce soit
//
// L'aperçu montre exactement ce plan : nombre de tâches, catégories qui
// naîtront, lignes ignorées et pourquoi. Une catégorie existante est reprise
// par son CHEMIN (« Travail › Clients »), casse, accents et espaces ignorés :
// importer deux fois le même projet ne double pas l'arbre.
// ═══════════════════════════════════════════════════════════════════
import type { Category } from '@/modules/categories';
import type { ImportedTask, ParsedImport, SkippedRow } from './types';

/** Au-delà, l'import s'arrête et le surplus est listé : 2 000 créations une à une, c'est déjà plusieurs minutes. */
export const IMPORT_LIMIT = 2000;

export const normalizeName = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export const pathKey = (path: readonly string[]): string => path.map(normalizeName).join('\u0000');

/** Chemin complet → id, pour chaque catégorie existante. */
export function existingPathIndex(categories: readonly Category[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const index = new Map<string, string>();
  for (const category of categories) {
    const path: string[] = [];
    let cursor: Category | undefined = category;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      path.unshift(cursor.name);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    index.set(pathKey(path), category.id);
  }
  return index;
}

export interface ImportPlan {
  tasks: ImportedTask[];
  /** Chemins à créer, chaque parent avant ses enfants. */
  categoriesToCreate: string[][];
  skipped: SkippedRow[];
  completedExcluded: number;
}

export function buildImportPlan(
  parsed: readonly ParsedImport[],
  existing: readonly Category[],
  opts: { includeCompleted: boolean },
): ImportPlan {
  const tasks: ImportedTask[] = [];
  const skipped: SkippedRow[] = [];
  let completedExcluded = 0;

  for (const file of parsed) {
    skipped.push(...file.skipped);
    for (const task of file.tasks) {
      if (task.completed && !opts.includeCompleted) { completedExcluded++; continue; }
      if (tasks.length >= IMPORT_LIMIT) { skipped.push({ line: task.line, reason: 'over_limit', fileName: file.fileName }); continue; }
      tasks.push(task);
    }
  }

  const known = new Set(existingPathIndex(existing).keys());
  const categoriesToCreate: string[][] = [];
  for (const task of tasks) {
    for (let depth = 1; depth <= task.categoryPath.length; depth++) {
      const prefix = task.categoryPath.slice(0, depth);
      const key = pathKey(prefix);
      if (known.has(key)) continue;
      known.add(key);
      categoriesToCreate.push(prefix);
    }
  }
  return { tasks, categoriesToCreate, skipped, completedExcluded };
}
