import { describe, it, expect } from 'vitest';
import {
  CATEGORY_MAX_DEPTH,
  ancestorIds,
  buildTree,
  categoryPath,
  childrenOf,
  descendantIds,
  descendantIdSet,
  formatPath,
  orderByDepth,
  subtreeHeight,
  treeDepth,
  wouldCreateCycle,
  wouldExceedMaxDepth,
} from './tree';
import type { Category } from './types';

const cat = (id: string, parentId: string | null, position = 0, name = id): Category => ({
  id,
  name,
  color: '#3B82F6',
  parentId,
  position,
});

//        travail            perso
//       /       \             |
//     seo      design       sante
//      |
//  backlinks
const TREE: Category[] = [
  cat('travail', null, 0, 'Travail'),
  cat('perso', null, 1, 'Perso'),
  cat('seo', 'travail', 0, 'SEO'),
  cat('design', 'travail', 1, 'Design'),
  cat('backlinks', 'seo', 0, 'Backlinks'),
  cat('sante', 'perso', 0, 'Santé'),
];

describe('childrenOf', () => {
  it('rend les enfants DIRECTS, triés par position', () => {
    expect(childrenOf('travail', TREE).map((c) => c.id)).toEqual(['seo', 'design']);
  });

  it('rend les racines pour un parent null', () => {
    expect(childrenOf(null, TREE).map((c) => c.id)).toEqual(['travail', 'perso']);
  });

  it('rend un tableau vide pour une feuille', () => {
    expect(childrenOf('backlinks', TREE)).toEqual([]);
  });
});

describe('descendantIds', () => {
  it('rend toute la branche, sans le nœud lui-même', () => {
    expect(descendantIds('travail', TREE).sort()).toEqual(['backlinks', 'design', 'seo']);
  });

  it('rend un tableau vide pour une feuille', () => {
    expect(descendantIds('backlinks', TREE)).toEqual([]);
  });

  // Le trigger empêche d'en créer, mais un client ne doit JAMAIS geler sur une
  // donnée inattendue : une base restaurée ou un bug de migration suffirait.
  it('ne boucle pas sur un cycle déjà présent en données', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect(() => descendantIds('a', cyclic)).not.toThrow();
    expect(descendantIds('a', cyclic)).toEqual(['b']);
  });

  it('rend un tableau vide pour un auto-parentage', () => {
    expect(descendantIds('a', [cat('a', 'a')])).toEqual([]);
  });
});

describe('descendantIdSet', () => {
  it('rend le même ensemble que descendantIds, sous forme de Set', () => {
    expect([...descendantIdSet('travail', TREE)].sort()).toEqual(
      descendantIds('travail', TREE).sort(),
    );
  });

  it('conserve l ordre d insertion du parcours BFS', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect([...descendantIdSet('a', cyclic)]).toEqual(['b']);
  });
});

describe('ancestorIds', () => {
  it('rend les ancêtres de la racine au parent direct', () => {
    expect(ancestorIds('backlinks', TREE)).toEqual(['travail', 'seo']);
  });

  it('rend un tableau vide pour une racine', () => {
    expect(ancestorIds('travail', TREE)).toEqual([]);
  });

  it('ne boucle pas sur un cycle déjà présent en données', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect(() => ancestorIds('a', cyclic)).not.toThrow();
  });
});

describe('categoryPath / formatPath', () => {
  it('rend le chemin complet de la racine à la feuille', () => {
    expect(categoryPath('backlinks', TREE).map((c) => c.name)).toEqual(['Travail', 'SEO', 'Backlinks']);
  });

  it('rend un tableau vide pour un identifiant inconnu', () => {
    expect(categoryPath('inconnu', TREE)).toEqual([]);
  });

  it('formate avec le séparateur PAR DÉFAUT', () => {
    expect(formatPath(categoryPath('backlinks', TREE))).toBe('Travail › SEO › Backlinks');
  });

  it('formate avec le séparateur demandé', () => {
    expect(formatPath(categoryPath('backlinks', TREE), ' / ')).toBe('Travail / SEO / Backlinks');
  });
});

describe('treeDepth', () => {
  it('compte la racine comme le niveau 1', () => {
    expect(treeDepth('travail', TREE)).toBe(1);
    expect(treeDepth('seo', TREE)).toBe(2);
    expect(treeDepth('backlinks', TREE)).toBe(3);
  });

  it('rend 0 pour un identifiant inconnu', () => {
    expect(treeDepth('inconnu', TREE)).toBe(0);
  });
});

describe('bySibling (via childrenOf)', () => {
  it('départage deux frères à la même position par le nom', () => {
    const siblings: Category[] = [
      cat('z', 'parent', 0, 'Zèbre'),
      cat('a', 'parent', 0, 'Alpha'),
    ];
    expect(childrenOf('parent', siblings).map((c) => c.id)).toEqual(['a', 'z']);
  });
});

