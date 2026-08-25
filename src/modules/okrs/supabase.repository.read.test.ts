// ═══════════════════════════════════════════════════════════════════
// OKRS, lectures ciblées et suppression.
//
// `supabase.repository.test.ts` (à côté) couvre le journal append-only
// `kr_completions` et les gardes d'injection. Ce fichier couvre les quatre
// chemins de lecture restants, tous bâtis sur le même mécanisme en deux temps :
// on lit les OKR, puis on complète leurs résultats clés depuis la TABLE
// dédiée, avec repli sur le JSONB historique quand la table est vide.
//
// Ce repli n'est pas décoratif : les OKR créés avant la mig. 008 n'ont leurs
// KR que dans la colonne `key_results`. Si la table dédiée l'emportait sur un
// tableau vide, ces OKR s'afficheraient sans aucun résultat clé, un OKR vide
// n'a l'air ni cassé ni suspect, il a juste l'air terminé.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseOKRsRepository } from './supabase.repository';
import type { KeyResult } from './types';

const repo = new SupabaseOKRsRepository();

const KR_UUID = '33333333-3333-4333-8333-333333333333';

const krRow = {
  id: KR_UUID, okr_id: 'okr1', user_id: 'u1', title: 'Lire 10 livres',
  unit: 'livres', current_value: 5, target_value: 10,
  estimated_time: 60, completed: false, completed_at: null,
};

const okrRow = {
  id: 'okr1', title: 'Culture', description: '', category: 'perso',
  progress: 50, completed: false, key_results: [],
  start_date: '2026-01-01', end_date: '2026-12-31',
};

const jsonbKR: KeyResult = {
  id: KR_UUID, title: 'KR JSONB', unit: 'x', currentValue: 1, targetValue: 2,
  estimatedTime: 0, completed: false, completedAt: null,
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseOKRsRepository, getById', () => {
  it('PGRST116 (aucune ligne) donne null, jamais une exception', async () => {
    supabaseMock.queueTable('okrs', { data: null, error: { code: 'PGRST116' } });
    await expect(repo.getById('okr1')).resolves.toBeNull();
    // Aucune lecture des KR : inutile d'aller chercher les enfants d'un parent
    // qui n'existe pas.
    expect(supabaseMock.callsFor('key_results')).toEqual([]);
  });

  it('une vraie erreur remonte (seul PGRST116 est avale)', async () => {
    supabaseMock.queueTable('okrs', { data: null, error: { code: '42501', message: 'rls' } });
    await expect(repo.getById('okr1')).rejects.toBeTruthy();
  });

  it('complete l OKR avec les KR de la table dediee', async () => {
    supabaseMock.queueTable('okrs', { data: okrRow });
    supabaseMock.queueTable('key_results', { data: [krRow] });

    const okr = await repo.getById('okr1');

    expect(supabaseMock.argsOf('okrs', 'eq')).toEqual(['id', 'okr1']);
    expect(okr?.keyResults).toHaveLength(1);
    expect(okr?.keyResults[0]).toMatchObject({
      id: KR_UUID, title: 'Lire 10 livres', currentValue: 5, targetValue: 10,
    });
  });

  it('table dediee vide : repli sur le JSONB historique (OKR anterieurs a la mig. 008)', async () => {
    supabaseMock.queueTable('okrs', { data: { ...okrRow, key_results: [jsonbKR] } });
    supabaseMock.queueTable('key_results', { data: [] });

    const okr = await repo.getById('okr1');

    // Sans ce repli, un OKR d'avant la mig. 008 s'afficherait SANS résultat
    // clé, silencieusement, donc sans que personne ne le signale.
    expect(okr?.keyResults).toHaveLength(1);
    expect(okr?.keyResults[0].title).toBe('KR JSONB');
  });
});

describe('SupabaseOKRsRepository, getByCategory et getFiltered', () => {
  it('getByCategory: filtre sur category, trie du plus recent au plus ancien', async () => {
    supabaseMock.queueTable('okrs', { data: [okrRow] });
    supabaseMock.queueTable('key_results', { data: [krRow] });

    const okrs = await repo.getByCategory('perso');

    expect(supabaseMock.argsOf('okrs', 'eq')).toEqual(['category', 'perso']);
    expect(supabaseMock.argsOf('okrs', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(okrs[0].keyResults).toHaveLength(1);
  });

  it('getByCategory: data null donne [] et n interroge pas les KR', async () => {
    supabaseMock.queueTable('okrs', { data: null });
    await expect(repo.getByCategory('perso')).resolves.toEqual([]);
  });

  it('getByCategory: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('okrs', { error: { message: 'boom', code: '42501' } });
    await expect(repo.getByCategory('perso')).rejects.toBeTruthy();
  });

  it('getFiltered: chaque filtre va sur la bonne colonne avec le bon operateur', async () => {
    supabaseMock.queueTable('okrs', { data: [okrRow] });
    supabaseMock.queueTable('key_results', { data: [] });

    await repo.getFiltered({
      category: 'perso',
      completed: false,
      startAfter: '2026-01-01',
      endBefore: '2026-12-31',
    });

    const calls = supabaseMock.callsFor('okrs');
    const eqs = calls.filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqs).toEqual([['category', 'perso'], ['completed', false]]);
    // `gte` sur la date de DÉBUT et `lte` sur la date de FIN : intervertir les
    // deux renverrait les OKR qui ne chevauchent PAS la période demandée.
    expect(calls.find((c) => c.method === 'gte')?.args).toEqual(['start_date', '2026-01-01']);
    expect(calls.find((c) => c.method === 'lte')?.args).toEqual(['end_date', '2026-12-31']);
  });

  it('getFiltered: completed = false est bien applique (et non ignore comme falsy)', async () => {
    supabaseMock.queueTable('okrs', { data: [] });

    await repo.getFiltered({ completed: false });

    // Le piège classique : `if (filters.completed)` au lieu de
    // `!== undefined` ferait disparaître le filtre « en cours », c'est-à-dire
    // le seul que l'écran utilise vraiment.
    const eqs = supabaseMock.callsFor('okrs').filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqs).toEqual([['completed', false]]);
  });

  it('getFiltered: aucun filtre, aucune contrainte ajoutee', async () => {
    supabaseMock.queueTable('okrs', { data: [] });
    await repo.getFiltered({});
    const calls = supabaseMock.callsFor('okrs').map((c) => c.method);
    expect(calls).not.toContain('eq');
    expect(calls).not.toContain('gte');
    expect(calls).not.toContain('lte');
  });

  it('getFiltered: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('okrs', { error: { message: 'boom', code: '42501' } });
    await expect(repo.getFiltered({})).rejects.toBeTruthy();
  });
});

describe('SupabaseOKRsRepository, delete', () => {
  it('delete: un seul DELETE sur okrs, les key_results tombent par CASCADE', async () => {
    supabaseMock.queueTable('okrs', { data: null });

    await repo.delete('okr1');

    expect(supabaseMock.callsFor('okrs').map((c) => c.method)).toContain('delete');
    expect(supabaseMock.argsOf('okrs', 'eq')).toEqual(['id', 'okr1']);
    // Le CASCADE est déclaré en base : supprimer les KR à la main ici
    // dupliquerait la règle, et la ferait diverger le jour où elle change.
    expect(supabaseMock.callsFor('key_results')).toEqual([]);
  });

  it('delete: remonte l erreur PostgREST normalisee', async () => {
    supabaseMock.queueTable('okrs', { error: { message: 'nope', code: '42501' } });
    await expect(repo.delete('okr1')).rejects.toBeTruthy();
  });
});
