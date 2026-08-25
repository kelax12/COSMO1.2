import { describe, it, expect } from 'vitest';
import { calculateStreak, habitStreak } from './streak';

const NOW = new Date(2026, 6, 10, 12, 0, 0); // 10 juillet 2026

const key = (daysAgo: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA');
};

const completionsFor = (daysAgo: number[]) =>
  Object.fromEntries(daysAgo.map(n => [key(n), true]));

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
