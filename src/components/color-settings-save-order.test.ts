import { describe, it, expect } from 'vitest';
import { applyDeleteToDrafts, planCreations, planDeletions } from './ColorSettingsModal';
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

// ═══════════════════════════════════════════════════════════════════
// Le sort des enfants quand on supprime leur parent
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CES TESTS EXISTENT. La revue de la suppression de branche a
// relevé que RIEN n'exerçait ce branchement, alors que c'est le seul endroit du
// chantier où se tromper DÉTRUIT des données : choisir la mauvaise issue
// déplace des tâches qui n'avaient aucune raison de bouger.
//
//        travail
//          ├── seo
//          │    └── backlinks
//          └── design
describe('applyDeleteToDrafts', () => {
  const cat = (id: string, parentId: string | null): Category => ({
    id, name: id, color: '#000', parentId, position: 0,
  });
  const ARBRE = [
    cat('travail', null),
    cat('seo', 'travail'),
    cat('backlinks', 'seo'),
    cat('design', 'travail'),
  ];

  it('« remonter » retire le nœud et raccroche ses enfants à SON parent', () => {
    const { next, removedIds } = applyDeleteToDrafts(ARBRE, 'seo', 'promote');
    expect(next.map((c) => c.id).sort()).toEqual(['backlinks', 'design', 'travail']);
    // backlinks passe sous travail, le parent de seo — pas à la racine.
    expect(next.find((c) => c.id === 'backlinks')?.parentId).toBe('travail');
    // Seul le nœud visé est reclassé : le contenu des enfants ne bouge pas.
    expect(removedIds).toEqual(['seo']);
  });

  it('« remonter » sur une RACINE rend ses enfants racines à leur tour', () => {
    const { next } = applyDeleteToDrafts(ARBRE, 'travail', 'promote');
    expect(next.find((c) => c.id === 'seo')?.parentId).toBeNull();
    expect(next.find((c) => c.id === 'design')?.parentId).toBeNull();
  });

  it('« supprimer la branche » emporte le nœud ET tous ses descendants', () => {
    const { next, removedIds } = applyDeleteToDrafts(ARBRE, 'seo', 'deleteBranch');
    expect(next.map((c) => c.id).sort()).toEqual(['design', 'travail']);
    // 🔴 Les DEUX identifiants doivent être reclassés : sans backlinks dans la
    // liste, le contenu des descendants filerait vers « aucune catégorie »
    // alors que la personne a choisi une destination pour TOUT.
    expect(removedIds.sort()).toEqual(['backlinks', 'seo']);
  });

  // ─── TÉMOIN ────────────────────────────────────────────────────────
  // Les deux issues doivent DIVERGER. Une implémentation qui traiterait
  // « remonter » comme « supprimer la branche » passerait les cas ci-dessus
  // sur un nœud sans enfant, et détruirait des données sur les autres.
  it('TÉMOIN : les deux issues ne rendent pas le même résultat', () => {
    const promote = applyDeleteToDrafts(ARBRE, 'seo', 'promote');
    const branche = applyDeleteToDrafts(ARBRE, 'seo', 'deleteBranch');
    expect(promote.next.map((c) => c.id).sort()).not.toEqual(branche.next.map((c) => c.id).sort());
    expect(promote.removedIds).not.toEqual(branche.removedIds);
  });

  it('ne mute jamais le tableau reçu', () => {
    const copie = JSON.parse(JSON.stringify(ARBRE));
    applyDeleteToDrafts(ARBRE, 'seo', 'deleteBranch');
    expect(ARBRE).toEqual(copie);
  });
});