describe('subtreeHeight', () => {
  it('vaut 1 pour une feuille', () => {
    expect(subtreeHeight('backlinks', TREE)).toBe(1);
  });

  it('compte le nœud lui-même dans la hauteur de la branche', () => {
    // travail -> seo -> backlinks : 3 crans.
    expect(subtreeHeight('travail', TREE)).toBe(3);
  });

  it('ne boucle pas sur un cycle déjà présent en données', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect(() => subtreeHeight('a', cyclic)).not.toThrow();
  });
});

describe('wouldExceedMaxDepth', () => {
  // Chaîne level-1 (racine) → level-8, une catégorie par niveau.
  const CHAIN: Category[] = Array.from({ length: 8 }, (_, i) =>
    cat(`level-${i + 1}`, i === 0 ? null : `level-${i}`),
  );
  // Branche de hauteur 4, détachée de la chaîne.
  const BRANCH: Category[] = [
    cat('branch-root', null),
    cat('branch-2', 'branch-root'),
    cat('branch-3', 'branch-2'),
    cat('branch-4', 'branch-3'),
  ];
  const DATA = [...CHAIN, ...BRANCH];

  it('refuse un déplacement qui dépasserait CATEGORY_MAX_DEPTH (8 + 4 > 10)', () => {
    expect(wouldExceedMaxDepth('branch-root', 'level-8', DATA)).toBe(true);
  });

  it('accepte un déplacement qui reste dans la limite (6 + 4 = 10)', () => {
    expect(wouldExceedMaxDepth('branch-root', 'level-6', DATA)).toBe(false);
  });

  it('refuse pile un cran au-delà (7 + 4 = 11)', () => {
    expect(wouldExceedMaxDepth('branch-root', 'level-7', DATA)).toBe(true);
  });

  it('ne boucle pas sur un cycle déjà présent en données', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect(() => wouldExceedMaxDepth('a', 'b', cyclic)).not.toThrow();
  });
});

describe('wouldCreateCycle', () => {
  it('refuse l auto-parentage', () => {
    expect(wouldCreateCycle('travail', 'travail', TREE)).toBe(true);
  });

  it('refuse un parent qui est un DESCENDANT (cycle indirect)', () => {
    expect(wouldCreateCycle('travail', 'backlinks', TREE)).toBe(true);
  });

  it('accepte un déplacement légitime', () => {
    expect(wouldCreateCycle('design', 'seo', TREE)).toBe(false);
    expect(wouldCreateCycle('seo', null, TREE)).toBe(false);
  });
});

describe('buildTree', () => {
  it('imbrique les nœuds et respecte position puis nom', () => {
    const roots = buildTree(TREE);
    expect(roots.map((n) => n.category.id)).toEqual(['travail', 'perso']);
    expect(roots[0].children.map((n) => n.category.id)).toEqual(['seo', 'design']);
    expect(roots[0].children[0].children.map((n) => n.category.id)).toEqual(['backlinks']);
  });

  it('remonte à la racine un nœud dont le parent est absent', () => {
    const orphan = [cat('x', 'parent-disparu')];
    expect(buildTree(orphan).map((n) => n.category.id)).toEqual(['x']);
  });

  // FIX 1 (critique) : ni 'a' ni 'b' ne qualifiaient comme racine (chacun a un
  // parent présent, différent de lui-même), donc les deux disparaissaient de
  // l'arbre rendu. Un utilisateur avec un arbre corrompu doit voir ses
  // catégories APLATIES, jamais disparues.
  it('aplatit un cycle à deux nœuds au lieu de le faire disparaître', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    const ids = buildTree(cyclic).map((n) => n.category.id);
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('aplatit un cycle à trois nœuds, une racine légitime restant inchangée', () => {
    const withCycle = [
      cat('root', null),
      cat('a', 'c'),
      cat('b', 'a'),
      cat('c', 'b'),
    ];
    const ids = buildTree(withCycle).map((n) => n.category.id);
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'root']);
  });
});

describe('orderByDepth', () => {
  it('rend les parents AVANT leurs enfants', () => {
    const shuffled = [cat('backlinks', 'seo'), cat('travail', null), cat('seo', 'travail')];
    expect(orderByDepth(shuffled).map((c) => c.id)).toEqual(['travail', 'seo', 'backlinks']);
  });

  it('laisse passer un parent DÉJÀ existant hors du lot', () => {
    // « seo » a un parent qui n'est pas dans le lot : il est déjà en base.
    expect(orderByDepth([cat('seo', 'travail')]).map((c) => c.id)).toEqual(['seo']);
  });

  it('lève une ApiError cataloguée sur un lot non ordonnançable, plutôt que de boucler', () => {
    expect(() => orderByDepth([cat('a', 'b'), cat('b', 'a')])).toThrow(
      expect.objectContaining({ code: 'category_batch_cycle' }),
    );
  });
});

describe('CATEGORY_MAX_DEPTH', () => {
  it('vaut 10, la même valeur que le trigger', () => {
    expect(CATEGORY_MAX_DEPTH).toBe(10);
  });
});
