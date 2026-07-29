import { describe, it, expect } from 'vitest';
import { formatLine, formatTaskDetail } from './format.mjs';

/** Tâche telle que `mapTaskFromRow` la renvoie pour un `select('*')`. */
function task(overrides = {}) {
  return {
    id: 'd334057f-7f20-4f45-99c0-39284b75e97c',
    name: 'Ma tache',
    priority: 2,
    category: '',
    deadline: '2026-08-01T00:00:00+00:00',
    estimatedTime: 45,
    bookmarked: false,
    completed: false,
    completedAt: undefined,
    krId: undefined,
    recurrence: 'none',
    createdAt: '2026-07-20T09:30:00+00:00',
    description: 'Contexte detaille de la tache.',
    ...overrides,
  };
}

describe('formatTaskDetail', () => {
  it('affiche la description (regression : show rendait la meme ligne que list)', () => {
    const out = formatTaskDetail(task());
    expect(out).toContain('Contexte detaille de la tache.');
    // La ligne compacte de `list` ne doit plus etre la sortie complete.
    expect(out).not.toBe(formatLine(task()));
  });

  it('rend les autres champs du JSON', () => {
    const out = formatTaskDetail(task({ bookmarked: true, recurrence: 'weekly' }));
    expect(out).toContain('d334057f-7f20-4f45-99c0-39284b75e97c');
    expect(out).toContain('2026-08-01');
    expect(out).toContain('45 min');
    expect(out).toContain('weekly');
    expect(out).toContain('2026-07-20');
    expect(out).toMatch(/favori\s+oui/);
  });

  it('distingue explicitement une description vide d un champ non affiche', () => {
    // Le mode d'echec d'origine : rien a l'ecran, donc un agent conclut que
    // son ecriture a echoue et la rejoue en boucle. Le vide doit etre dit.
    for (const empty of [undefined, '', null]) {
      expect(formatTaskDetail(task({ description: empty }))).toContain('(aucune description)');
    }
  });

  it('preserve les descriptions multi-lignes', () => {
    const out = formatTaskDetail(task({ description: 'Ligne un\nLigne deux' }));
    expect(out).toContain('Ligne un');
    expect(out).toContain('Ligne deux');
  });

  it('marque une tache terminee et une echeance absente', () => {
    const out = formatTaskDetail(task({ completed: true, deadline: '' }));
    expect(out).toMatch(/statut\s+terminee/);
    expect(out).toMatch(/echeance\s+\(aucune\)/);
  });

  it('ne casse pas sur une tache minimale', () => {
    expect(() => formatTaskDetail({ id: 'x', name: 'n' })).not.toThrow();
  });
});

describe('formatLine', () => {
  it('reste la ligne compacte pour list', () => {
    expect(formatLine(task())).toBe(
      '[ ] P2 Ma tache echeance 2026-08-01  (d334057f-7f20-4f45-99c0-39284b75e97c)'
    );
  });

  it('rend toujours les autres domaines', () => {
    expect(formatLine({ id: 'c1', name: 'SEO', color: '#fff' })).toBe('SEO  (c1)');
    expect(formatLine({ id: 'h1', name: 'Sport', doneToday: true })).toBe('[x] Sport  (h1)');
    expect(formatLine({ id: 'e1', title: 'Reunion', startTime: '09:00' })).toBe(
      '09:00  Reunion  (e1)'
    );
  });
});
