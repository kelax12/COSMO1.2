import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import { guessMapping, isDoneValue, parseGeneric } from './generic';
import { detectFormat } from './detect';

const NOW = new Date(2026, 9, 8, 12, 0, 0);

describe('guessMapping', () => {
  it('en-têtes Notion en anglais', () => {
    expect(guessMapping(['Name', 'Status', 'Due Date', 'Priority', 'Project', 'Notes']))
      .toEqual({ title: 0, done: 1, due: 2, priority: 3, category: 4, description: 5 });
  });
  it('en-têtes français, accents compris', () => {
    expect(guessMapping(['Tâche', 'Échéance', 'Priorité', 'Catégorie', 'Terminé', 'Description']))
      .toEqual({ title: 0, due: 1, priority: 2, category: 3, done: 4, description: 5 });
  });
  it('aucun titre reconnu : la première colonne', () => {
    expect(guessMapping(['Truc', 'Machin']).title).toBe(0);
  });
});

describe('isDoneValue', () => {
  it('reconnaît les « fait » usuels, pas les statuts ouverts', () => {
    for (const v of ['Done', 'Terminé', 'Complete', 'Completed', 'Yes', 'Oui', 'true', '☑', 'x', 'Fait']) expect(isDoneValue(v), v).toBe(true);
    for (const v of ['Not started', 'In progress', 'En cours', 'No', 'Non', '', 'false']) expect(isDoneValue(v), v).toBe(false);
  });
});

describe('parseGeneric', () => {
  const FILE = [
    'Name,Status,Due Date,Priority,Project,Notes',
    'Écrire l’article,In progress,"October 9, 2026 3:00 PM",High,Travail/Blog,Brouillon prêt',
    'Payer la facture,Done,10/10/2026,2,,',
    ',Not started,,,,',
    'Planifier les vacances,Not started,"October 12, 2026 → October 15, 2026",Low,Perso,',
  ].join('\n');
  const parsed = parseGeneric(parseCsv(FILE), guessMapping(['Name', 'Status', 'Due Date', 'Priority', 'Project', 'Notes']), 'Tâches 4f2a.csv', NOW);

  it('lit chaque colonne selon la correspondance', () => {
    expect(parsed.source).toBe('generic');
    expect(parsed.tasks[0]).toMatchObject({
      name: 'Écrire l’article', dueDay: '2026-10-09', priority: 1, completed: false,
      categoryPath: ['Travail', 'Blog'], description: 'Brouillon prêt', subtasks: [], recurrence: 'none',
    });
  });

  it('statut « Done » → terminée ; date à l européenne ; sans catégorie', () => {
    expect(parsed.tasks[1]).toMatchObject({ completed: true, dueDay: '2026-10-10', priority: 2, categoryPath: [] });
  });

  it('plage de dates Notion : le début', () => {
    expect(parsed.tasks[2]).toMatchObject({ dueDay: '2026-10-12', priority: 5 });
  });

  it('titre vide ignoré', () => {
    expect(parsed.skipped).toEqual([{ line: 4, reason: 'empty_title', fileName: 'Tâches 4f2a.csv' }]);
  });
});

describe('detectFormat', () => {
  it('Todoist, TickTick, sinon générique', () => {
    expect(detectFormat(parseCsv('TYPE,CONTENT,PRIORITY\ntask,a,1'))).toBe('todoist');
    expect(detectFormat(parseCsv('"Date: x"\n"Folder Name","List Name","Title"\n"a","b","c"'))).toBe('ticktick');
    expect(detectFormat(parseCsv('Name,Status\na,Done'))).toBe('generic');
    expect(detectFormat([])).toBe('generic');
  });
});
