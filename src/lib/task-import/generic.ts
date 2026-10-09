// ═══════════════════════════════════════════════════════════════════
// Import d'un CSV quelconque : Notion, Excel, une autre application
//
// Pas de format fixe : la personne fait correspondre les colonnes, et cette
// correspondance est PRÉ-REMPLIE d'après les noms d'en-tête (fr / en). Le
// titre est la seule colonne obligatoire ; à défaut de mieux, c'est la
// première, qui est celle du titre dans un export de base Notion.
// ═══════════════════════════════════════════════════════════════════
import type { ImportedTask, ParsedImport, SkippedRow } from './types';
import { mapPriority, parseDay } from './dates';

export type ColumnRole = 'title' | 'description' | 'due' | 'category' | 'priority' | 'done';
export type ColumnMapping = Partial<Record<ColumnRole, number>>;
export const COLUMN_ROLES: readonly ColumnRole[] = ['title', 'description', 'due', 'category', 'priority', 'done'];

const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const HINTS: Record<ColumnRole, RegExp> = {
  title: /^(name|title|titre|nom|task|tache|task name|nom de la tache|content|intitule)$/,
  description: /^(description|notes?|details|commentaires?|comments?)$/,
  due: /^(due|due date|date|echeance|date d'echeance|date limite|deadline|when|quand|date de fin)$/,
  category: /^(project|projet|category|categorie|list|liste|folder|dossier|area|domaine)$/,
  priority: /^(priority|priorite|importance)$/,
  done: /^(status|statut|etat|done|completed|complete|termine|terminee|fait|checkbox|case)$/,
};

export function guessMapping(header: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const folded = header.map(fold);
  for (const role of COLUMN_ROLES) {
    const i = folded.findIndex((h, idx) => HINTS[role].test(h) && !Object.values(mapping).includes(idx));
    if (i >= 0) mapping[role] = i;
  }
  if (mapping.title === undefined) mapping.title = 0;
  return mapping;
}

const DONE = /^(done|termine|terminee|complete|completed|fini|finie|fait|faite|yes|oui|true|x|☑|✓|✔|✅)$/;
export const isDoneValue = (value: string): boolean => DONE.test(fold(value));

/** « Travail/Blog », « Travail › Blog », « Travail > Blog » → chemin. Multi-valeur Notion : la première. */
function categoryPath(value: string): string[] {
  const first = value.split(',')[0] ?? '';
  return first.split(/\s*(?:\/|›|>)\s*/).map((s) => s.trim()).filter(Boolean);
}

export function parseGeneric(rows: string[][], mapping: ColumnMapping, fileName: string, now: Date = new Date()): ParsedImport {
  const tasks: ImportedTask[] = [];
  const skipped: SkippedRow[] = [];
  const cell = (row: string[], role: ColumnRole): string => {
    const i = mapping[role];
    return i === undefined ? '' : (row[i] ?? '').trim();
  };

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const name = cell(row, 'title');
    if (!name) { skipped.push({ line, reason: 'empty_title', fileName }); return; }
    // Plage Notion « début → fin » : l'échéance est le début.
    const dueText = cell(row, 'due').split('→')[0].trim();
    tasks.push({
      name,
      description: cell(row, 'description') || undefined,
      dueDay: dueText ? parseDay(dueText, now) : undefined,
      priority: mapPriority('generic', cell(row, 'priority')),
      completed: isDoneValue(cell(row, 'done')),
      categoryPath: categoryPath(cell(row, 'category')),
      subtasks: [],
      recurrence: 'none',
      line,
    });
  });
  return { source: 'generic', fileName, tasks, skipped };
}
