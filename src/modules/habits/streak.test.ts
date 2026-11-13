import { describe, it, expect } from 'vitest';
import { calculateStreak, habitStreak, toggleCompletionDay } from './streak';

describe('toggleCompletionDay (contrat de habit_completions, mig. 248)', () => {
  it('cocher ajoute le jour à true sans toucher aux autres', () => {
    expect(toggleCompletionDay({ '2026-07-01': true }, '2026-07-02')).toEqual({ '2026-07-01': true, '2026-07-02': true });
  });

  it('décocher RETIRE la clé (jamais false), comme la fenêtre lue dans la table', () => {
    const after = toggleCompletionDay({ '2026-07-01': true, '2026-07-02': true }, '2026-07-02');
    expect(after).toEqual({ '2026-07-01': true });
    expect(Object.prototype.hasOwnProperty.call(after, '2026-07-02')).toBe(false);
  });

  it('une clé héritée à false se coche comme une absente', () => {
    expect(toggleCompletionDay({ '2026-07-02': false }, '2026-07-02')).toEqual({ '2026-07-02': true });
  });

  it('ne mute pas la carte reçue', () => {
    const before = { '2026-07-01': true };
    toggleCompletionDay(before, '2026-07-01');
    expect(before).toEqual({ '2026-07-01': true });
  });
});

const NOW = new Date(2026, 6, 10, 12, 0, 0); // 10 juillet 2026

const key = (daysAgo: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA');
};

const completionsFor = (daysAgo: number[]) =>
  Object.fromEntries(daysAgo.map(n => [key(n), true]));

describe('calculateStreak : jours prévus (mig. 251)', () => {
  // Prévus : un jour sur deux en remontant (aujourd'hui, J-2, J-4…).
  const evenDays = new Set([0, 2, 4, 6, 8, 10].map(key));
  const every2 = (k: string) => evenDays.has(k);

  it('un jour non prévu est neutre : la série passe par-dessus', () => {
    expect(calculateStreak(completionsFor([0, 2, 4]), NOW, every2)).toBe(3);
  });

  it('aujourd’hui prévu et pas coché : la série se juge du jour prévu précédent', () => {
    expect(calculateStreak(completionsFor([2, 4, 6]), NOW, every2)).toBe(3);
  });

  it('un jour PRÉVU manqué casse la série', () => {
    expect(calculateStreak(completionsFor([0, 4, 6]), NOW, every2)).toBe(1);
  });

  it('une coche sur un jour non prévu ne compte pas', () => {
    expect(calculateStreak(completionsFor([0, 1, 2, 3]), NOW, every2)).toBe(2);
  });

  it("aujourd'hui non prévu : la série d'hier et d'avant tient", () => {
    const odd = new Set([1, 3, 5].map(key));
    expect(calculateStreak(completionsFor([1, 3, 5]), NOW, (k) => odd.has(k))).toBe(3);
  });

  it('habitStreak applique les jours prévus de l’habitude en repli démo', () => {
    const today = NOW.getDay();
    const twoAgo = (today + 5) % 7;
    const habit = { completions: completionsFor([0, 2]), scheduledDays: [today, twoAgo] };
    expect(habitStreak(habit, NOW)).toBe(2);
    // Sans réglage, J-1 manquant casse la série.
    expect(habitStreak({ completions: completionsFor([0, 2]) }, NOW)).toBe(1);
  });
});

// Mêmes scénarios, mêmes valeurs en dur que `supabase/proofs/251.proof.sql` :
// le JS (démo, cache optimiste) et le SQL rendent la même série.
describe('jours prévus : scénarios de la preuve 251', () => {
  const w = NOW.getDay();
  // Trois jours par semaine : aujourd'hui, J-2, J-4 (modulo 7).
  const S = [w, (w + 5) % 7, (w + 3) % 7];
  const P1 = completionsFor([1, 2, 3, 4, 7, 9, 11, 16, 18]);

  it('P0 sans jours prévus : 4', () => {
    expect(habitStreak({ completions: P1 }, NOW)).toBe(4);
  });

  it('P1 trois jours par semaine : 5, coches des jours non prévus neutres', () => {
    expect(habitStreak({ completions: P1, scheduledDays: S }, NOW)).toBe(5);
    const tomorrow = new Date(NOW);
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Demain (non prévu) : aujourd'hui, prévu, est manqué : la série casse.
    expect(habitStreak({ completions: P1, scheduledDays: S }, tomorrow)).toBe(0);
    expect(habitStreak({ completions: { ...P1, [key(0)]: true }, scheduledDays: S }, NOW)).toBe(6);
  });

  it('P2 historique daté : le passé se juge avec l’ancien réglage (7, pas 4)', () => {
    const completions = completionsFor([2, 4, 6, 7, 8, 9, 10, 13]);
    const scheduleHistory = [
      { from: '1970-01-01', days: [0, 1, 2, 3, 4, 5, 6] },
      { from: key(5), days: S },
    ];
    expect(habitStreak({ completions, scheduledDays: S, scheduleHistory }, NOW)).toBe(7);
    expect(habitStreak({ completions, scheduledDays: S }, NOW)).toBe(4);
  });
});

describe('calculateStreak', () => {
  it('aucune complétion → streak 0', () => {
    expect(calculateStreak({}, NOW)).toBe(0);
  });

  it('série simple sans trou (aujourd\'hui + 4 jours)', () => {
    expect(calculateStreak(completionsFor([0, 1, 2, 3, 4]), NOW)).toBe(5);
  });

  it('aujourd\'hui pas encore coché → la série d\'hier tient', () => {
    expect(calculateStreak(completionsFor([1, 2, 3]), NOW)).toBe(3);
  });

  it('un jour manqué remet la série à zéro depuis ce point', () => {
    // coché aujourd'hui, manqué hier → seul aujourd'hui compte
    expect(calculateStreak(completionsFor([0, 2, 3, 4]), NOW)).toBe(1);
  });

  it('vieille série interrompue depuis longtemps → streak 0', () => {
    expect(calculateStreak(completionsFor([10, 11, 12]), NOW)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// habitStreak — le chiffre serveur prime sur le calcul local (mig. 119)
//
// Depuis que `completions` est borné à une fenêtre glissante, calculer la
// série dessus plafonnerait silencieusement le compteur d'un utilisateur
// assidu. Ces tests verrouillent la priorité ET le repli.
// ═══════════════════════════════════════════════════════════════════
describe('habitStreak', () => {
  const dayKey = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toLocaleDateString('en-CA');
  };

  it('prefere streakCurrent (historique complet) au calcul sur la fenetre', () => {
    // La fenêtre ne contient que 2 jours, le serveur en a compté 1 200.
    const habit = {
      completions: { [dayKey(0)]: true, [dayKey(1)]: true },
      streakCurrent: 1200,
    };
    expect(habitStreak(habit)).toBe(1200);
  });

  it('retombe sur le calcul local quand le serveur ne fournit rien (demo/local)', () => {
    const habit = { completions: { [dayKey(0)]: true, [dayKey(1)]: true } };
    expect(habitStreak(habit)).toBe(2);
  });

  it('respecte un streakCurrent a 0 et ne le confond pas avec absent', () => {
    // `?? ` et non `|| ` : une série RÉELLEMENT nulle (habitude abandonnée)
    // ne doit pas déclencher le repli, qui recalculerait la même chose mais
    // masquerait un éventuel désaccord entre serveur et client.
    const habit = { completions: { [dayKey(0)]: true }, streakCurrent: 0 };
    expect(habitStreak(habit)).toBe(0);
  });
});
