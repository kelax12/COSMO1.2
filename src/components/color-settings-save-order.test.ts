import { describe, it, expect } from 'vitest';
import { planCreations, planDeletions } from './ColorSettingsModal';
import type { Category } from '@/modules/categories';

const draft = (id: string, parentId: string | null): Category => ({
  id, name: id, color: '#000', parentId, position: 0,
});

describe('planCreations', () => {
  it('rend un parent avant son enfant, même déclarés dans le désordre', () => {
    const plan = planCreations([draft('temp-2', 'temp-1'), draft('temp-1', null)]);
    expect(plan.map((c) => c.id)).toEqual(['temp-1', 'temp-2']);
  });

  it('ignore les catégories déjà enregistrées', () => {
    const plan = planCreations([draft('cat-1', null), draft('temp-1', 'cat-1')]);
    expect(plan.map((c) => c.id)).toEqual(['temp-1']);
  });

  it('accepte un enfant dont le parent est déjà en base', () => {
    expect(planCreations([draft('temp-1', 'cat-existante')]).map((c) => c.id)).toEqual(['temp-1']);
  });

  // ─── TÉMOIN ────────────────────────────────────────────────────────
  // 🔴 Ce cas existe pour prouver que le détecteur DÉTECTE. Sans lui, une
  // implémentation qui rendrait le lot inchangé passerait les trois cas
  // ci-dessus par hasard, l'ordre d'entrée étant parfois déjà bon.
  it('TÉMOIN : un lot déjà trié à l envers n est PAS rendu tel quel', () => {
    const reversed = [draft('temp-3', 'temp-2'), draft('temp-2', 'temp-1'), draft('temp-1', null)];
    expect(planCreations(reversed).map((c) => c.id)).not.toEqual(reversed.map((c) => c.id));
    expect(planCreations(reversed).map((c) => c.id)).toEqual(['temp-1', 'temp-2', 'temp-3']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// planDeletions — tâche 10, suppression d'une branche
// ═══════════════════════════════════════════════════════════════════
//
// La FK `categories.parent_id` (mig. 143) est `ON DELETE NO ACTION`, vérifiée
// À LA FIN DE CHAQUE INSTRUCTION : une suppression par catégorie, en requêtes
// séparées, échoue si le parent part avant son enfant. `planDeletions` doit
// donc rendre l'enfant AVANT le parent — l'exact inverse de `planCreations`.
describe('planDeletions', () => {
  it('rend un enfant avant son parent, même déclarés dans le désordre', () => {
    const plan = planDeletions([draft('parent', null), draft('child', 'parent')]);
    expect(plan.map((c) => c.id)).toEqual(['child', 'parent']);
  });

  it('ordonne une branche à trois niveaux des feuilles vers la racine', () => {
    const plan = planDeletions([
      draft('root', null),
      draft('leaf', 'branch'),
      draft('branch', 'root'),
    ]);
    expect(plan.map((c) => c.id)).toEqual(['leaf', 'branch', 'root']);
  });

  it('une catégorie dont le parent survit (hors du lot supprimé) part immédiatement', () => {
    // « promote » : seul le nœud visé est supprimé, ses enfants sont
    // reparentés ailleurs AVANT l'enregistrement — ils ne sont donc jamais
    // dans `removed`. Le lot supprimé ne contient alors qu'un nœud sans
    // enfant présent dans le même lot.
    expect(planDeletions([draft('solo', 'grand-parent-qui-reste')]).map((c) => c.id)).toEqual(['solo']);
  });

  // ─── TÉMOIN ────────────────────────────────────────────────────────
  // 🔴 Sans lui, une implémentation qui rendrait le lot inchangé (ou qui
  // oublierait d'inverser `orderByDepth`) passerait le premier cas par
  // accident si l'ordre d'entrée était déjà le bon — ou échouerait dans le
  // sens INVERSE (parent avant enfant) sans qu'aucun test ne le remarque.
  it('TÉMOIN : ne rend JAMAIS un parent avant un de ses enfants du même lot', () => {
    const plan = planDeletions([draft('root', null), draft('branch', 'root'), draft('leaf', 'branch')]);
    const indexOf = (id: string) => plan.findIndex((c) => c.id === id);
    expect(indexOf('leaf')).toBeLessThan(indexOf('branch'));
    expect(indexOf('branch')).toBeLessThan(indexOf('root'));
    // Et ce n'est pas juste « pas dans le désordre » : c'est bien feuilles
    // d'abord, racine en dernier — pas un ordre arbitraire qui satisferait
    // les deux inégalités ci-dessus par accident sur un lot de longueur 3.
    expect(plan.map((c) => c.id)).toEqual(['leaf', 'branch', 'root']);
  });
});
