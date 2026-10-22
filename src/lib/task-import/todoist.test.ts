import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import { parseTodoist } from './todoist';

// En-tête réel d'un export « Projet en CSV » de Todoist.
const HEADER = 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG';
const FILE = [
  HEADER,
  'meta,view_style=list,,,,,,,,,,,,',
  'task,Envoyer le devis,Version signée,1,1,Axel (1),,2026-10-09,en,Europe/Paris,,,,',
  'section,Clients,,,,,,,,,,,,',
  'task,Appeler Martin @urgent @tel,,2,1,Axel (1),,Oct 12 2026,en,Europe/Paris,30,minute,,',
  'task,Préparer les questions,,4,2,Axel (1),,,,,,,,',
  'task,Relire le contrat,,4,3,Axel (1),,,,,,,,',
  'note,Penser au tarif 2027,,,,Axel (1),,,,,,,,',
  'task,Arroser les plantes,,4,1,Axel (1),,every day,en,Europe/Paris,,,,',
  'task,Faire le point,,3,1,Axel (1),,quand j\'ai le temps,fr,,,,,',
  'task,,,4,1,Axel (1),,,,,,,,',
  'task,Sous-tâche orpheline,,4,2,Axel (1),,,,,,,,',
].join('\n');

const NOW = new Date(2026, 9, 8, 12, 0, 0);
const texts = {
  labels: (list: string) => `Étiquettes : ${list}`,
  originalDue: (value: string) => `Échéance d’origine : ${value}`,
};

describe('parseTodoist', () => {
  const parsed = parseTodoist(parseCsv(FILE), 'Travail [2203306141].csv', texts, NOW);

  it('nomme la source et range le projet en catégorie, sans l identifiant Todoist', () => {
    expect(parsed.source).toBe('todoist');
    expect(parsed.tasks[0].categoryPath).toEqual(['Travail']);
  });

  it('tâche simple : priorité p1 → 1, date, description', () => {
    expect(parsed.tasks[0]).toMatchObject({
      name: 'Envoyer le devis', description: 'Version signée', priority: 1, dueDay: '2026-10-09',
      completed: false, recurrence: 'none', subtasks: [],
    });
  });

  it('section → sous-catégorie, étiquettes retirées du nom, sous-tâches et note rattachées', () => {
    const t = parsed.tasks.find((x) => x.name === 'Appeler Martin');
    expect(t).toMatchObject({
      categoryPath: ['Travail', 'Clients'], priority: 2, dueDay: '2026-10-12',
      subtasks: ['Préparer les questions', 'Relire le contrat'],
    });
    expect(t?.description).toContain('Étiquettes : urgent, tel');
    expect(t?.description).toContain('Penser au tarif 2027');
  });

  it('récurrence lue dans DATE, échéance posée aujourd hui pour qu elle tourne', () => {
    expect(parsed.tasks.find((x) => x.name === 'Arroser les plantes')).toMatchObject({
      recurrence: 'daily', dueDay: '2026-10-08', priority: 0,
    });
  });

  it('date illisible : pas d échéance, texte d origine en description', () => {
    const t = parsed.tasks.find((x) => x.name === 'Faire le point');
    expect(t?.dueDay).toBeUndefined();
    expect(t?.description).toBe("Échéance d’origine : quand j'ai le temps");
  });

  it('lignes ignorées : titre vide, sous-tâche sans parente (meta passe en silence)', () => {
    expect(parsed.skipped.map((s) => s.reason).sort()).toEqual(['empty_title', 'orphan_subtask']);
    expect(parsed.skipped.find((s) => s.reason === 'empty_title')?.line).toBe(11);
  });

  it('quatre tâches en tout', () => {
    expect(parsed.tasks.map((x) => x.name)).toEqual(['Envoyer le devis', 'Appeler Martin', 'Arroser les plantes', 'Faire le point']);
  });

  it('DEADLINE l emporte sur DATE', () => {
    const file = [HEADER, 'task,Rendre le rapport,,4,1,,,Oct 10 2026,en,,,,2026-10-15,en'].join('\n');
    expect(parseTodoist(parseCsv(file), 'X.csv', texts, NOW).tasks[0].dueDay).toBe('2026-10-15');
  });
});
