import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import { parseTickTick } from './ticktick';

// Forme d'une sauvegarde TickTick : métadonnées, puis l'en-tête réel.
const HEADER = '"Folder Name","List Name","Title","Kind","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"';
const row = (cells: string[]) => cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
const FILE = [
  '"Date: 2026-10-08+0000"',
  '"Version: 7.1"',
  '"Status: \n0 Normal\n1 Completed\n2 Archived"',
  HEADER,
  row(['Perso', 'Maison', 'Réparer la fuite', 'TEXT', 'urgent,plombier', 'Appeler avant 10h', 'N', '', '2026-10-09T22:00:00+0000', '', '', '5', '0', '', '', '1', 'Europe/Paris', 'true', 'false', '', '', 'list', '101', '']),
  row(['Perso', 'Maison', 'Acheter le joint', 'TEXT', '', '', 'N', '', '', '', '', '0', '0', '', '', '2', 'Europe/Paris', 'false', 'false', '', '', 'list', '102', '101']),
  row(['Perso', 'Maison', 'Courses', 'CHECKLIST', '', '▫Lait\n▪Pain\n▫Œufs', 'Y', '', '', '', '', '3', '0', '', '', '3', 'Europe/Paris', 'false', 'false', '', '', 'list', '103', '']),
  row(['', 'Inbox', 'Méditer', 'TEXT', '', '', 'N', '', '2026-10-08T22:00:00+0000', '', 'RRULE:FREQ=DAILY;INTERVAL=1', '1', '0', '', '', '4', 'Europe/Paris', 'true', 'false', '', '', 'list', '104', '']),
  row(['', 'Inbox', 'Vieux rapport', 'TEXT', '', '', 'N', '', '', '', '', '0', '2', '', '2026-09-01T10:00:00+0000', '5', 'Europe/Paris', 'false', 'false', '', '', 'list', '105', '']),
  row(['', 'Inbox', '', 'TEXT', '', '', 'N', '', '', '', '', '0', '0', '', '', '6', '', 'false', 'false', '', '', 'list', '106', '']),
  row(['', 'Inbox', 'Sous-tâche perdue', 'TEXT', '', '', 'N', '', '', '', '', '0', '0', '', '', '7', '', 'false', 'false', '', '', 'list', '107', '999']),
].join('\n');

const texts = { labels: (l: string) => `Étiquettes : ${l}`, originalDue: (v: string) => `Échéance d’origine : ${v}` };

describe('parseTickTick', () => {
  const parsed = parseTickTick(parseCsv(FILE), 'TickTick-backup.csv', texts);

  it('saute les métadonnées et lit les tâches', () => {
    expect(parsed.source).toBe('ticktick');
    expect(parsed.tasks.map((t) => t.name)).toEqual(['Réparer la fuite', 'Courses', 'Méditer', 'Vieux rapport']);
  });

  it('dossier et liste → catégorie et sous-catégorie ; échéance au jour du fuseau', () => {
    expect(parsed.tasks[0]).toMatchObject({
      categoryPath: ['Perso', 'Maison'], priority: 1, dueDay: '2026-10-10', completed: false,
      subtasks: ['Acheter le joint'],
    });
    expect(parsed.tasks[0].description).toBe('Appeler avant 10h\n\nÉtiquettes : urgent, plombier');
  });

  it('checklist → sous-tâches', () => {
    expect(parsed.tasks[1]).toMatchObject({ priority: 2, subtasks: ['Lait', 'Pain', 'Œufs'] });
    expect(parsed.tasks[1].description).toBeUndefined();
  });

  it('liste sans dossier, récurrence RRULE', () => {
    expect(parsed.tasks[2]).toMatchObject({ categoryPath: ['Inbox'], recurrence: 'daily', dueDay: '2026-10-09', priority: 4 });
  });

  it('statut 2 (archivée) → terminée', () => {
    expect(parsed.tasks[3].completed).toBe(true);
  });

  it('lignes ignorées : titre vide, sous-tâche dont la parente est absente', () => {
    expect(parsed.skipped.map((s) => s.reason).sort()).toEqual(['empty_title', 'orphan_subtask']);
  });

  it('fichier sans en-tête TickTick : rien', () => {
    expect(parseTickTick(parseCsv('a,b\n1,2'), 'x.csv', texts).tasks).toEqual([]);
  });
});
