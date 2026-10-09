// ═══════════════════════════════════════════════════════════════════
// Import TickTick : une sauvegarde CSV (Réglages › Compte › Générer une sauvegarde)
//
// Format relu le 2026-10-08 (importeur TickTick de Vikunja, qui cherche la
// même chose) : des lignes de MÉTADONNÉES d'abord (« Date: », « Version: »,
// « Status: » sur plusieurs lignes), puis l'en-tête « Folder Name »,
// « List Name », « Title »… On cherche donc l'en-tête au lieu de le supposer
// en première ligne.
//   · Dossier → catégorie, liste → sous-catégorie (liste seule sans dossier).
//   · `parentId` → sous-tâche de la tâche `taskId` correspondante.
//   · Checklist : une ligne par élément, préfixée ▫ (à faire) ou ▪ (fait).
//   · `Due Date` est un INSTANT en UTC ; le jour se lit dans le fuseau de la
//     colonne `Timezone`, sinon une tâche du 10 à minuit à Paris tomberait le 9.
//   · Priorité 5 haute, 3 moyenne, 1 basse, 0 aucune. Statut 1 ou 2 = fait.
// ═══════════════════════════════════════════════════════════════════
import type { ImportedTask, ParsedImport, SkippedRow } from './types';
import type { ImportTexts } from './todoist';
import { instantToDay, mapPriority, parseDay, parseRecurrence } from './dates';

const CHECK_ITEM = /^[▫▪☐☑]\s*/;

export function findTickTickHeader(rows: string[][]): number {
  return rows.findIndex((r) => r.includes('Folder Name') && r.includes('List Name') && r.includes('Title'));
}

export function parseTickTick(rows: string[][], fileName: string, texts: ImportTexts): ParsedImport {
  const headerAt = findTickTickHeader(rows);
  if (headerAt === -1) return { source: 'ticktick', fileName, tasks: [], skipped: [] };
  const header = rows[headerAt];
  const at = (row: string[], name: string): string => {
    const i = header.indexOf(name);
    return i >= 0 ? (row[i] ?? '').trim() : '';
  };

  const tasks: ImportedTask[] = [];
  const skipped: SkippedRow[] = [];
  const byId = new Map<string, ImportedTask>();
  const children: { row: string[]; line: number }[] = [];

  rows.slice(headerAt + 1).forEach((row, i) => {
    const line = headerAt + i + 2;
    const parentId = at(row, 'parentId');
    if (parentId && parentId !== '0') { children.push({ row, line }); return; }

    const name = at(row, 'Title');
    if (!name) { skipped.push({ line, reason: 'empty_title', fileName }); return; }

    const content = at(row, 'Content');
    const isChecklist = at(row, 'Kind').toUpperCase() === 'CHECKLIST' || at(row, 'Is Check list') === 'Y';
    const lines = content ? content.split(/\r?\n/) : [];
    const subtasks = isChecklist ? lines.filter((l) => CHECK_ITEM.test(l)).map((l) => l.replace(CHECK_ITEM, '').trim()).filter(Boolean) : [];
    const prose = isChecklist ? lines.filter((l) => !CHECK_ITEM.test(l)).join('\n').trim() : content;

    const due = at(row, 'Due Date');
    const dueDay = due ? (instantToDay(due, at(row, 'Timezone') || undefined) ?? parseDay(due)) : undefined;
    const tags = at(row, 'Tags').split(',').map((s) => s.trim()).filter(Boolean);
    const description = [prose, tags.length ? texts.labels(tags.join(', ')) : '', due && !dueDay ? texts.originalDue(due) : '']
      .filter(Boolean).join('\n\n');

    const folder = at(row, 'Folder Name');
    const list = at(row, 'List Name');
    const status = at(row, 'Status');
    const task: ImportedTask = {
      name,
      description: description || undefined,
      dueDay,
      priority: mapPriority('ticktick', at(row, 'Priority')),
      completed: status === '1' || status === '2',
      categoryPath: [folder, list].filter(Boolean),
      subtasks,
      recurrence: parseRecurrence(at(row, 'Repeat')),
      line,
    };
    tasks.push(task);
    const id = at(row, 'taskId');
    if (id) byId.set(id, task);
  });

  for (const { row, line } of children) {
    const parent = byId.get(at(row, 'parentId'));
    const name = at(row, 'Title');
    if (!parent) { skipped.push({ line, reason: 'orphan_subtask', fileName }); continue; }
    if (name) parent.subtasks.push(name);
  }
  return { source: 'ticktick', fileName, tasks, skipped };
}
