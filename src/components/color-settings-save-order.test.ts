import { describe, it, expect } from 'vitest';
import { planCreations } from './ColorSettingsModal';
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
