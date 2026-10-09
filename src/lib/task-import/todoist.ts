// ═══════════════════════════════════════════════════════════════════
// Import Todoist : un export « Projet en CSV »
//
// Format (aide Todoist, relu le 2026-10-08) : colonnes TYPE, CONTENT,
// DESCRIPTION, PRIORITY, INDENT, … DATE, … DEADLINE. Une ligne par élément :
//   · `task`    : INDENT 1 = tâche, 2 et plus = sous-tâche (COSMO n'a qu'un
//                 niveau : tout ce qui est indenté rejoint la tâche de niveau 1) ;
//   · `section` : les tâches qui suivent appartiennent à cette section ;
//   · `note`    : commentaire de la tâche au-dessus ;
//   · `meta`    : réglage de vue, sans contenu.
// PRIORITY : 1 = p1, la plus haute (et non 4 comme dans l'API Todoist).
// Le projet n'est pas dans le fichier : c'est son NOM, d'où la catégorie.
//
// Les colonnes sont retrouvées par leur NOM, jamais par leur position : les
// exports anciens n'ont ni DURATION ni DEADLINE.
// ═══════════════════════════════════════════════════════════════════
import type { ImportedTask, ParsedImport, SkippedRow } from './types';
import { mapPriority, parseDay, parseRecurrence } from './dates';

/** Textes que l'import écrit DANS les descriptions : fournis par l'appelant (i18n). */
export interface ImportTexts {
  labels: (list: string) => string;
  originalDue: (value: string) => string;
}

const LABEL = /(^|\s)@([\p{L}\p{N}_-]+)/gu;

/** « Travail [2203306141].csv » → « Travail ». */
export function projectNameFromFile(fileName: string): string {
  return fileName.replace(/\.csv$/i, '').replace(/\s*\[\d+\]\s*$/, '').trim();
}

const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function parseTodoist(rows: string[][], fileName: string, texts: ImportTexts, now: Date = new Date()): ParsedImport {
  const [header = [], ...body] = rows;
  const col = (name: string) => header.findIndex((h) => h.trim().toUpperCase() === name);
  const at = (row: string[], name: string): string => {
    const i = col(name);
    return i >= 0 ? (row[i] ?? '').trim() : '';
  };

  const project = projectNameFromFile(fileName);
  const tasks: ImportedTask[] = [];
  const skipped: SkippedRow[] = [];
  const notes = new Map<ImportedTask, string[]>();
  let section: string | null = null;
  let parent: ImportedTask | null = null;

  body.forEach((row, i) => {
    const line = i + 2; // + l'en-tête, numérotation à partir de 1
    const type = at(row, 'TYPE').toLowerCase();
    const content = at(row, 'CONTENT');

    if (type === 'meta' || type === '') return;
    if (type === 'section') { section = content || null; parent = null; return; }
    if (type === 'note') {
      if (parent && content) notes.set(parent, [...(notes.get(parent) ?? []), content]);
      return;
    }
    if (type !== 'task') { skipped.push({ line, reason: 'unsupported_type', fileName }); return; }

    const indent = Number(at(row, 'INDENT') || '1');
    const labels: string[] = [];
    const name = content.replace(LABEL, (_m, lead: string, label: string) => { labels.push(label); return lead; }).replace(/\s+/g, ' ').trim();

    if (indent >= 2) {
      if (!parent) { skipped.push({ line, reason: 'orphan_subtask', fileName }); return; }
      if (name) parent.subtasks.push(name);
      return;
    }
    if (!name) { skipped.push({ line, reason: 'empty_title', fileName }); parent = null; return; }

    const dateText = at(row, 'DATE');
    const recurrence = parseRecurrence(dateText);
    const dueDay = parseDay(at(row, 'DEADLINE'), now) ?? parseDay(dateText, now)
      // Une tâche récurrente sans date ne tournerait jamais : la prochaine
      // occurrence se calcule depuis l'échéance. « every day » commence aujourd'hui.
      ?? (recurrence !== 'none' ? localDay(now) : undefined);

    const description: string[] = [];
    const own = at(row, 'DESCRIPTION');
    if (own) description.push(own);
    if (labels.length) description.push(texts.labels(labels.join(', ')));
    if (dateText && !dueDay) description.push(texts.originalDue(dateText));

    const task: ImportedTask = {
      name,
      description: description.join('\n\n') || undefined,
      dueDay,
      priority: mapPriority('todoist', at(row, 'PRIORITY')),
      completed: false, // l'export Todoist ne contient que les tâches actives
      categoryPath: section ? [project, section] : [project],
      subtasks: [],
      recurrence,
      line,
    };
    tasks.push(task);
    parent = task;
  });

  for (const [task, list] of notes) {
    task.description = [task.description, ...list].filter(Boolean).join('\n\n');
  }
  return { source: 'todoist', fileName, tasks, skipped };
}
