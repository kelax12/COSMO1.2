// ═══════════════════════════════════════════════════════════════════
// IMPACT D'UNE SUPPRESSION DE CATÉGORIE D'ÉQUIPE — jumeau entreprise de R-02
// ═══════════════════════════════════════════════════════════════════
//
// Le rattachement se fait par NOM (`team_okrs.category` porte le nom, pas un
// identifiant — mig. 078). Ces tests existent d'abord pour ça : compter par
// identifiant rendrait zéro sur des données réelles, donc un « aucun impact »
// faux juste avant une suppression.
import { describe, it, expect } from 'vitest';
import type { TeamOKR } from '@/modules/team-okrs';
import {
  orgOkrCategoryImpact,
  orgOkrCategoryDependents,
  EMPTY_ORG_OKR_IMPACT,
} from './impact';

const okr = (id: string, category?: string): TeamOKR => ({
  id,
  orgId: 'org-1',
  title: id,
  category,
  createdBy: 'u1',
  createdAt: '2026-09-01T10:00:00.000Z',
  teamIds: [],
  keyResults: [],
});

describe('orgOkrCategoryImpact', () => {
  it('compte les OKR d’équipe qui portent le NOM de la catégorie', () => {
    const okrs = [okr('a', 'Croissance'), okr('b', 'Produit'), okr('c', 'Croissance')];
    expect(orgOkrCategoryImpact('Croissance', okrs)).toEqual({ okrs: 2, total: 2 });
  });

  it('ne compte PAS par identifiant : le champ porte un nom', () => {
    const okrs = [okr('a', 'Croissance')];
    expect(orgOkrCategoryImpact('okrcat-growth', okrs)).toEqual(EMPTY_ORG_OKR_IMPACT);
  });

  it('rend un impact vide sans nom de catégorie', () => {
    expect(orgOkrCategoryImpact(undefined, [okr('a', 'Croissance')])).toEqual(EMPTY_ORG_OKR_IMPACT);
    expect(orgOkrCategoryImpact('', [okr('a', 'Croissance')])).toEqual(EMPTY_ORG_OKR_IMPACT);
  });

  it('ignore les OKR sans catégorie', () => {
    expect(orgOkrCategoryImpact('Croissance', [okr('a'), okr('b', 'Croissance')])).toEqual({ okrs: 1, total: 1 });
  });
});

describe('orgOkrCategoryDependents', () => {
  it('rend les identifiants des OKR à réaffecter, pas leur nombre', () => {
    const okrs = [okr('a', 'Croissance'), okr('b', 'Produit'), okr('c', 'Croissance')];
    expect(orgOkrCategoryDependents('Croissance', okrs)).toEqual(['a', 'c']);
  });

  it('rend une liste vide sans nom de catégorie', () => {
    expect(orgOkrCategoryDependents(null, [okr('a', 'Croissance')])).toEqual([]);
  });
});
