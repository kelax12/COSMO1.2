import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quick-add-parser';

// Mercredi 1er juillet 2026 à 9h00 (heure locale)
const NOW = new Date(2026, 6, 1, 9, 0, 0);

const local = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d).toLocaleDateString('en-CA');

describe('parseQuickAdd', () => {
  it('phrase simple sans token → tout dans le nom', () => {
    const r = parseQuickAdd('Appeler le dentiste', NOW);
    expect(r).toEqual({ name: 'Appeler le dentiste' });
  });

  it('parse la phrase complète : date + heure + catégorie + priorité', () => {
    const r = parseQuickAdd('Appeler le dentiste jeudi 10h #santé !!', NOW);
    expect(r.name).toBe('Appeler le dentiste');
    expect(r.deadline).toBe(local(2026, 7, 2)); // jeudi 2 juillet
    expect(r.categoryToken).toBe('santé');
    expect(r.priority).toBe(2);
  });

  it('demain / après-demain / aujourd\'hui', () => {
    expect(parseQuickAdd('x demain', NOW).deadline).toBe(local(2026, 7, 2));
    expect(parseQuickAdd('x après-demain', NOW).deadline).toBe(local(2026, 7, 3));
    expect(parseQuickAdd("x aujourd'hui", NOW).deadline).toBe(local(2026, 7, 1));
  });

  it('jour de semaine identique à aujourd\'hui → semaine suivante', () => {
    // NOW est un mercredi → « mercredi » désigne le mercredi suivant
    expect(parseQuickAdd('x mercredi', NOW).deadline).toBe(local(2026, 7, 8));
  });

  it('date numérique 15/07 (année implicite) et passée → année suivante', () => {
    expect(parseQuickAdd('x 15/07', NOW).deadline).toBe(local(2026, 7, 15));
    expect(parseQuickAdd('x 15/03', NOW).deadline).toBe(local(2027, 3, 15));
    expect(parseQuickAdd('x 15/03/2026', NOW).deadline).toBe(local(2026, 3, 15));
  });

  it('priorités : !1..!5 explicites et !, !!, !!!', () => {
    expect(parseQuickAdd('x !4', NOW).priority).toBe(4);
    expect(parseQuickAdd('x !', NOW).priority).toBe(3);
    expect(parseQuickAdd('x !!', NOW).priority).toBe(2);
    expect(parseQuickAdd('x !!!', NOW).priority).toBe(1);
  });

  it('durées : ~30m, ~45min, ~1h, ~1h30', () => {
    expect(parseQuickAdd('x ~30m', NOW).estimatedTime).toBe(30);
    expect(parseQuickAdd('x ~45min', NOW).estimatedTime).toBe(45);
    expect(parseQuickAdd('x ~1h', NOW).estimatedTime).toBe(60);
    expect(parseQuickAdd('x ~1h30', NOW).estimatedTime).toBe(90);
  });

  it('heure seule (« 14h ») → deadline aujourd\'hui, token consommé', () => {
    const r = parseQuickAdd('Réunion 14h', NOW);
    expect(r.name).toBe('Réunion');
    expect(r.deadline).toBe(local(2026, 7, 1));
  });

  it('un mot avec h qui n\'est pas une heure reste dans le nom', () => {
    const r = parseQuickAdd('acheter 30hp', NOW);
    expect(r.name).toBe('acheter 30hp');
    expect(r.deadline).toBeUndefined();
  });

  it('la casse et les accents des mots-clés sont tolérés', () => {
    expect(parseQuickAdd('x DEMAIN', NOW).deadline).toBe(local(2026, 7, 2));
    expect(parseQuickAdd('x Août 15/07', NOW).name).toBe('x Août');
  });

  it('seul le premier token de chaque type est consommé', () => {
    const r = parseQuickAdd('x #a #b !2 !5', NOW);
    expect(r.categoryToken).toBe('a');
    expect(r.priority).toBe(2);
    expect(r.name).toBe('x #b !5');
  });

  it('entrée vide → nom vide, aucun champ', () => {
    expect(parseQuickAdd('   ', NOW)).toEqual({ name: '' });
  });
});
